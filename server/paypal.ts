const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

export interface PayPalStatusInfo {
  configured: boolean;
  clientIdConfigured: boolean;
  secretConfigured: boolean;
  clientId: string | null;
  environment: 'sandbox';
}

export function getPayPalConfigStatus(): PayPalStatusInfo {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  const clientIdConfigured = Boolean(clientId);
  const secretConfigured = Boolean(clientSecret);

  return {
    configured: clientIdConfigured && secretConfigured,
    clientIdConfigured,
    secretConfigured,
    clientId: clientIdConfigured ? clientId : null,
    environment: 'sandbox',
  };
}

async function fetchPayPalAccessToken(): Promise<string> {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('PayPal Sandbox credentials are not configured on the server.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`PayPal OAuth failed (${response.status}): ${errText.slice(0, 180)}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('PayPal OAuth response did not contain an access token.');
  }

  return data.access_token;
}

export async function createLiveSandboxOrder(params: {
  amount: number;
  currency: string;
  description: string;
  customId: string;
}): Promise<{
  orderId: string;
  status: string;
  approveUrl: string | null;
  rawSummary: Record<string, unknown>;
}> {
  const token = await fetchPayPalAccessToken();

  const response = await fetch(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: params.customId,
          description: params.description.slice(0, 120),
          amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2),
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });

  const payload = (await response.json()) as {
    id?: string;
    status?: string;
    links?: Array<{ rel?: string; href?: string }>;
    message?: string;
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.message || `PayPal Create Order failed (${response.status})`);
  }

  const approveLink = payload.links?.find((l) => l.rel === 'approve')?.href || null;

  return {
    orderId: payload.id,
    status: payload.status || 'CREATED',
    approveUrl: approveLink,
    rawSummary: {
      id: payload.id,
      status: payload.status,
      intent: 'CAPTURE',
      environment: 'sandbox',
    },
  };
}

export async function captureLiveSandboxOrder(orderId: string): Promise<{
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  payerId: string | null;
  paymentMethod: string;
  captureId: string | null;
}> {
  const token = await fetchPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  const payload = (await response.json()) as {
    id?: string;
    status?: string;
    message?: string;
    payer?: { payer_id?: string };
    payment_source?: Record<string, unknown>;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.message || `PayPal Capture Order failed (${response.status})`);
  }

  const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
  const amountValue = Number(capture?.amount?.value || 0);
  const currency = capture?.amount?.currency_code || 'USD';
  const sourceKeys = Object.keys(payload.payment_source || {});
  const paymentMethod = sourceKeys.includes('card')
    ? 'PayPal Sandbox Card'
    : 'PayPal Sandbox Wallet';

  return {
    orderId: payload.id,
    status: payload.status || 'COMPLETED',
    amount: amountValue,
    currency,
    payerId: payload.payer?.payer_id || null,
    paymentMethod,
    captureId: capture?.id || null,
  };
}

export async function getLiveSandboxOrder(orderId: string): Promise<{
  orderId: string;
  status: string;
  amount: number | null;
  currency: string | null;
  environment: 'sandbox';
}> {
  const token = await fetchPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  const payload = (await response.json()) as {
    id?: string;
    status?: string;
    message?: string;
    purchase_units?: Array<{ amount?: { value?: string; currency_code?: string } }>;
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.message || `PayPal Get Order failed (${response.status})`);
  }

  const unitAmt = payload.purchase_units?.[0]?.amount;

  return {
    orderId: payload.id,
    status: payload.status || 'UNKNOWN',
    amount: unitAmt?.value ? Number(unitAmt.value) : null,
    currency: unitAmt?.currency_code || null,
    environment: 'sandbox',
  };
}
