import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { resetDbForTests } from './db';
import { createApiRouter } from './routes';

function createTestServer() {
  const db = resetDbForTests(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(db));
  return { app, db };
}

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const { app } = createTestServer();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const addr = server.address() as import('node:net').AddressInfo;
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('GET /api/health returns healthy service payload', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; database: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'sqlite');
  });
});

test('Seeded dashboard summary and risk distribution return non-empty persisted data', async () => {
  await withServer(async (base) => {
    const summaryRes = await fetch(`${base}/api/dashboard/summary?range=30d`);
    assert.equal(summaryRes.status, 200);
    const summary = (await summaryRes.json()) as {
      totalTransactions: number;
      flaggedTransactions: number;
      failedPayments: number;
    };
    assert.ok(summary.totalTransactions >= 20);
    assert.ok(summary.flaggedTransactions >= 3);
    assert.ok(summary.failedPayments >= 3);

    const distRes = await fetch(`${base}/api/dashboard/risk-distribution?range=30d`);
    assert.equal(distRes.status, 200);
    const dist = (await distRes.json()) as { total: number; distribution: Array<{ count: number }> };
    assert.equal(dist.total, summary.totalTransactions);
  });
});

test('POST /api/transactions creates transaction, computes risk, triggers alert, and uses Gemini fallback when key missing', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await withServer(async (base) => {
      const createRes = await fetch(`${base}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 4200,
          currency: 'USD',
          customer_id: 'cust_meridian_corp',
          status: 'Failed',
          account_age_days: 2,
          metadata_complete: false,
          country_mismatch: true,
          pattern_shift: true,
        }),
      });
      assert.equal(createRes.status, 201);
      const created = (await createRes.json()) as {
        transaction: {
          id: string;
          risk_score: number;
          risk_category: string;
          explanation_provider: string;
          ai_explanation: string;
        };
      };

      assert.ok(created.transaction.risk_score >= 70);
      assert.equal(created.transaction.risk_category, 'High Risk');
      assert.equal(created.transaction.explanation_provider, 'deterministic_fallback');
      assert.ok(created.transaction.ai_explanation.length > 20);

      // Verify alert was created and review update persists
      const reviewRes = await fetch(`${base}/api/transactions/${created.transaction.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_status: 'Escalated for Further Review',
          note: 'Automated test escalation verification',
        }),
      });
      assert.equal(reviewRes.status, 200);
      const reviewed = (await reviewRes.json()) as {
        transaction: { review_status: string };
        notes: Array<{ note_text: string }>;
      };
      assert.equal(reviewed.transaction.review_status, 'Escalated for Further Review');
      assert.equal(reviewed.notes[0].note_text, 'Automated test escalation verification');
    });
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
  }
});

test('Transaction filtering and PayPal Sandbox simulated order + error handling work end-to-end', async () => {
  await withServer(async (base) => {
    const filterRes = await fetch(`${base}/api/transactions?riskCategory=High+Risk&limit=50`);
    assert.equal(filterRes.status, 200);
    const filtered = (await filterRes.json()) as { items: Array<{ risk_category: string }> };
    assert.ok(filtered.items.length >= 2);
    for (const item of filtered.items) {
      assert.equal(item.risk_category, 'High Risk');
    }

    // Invalid amount validation
    const badOrderRes = await fetch(`${base}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -10 }),
    });
    assert.equal(badOrderRes.status, 400);

    // Valid simulated sandbox order creation -> capture -> duplicate capture prevention
    const orderRes = await fetch(`${base}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 325.5,
        currency: 'USD',
        customer_id: 'cust_sandbox_test_buyer',
      }),
    });
    assert.equal(orderRes.status, 200);
    const order = (await orderRes.json()) as { orderId: string; mode: string };
    assert.equal(order.mode, 'simulated_sandbox');

    const capRes = await fetch(`${base}/api/paypal/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    assert.equal(capRes.status, 200);
    const capBody = (await capRes.json()) as { transaction: { paypal_order_id: string; amount: number } };
    assert.equal(capBody.transaction.paypal_order_id, order.orderId);
    assert.equal(capBody.transaction.amount, 325.5);

    // Duplicate capture rejected cleanly with 409
    const dupRes = await fetch(`${base}/api/paypal/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    assert.equal(dupRes.status, 409);
  });
});
