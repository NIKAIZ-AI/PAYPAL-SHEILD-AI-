import type {
  ActivityPoint,
  AlertRecord,
  AppSettings,
  DashboardSummary,
  PaymentEvent,
  ReviewNote,
  ReviewStatus,
  RiskDistributionItem,
  RiskEvaluationResult,
  RiskFactor,
  TransactionRecord,
  TransactionStatus,
} from '../types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getHealth: () =>
    requestJson<{
      status: string;
      database: string;
      geminiConfigured: boolean;
      paypalSandboxConfigured: boolean;
    }>('/api/health'),

  getDashboardSummary: (range: string) =>
    requestJson<DashboardSummary>(`/api/dashboard/summary?range=${encodeURIComponent(range)}`),

  getDashboardActivity: (range: string) =>
    requestJson<{ range: string; series: ActivityPoint[] }>(
      `/api/dashboard/activity?range=${encodeURIComponent(range)}`
    ),

  getRiskDistribution: (range: string) =>
    requestJson<{ total: number; distribution: RiskDistributionItem[] }>(
      `/api/dashboard/risk-distribution?range=${encodeURIComponent(range)}`
    ),

  getTransactions: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '' && v !== 'All') {
        qs.set(k, String(v));
      }
    }
    return requestJson<{
      items: TransactionRecord[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/transactions?${qs.toString()}`);
  },

  getTransactionDetail: (id: string) =>
    requestJson<{
      transaction: TransactionRecord;
      events: PaymentEvent[];
      notes: ReviewNote[];
      alerts: AlertRecord[];
    }>(`/api/transactions/${encodeURIComponent(id)}`),

  createTransaction: (payload: {
    amount: number;
    currency: string;
    customer_id: string;
    status: TransactionStatus;
    payment_method?: string;
    account_age_days?: number;
    metadata_complete?: boolean;
    country_mismatch?: boolean;
    pattern_shift?: boolean;
  }) =>
    requestJson<{ transaction: TransactionRecord }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reanalyzeTransaction: (id: string) =>
    requestJson<{ transaction: TransactionRecord }>(
      `/api/transactions/${encodeURIComponent(id)}/analyze`,
      { method: 'POST' }
    ),

  updateTransactionReview: (id: string, review_status: ReviewStatus, note?: string) =>
    requestJson<{
      transaction: TransactionRecord;
      notes: ReviewNote[];
      events: PaymentEvent[];
    }>(`/api/transactions/${encodeURIComponent(id)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ review_status, note }),
    }),

  addTransactionNote: (id: string, note_text: string) =>
    requestJson<{ notes: ReviewNote[] }>(`/api/transactions/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note_text }),
    }),

  assessRiskLab: (payload: {
    amount: number;
    currency: string;
    customer_id: string;
    status: TransactionStatus;
    payment_method: string;
    account_age_days: number;
    metadata_complete: boolean;
    country_mismatch: boolean;
    pattern_shift: boolean;
    customer_avg_amount: number;
    customer_tx_count_24h: number;
    customer_failed_attempts_24h: number;
  }) =>
    requestJson<
      RiskEvaluationResult & {
        ai_explanation: string;
        explanation_provider: 'gemini' | 'deterministic_fallback';
      }
    >('/api/risk/assess', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRiskSummary: () =>
    requestJson<{
      weights: Record<string, number>;
      thresholds: { mediumMin: number; highMin: number };
      counts: {
        total: number;
        highRisk: number;
        mediumRisk: number;
        lowRisk: number;
        flagged: number;
        repeatedFailurePatterns: number;
        unusualFrequencyClusters: number;
      };
      commonFactors: Array<{
        id: string;
        label: string;
        triggeredCount: number;
        totalPoints: number;
        avgPoints: number;
      }>;
    }>('/api/risk/summary'),

  getAlerts: (params?: { category?: string; unreadOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'All') qs.set('category', params.category);
    if (params?.unreadOnly) qs.set('unreadOnly', 'true');
    return requestJson<{ alerts: AlertRecord[]; unreadCount: number }>(`/api/alerts?${qs.toString()}`);
  },

  markAlertRead: (id: string, is_read = true) =>
    requestJson<{ success: boolean; unreadCount: number }>(
      `/api/alerts/${encodeURIComponent(id)}/read`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_read }),
      }
    ),

  markAllAlertsRead: () =>
    requestJson<{ success: boolean; unreadCount: number }>('/api/alerts/read-all', {
      method: 'PATCH',
    }),

  reviewAlert: (id: string, review_status: ReviewStatus, note?: string) =>
    requestJson<{ success: boolean; review_status: ReviewStatus }>(
      `/api/alerts/${encodeURIComponent(id)}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ review_status, note }),
      }
    ),

  getAnalyticsOverview: (range: string) =>
    requestJson<{
      range: string;
      totalTransactions: number;
      totalVolume: number;
      averageTransactionValue: number;
      paymentSuccessRate: number;
      paymentFailureRate: number;
      flaggedPercentage: number;
      highRiskCount: number;
      frequentRiskFactors: Array<{ label: string; count: number }>;
    }>(`/api/analytics/overview?range=${encodeURIComponent(range)}`),

  getAnalyticsTrends: (range: string) =>
    requestJson<{
      range: string;
      trends: Array<{
        date: string;
        volume: number;
        transactions: number;
        highRisk: number;
        mediumRisk: number;
        lowRisk: number;
        avgRiskScore: number;
      }>;
    }>(`/api/analytics/trends?range=${encodeURIComponent(range)}`),

  getExportCsvUrl: (range: string) =>
    `/api/analytics/export?range=${encodeURIComponent(range)}`,

  getPayPalStatus: () =>
    requestJson<{
      configured: boolean;
      clientIdConfigured: boolean;
      secretConfigured: boolean;
      clientId: string | null;
      environment: 'sandbox';
    }>('/api/paypal/status'),

  createPayPalOrder: (payload: {
    amount: number;
    currency: string;
    customer_id: string;
    description: string;
    account_age_days?: number;
    metadata_complete?: boolean;
    country_mismatch?: boolean;
    pattern_shift?: boolean;
  }) =>
    requestJson<{
      orderId: string;
      status: string;
      mode: 'paypal_sandbox' | 'simulated_sandbox';
      approveUrl: string | null;
      clientId: string | null;
      notice?: string;
    }>('/api/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  capturePayPalOrder: (orderId: string, simulateFailure = false) =>
    requestJson<{
      mode: 'paypal_sandbox' | 'simulated_sandbox';
      capture: Record<string, unknown>;
      transaction: TransactionRecord;
    }>('/api/paypal/capture-order', {
      method: 'POST',
      body: JSON.stringify({ orderId, simulateFailure }),
    }),

  getPayPalOrder: (orderId: string) =>
    requestJson<{
      mode: 'paypal_sandbox' | 'simulated_sandbox';
      order: {
        orderId: string;
        status: string;
        amount: number | null;
        currency: string | null;
        environment: 'sandbox';
      };
    }>(`/api/paypal/order/${encodeURIComponent(orderId)}`),

  getSettings: () => requestJson<AppSettings>('/api/settings'),

  updateSettings: (payload: Record<string, unknown>) =>
    requestJson<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export type { RiskFactor };
