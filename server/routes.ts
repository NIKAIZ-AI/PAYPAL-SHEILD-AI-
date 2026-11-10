import express from 'express';
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  calculateTransactionRisk,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_RISK_WEIGHTS,
} from '../src/lib/riskEngine';
import type {
  ActivityPoint,
  AppSettings,
  ReviewStatus,
  RiskFactor,
  TransactionRecord,
  TransactionSource,
  TransactionStatus,
} from '../src/types';
import {
  createAlertsIfNeeded,
  getCustomerContext,
  getDb,
  getStoredSettings,
  saveStoredSettings,
} from './db';
import { GEMINI_MODEL, generateRiskExplanation, isGeminiConfigured } from './gemini';
import {
  captureLiveSandboxOrder,
  createLiveSandboxOrder,
  getLiveSandboxOrder,
  getPayPalConfigStatus,
} from './paypal';

const VALID_STATUSES: TransactionStatus[] = ['Completed', 'Pending', 'Failed', 'Captured'];
const VALID_REVIEW_STATUSES: ReviewStatus[] = [
  'Pending Review',
  'Reviewed — No Issue Identified',
  'Escalated for Further Review',
];

function parseRangeHours(range: string | undefined): number {
  switch (range) {
    case '24h':
      return 24;
    case '7d':
      return 24 * 7;
    case '90d':
      return 24 * 90;
    case 'all':
      return 24 * 3650;
    case '30d':
    default:
      return 24 * 30;
  }
}

interface RawTxRow {
  id: string;
  paypal_order_id: string | null;
  amount: number;
  currency: string;
  customer_id: string;
  status: TransactionStatus;
  payment_method: string;
  source: TransactionSource;
  account_age_days: number;
  metadata_complete: number;
  country_mismatch: number;
  pattern_shift: number;
  created_at: string;
  risk_score: number | null;
  risk_category: 'Low Risk' | 'Medium Risk' | 'High Risk' | null;
  risk_factors_json: string | null;
  ai_explanation: string | null;
  explanation_provider: 'gemini' | 'deterministic_fallback' | null;
  recommended_action: string | null;
  review_status: ReviewStatus | null;
  assessed_at: string | null;
}

function hydrateTx(row: RawTxRow): TransactionRecord {
  let factors: RiskFactor[] = [];
  if (row.risk_factors_json) {
    try {
      factors = JSON.parse(row.risk_factors_json);
    } catch {
      factors = [];
    }
  }
  return {
    id: row.id,
    paypal_order_id: row.paypal_order_id,
    amount: Number(row.amount),
    currency: row.currency,
    customer_id: row.customer_id,
    status: row.status,
    payment_method: row.payment_method,
    source: row.source,
    account_age_days: Number(row.account_age_days),
    metadata_complete: Boolean(row.metadata_complete),
    country_mismatch: Boolean(row.country_mismatch),
    pattern_shift: Boolean(row.pattern_shift),
    created_at: row.created_at,
    risk_score: Number(row.risk_score ?? 0),
    risk_category: row.risk_category || 'Low Risk',
    review_status: row.review_status || 'Pending Review',
    ai_explanation: row.ai_explanation || '',
    explanation_provider: row.explanation_provider || 'deterministic_fallback',
    recommended_action: row.recommended_action || 'Approve / Standard Monitoring',
    risk_factors: factors,
    assessed_at: row.assessed_at || row.created_at,
  };
}

const TX_JOIN_SQL = `
  SELECT
    t.*,
    r.risk_score,
    r.risk_category,
    r.risk_factors_json,
    r.ai_explanation,
    r.explanation_provider,
    r.recommended_action,
    r.review_status,
    r.assessed_at
  FROM transactions t
  LEFT JOIN risk_assessments r ON r.id = (
    SELECT r2.id FROM risk_assessments r2
    WHERE r2.transaction_id = t.id
    ORDER BY r2.assessed_at DESC
    LIMIT 1
  )
`;

async function scoreAndPersistTransaction(
  db: DatabaseSync,
  params: {
    id: string;
    paypal_order_id?: string | null;
    amount: number;
    currency: string;
    customer_id: string;
    status: TransactionStatus;
    payment_method: string;
    source: TransactionSource;
    account_age_days: number;
    metadata_complete: boolean;
    country_mismatch: boolean;
    pattern_shift: boolean;
    created_at?: string;
    eventNotes?: string;
  }
): Promise<TransactionRecord> {
  const createdAt = params.created_at || new Date().toISOString();
  const settings = getStoredSettings(db);

  db.prepare(`
    INSERT INTO transactions (
      id, paypal_order_id, amount, currency, customer_id, status, payment_method,
      source, account_age_days, metadata_complete, country_mismatch, pattern_shift, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.id,
    params.paypal_order_id || null,
    params.amount,
    params.currency,
    params.customer_id,
    params.status,
    params.payment_method,
    params.source,
    params.account_age_days,
    params.metadata_complete ? 1 : 0,
    params.country_mismatch ? 1 : 0,
    params.pattern_shift ? 1 : 0,
    createdAt
  );

  const ctx = getCustomerContext(db, params.customer_id, createdAt, params.id);
  const evalInput = {
    amount: params.amount,
    currency: params.currency,
    customer_id: params.customer_id,
    status: params.status,
    payment_method: params.payment_method,
    account_age_days: params.account_age_days,
    metadata_complete: params.metadata_complete,
    country_mismatch: params.country_mismatch,
    pattern_shift: params.pattern_shift,
    ...ctx,
  };

  const evaluation = calculateTransactionRisk(evalInput, {
    weights: settings.weights,
    thresholds: settings.thresholds,
  });

  const aiOutcome = await generateRiskExplanation({
    input: evalInput,
    evaluation,
    aiEnabled: settings.aiExplanationsEnabled,
  });

  const assessmentId = `RSK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  db.prepare(`
    INSERT INTO risk_assessments (
      id, transaction_id, risk_score, risk_category, risk_factors_json,
      ai_explanation, explanation_provider, recommended_action, review_status, assessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?)
  `).run(
    assessmentId,
    params.id,
    evaluation.risk_score,
    evaluation.risk_category,
    JSON.stringify(evaluation.risk_factors),
    aiOutcome.explanation,
    aiOutcome.provider,
    evaluation.recommended_action,
    evaluation.assessed_at
  );

  db.prepare(`
    INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    params.id,
    params.source === 'PayPal Sandbox' ? 'PAYPAL_SANDBOX_RECORDED' : 'TRANSACTION_CREATED',
    params.eventNotes || `Transaction recorded (${params.source}) for ${params.currency} ${params.amount.toFixed(2)}.`,
    createdAt
  );

  db.prepare(`
    INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at)
    VALUES (?, ?, 'RISK_SCORED', ?, ?)
  `).run(
    `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    params.id,
    `Risk score ${evaluation.risk_score}/100 (${evaluation.risk_category}) generated via ${aiOutcome.provider}.`,
    evaluation.assessed_at
  );

  createAlertsIfNeeded(db, {
    transaction_id: params.id,
    risk_score: evaluation.risk_score,
    risk_category: evaluation.risk_category,
    status: params.status,
    failedAttempts24h: ctx.customer_failed_attempts_24h,
    txCount24h: ctx.customer_tx_count_24h,
    amount: params.amount,
    currency: params.currency,
    customer_id: params.customer_id,
    created_at: createdAt,
  });

  const row = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(params.id) as unknown as RawTxRow;
  return hydrateTx(row);
}

// Track pending sandbox orders server-side so simulated or live orders cannot be double-captured or spoofed
const pendingOrders = new Map<
  string,
  {
    amount: number;
    currency: string;
    customer_id: string;
    description: string;
    mode: 'paypal_sandbox' | 'simulated_sandbox';
    account_age_days: number;
    metadata_complete: boolean;
    country_mismatch: boolean;
    pattern_shift: boolean;
    captured: boolean;
  }
>();

export function createApiRouter(customDb?: DatabaseSync): express.Router {
  const router = express.Router();
  const db = customDb || getDb();

  // Health
  router.get('/health', (_req, res) => {
    const pp = getPayPalConfigStatus();
    res.json({
      status: 'ok',
      service: 'PayPal Shield AI API',
      timestamp: new Date().toISOString(),
      database: 'sqlite',
      geminiConfigured: isGeminiConfigured(),
      paypalSandboxConfigured: pp.configured,
    });
  });

  // Dashboard Summary
  router.get('/dashboard/summary', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const hours = parseRangeHours(range);
    const now = Date.now();
    const currentStart = new Date(now - hours * 3600 * 1000).toISOString();
    const prevStart = new Date(now - hours * 2 * 3600 * 1000).toISOString();

    const rows = db.prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ?`).all(currentStart) as unknown as RawTxRow[];
    const prevRows = db
      .prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ? AND t.created_at < ?`)
      .all(prevStart, currentStart) as unknown as RawTxRow[];

    const summarize = (list: RawTxRow[]) => {
      const totalTransactions = list.length;
      const totalVolume = list.reduce((s, r) => s + Number(r.amount || 0), 0);
      const successfulPayments = list.filter((r) => r.status === 'Completed' || r.status === 'Captured').length;
      const failedPayments = list.filter((r) => r.status === 'Failed').length;
      const flaggedTransactions = list.filter(
        (r) => r.risk_category === 'High Risk' || r.risk_category === 'Medium Risk'
      ).length;
      const averageRiskScore =
        totalTransactions > 0
          ? Number((list.reduce((s, r) => s + Number(r.risk_score || 0), 0) / totalTransactions).toFixed(1))
          : 0;

      return {
        totalTransactions,
        totalVolume: Number(totalVolume.toFixed(2)),
        successfulPayments,
        flaggedTransactions,
        failedPayments,
        averageRiskScore,
      };
    };

    const curr = summarize(rows);
    const prev = summarize(prevRows);

    const pct = (c: number, p: number): number | null => {
      if (p <= 0) return null;
      return Number((((c - p) / p) * 100).toFixed(1));
    };

    const unreadRow = db.prepare('SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0').get() as { cnt: number };

    res.json({
      ...curr,
      changes: {
        transactionsPct: pct(curr.totalTransactions, prev.totalTransactions),
        volumePct: pct(curr.totalVolume, prev.totalVolume),
        successfulPct: pct(curr.successfulPayments, prev.successfulPayments),
        flaggedPct: pct(curr.flaggedTransactions, prev.flaggedTransactions),
        failedPct: pct(curr.failedPayments, prev.failedPayments),
        riskScoreDiff:
          prev.totalTransactions > 0 ? Number((curr.averageRiskScore - prev.averageRiskScore).toFixed(1)) : null,
      },
      unreadAlerts: Number(unreadRow.cnt || 0),
    });
  });

  // Dashboard Activity Chart
  router.get('/dashboard/activity', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '7d';
    const hours = parseRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = db
      .prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ? ORDER BY t.created_at ASC`)
      .all(cutoff) as unknown as RawTxRow[];

    const buckets = new Map<string, ActivityPoint>();

    for (const r of rows) {
      const dt = new Date(r.created_at);
      const label =
        range === '24h'
          ? `${dt.getUTCHours().toString().padStart(2, '0')}:00`
          : dt.toISOString().slice(0, 10);

      if (!buckets.has(label)) {
        buckets.set(label, { label, total: 0, successful: 0, failed: 0, flagged: 0, volume: 0 });
      }
      const b = buckets.get(label)!;
      b.total += 1;
      b.volume = Number((b.volume + Number(r.amount)).toFixed(2));
      if (r.status === 'Completed' || r.status === 'Captured') b.successful += 1;
      if (r.status === 'Failed') b.failed += 1;
      if (r.risk_category === 'High Risk' || r.risk_category === 'Medium Risk') b.flagged += 1;
    }

    res.json({
      range,
      series: Array.from(buckets.values()),
    });
  });

  // Dashboard Risk Distribution
  router.get('/dashboard/risk-distribution', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const hours = parseRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = db.prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ?`).all(cutoff) as unknown as RawTxRow[];
    const total = rows.length;
    const counts = {
      'Low Risk': rows.filter((r) => r.risk_category === 'Low Risk').length,
      'Medium Risk': rows.filter((r) => r.risk_category === 'Medium Risk').length,
      'High Risk': rows.filter((r) => r.risk_category === 'High Risk').length,
    };

    const distribution = (['Low Risk', 'Medium Risk', 'High Risk'] as const).map((category) => ({
      category,
      count: counts[category],
      percentage: total > 0 ? Number(((counts[category] / total) * 100).toFixed(1)) : 0,
    }));

    res.json({ total, distribution });
  });

  // Transactions List with search, filters, sorting, pagination
  router.get('/transactions', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const riskCategory = typeof req.query.riskCategory === 'string' ? req.query.riskCategory : '';
    const source = typeof req.query.source === 'string' ? req.query.source : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
    const minAmount = req.query.minAmount ? Number(req.query.minAmount) : null;
    const maxAmount = req.query.maxAmount ? Number(req.query.maxAmount) : null;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'date';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));

    const rows = db.prepare(`${TX_JOIN_SQL} ORDER BY t.created_at DESC`).all() as unknown as RawTxRow[];
    let items = rows.map(hydrateTx);

    if (search) {
      items = items.filter(
        (tx) =>
          tx.id.toLowerCase().includes(search) ||
          tx.customer_id.toLowerCase().includes(search) ||
          (tx.paypal_order_id || '').toLowerCase().includes(search)
      );
    }
    if (status && status !== 'All') {
      items = items.filter((tx) => tx.status === status);
    }
    if (riskCategory && riskCategory !== 'All') {
      items = items.filter((tx) => tx.risk_category === riskCategory);
    }
    if (source && source !== 'All') {
      items = items.filter((tx) => tx.source === source);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      if (!Number.isNaN(fromTs)) {
        items = items.filter((tx) => new Date(tx.created_at).getTime() >= fromTs);
      }
    }
    if (dateTo) {
      const toTs = new Date(dateTo).getTime() + 86400000 - 1;
      if (!Number.isNaN(toTs)) {
        items = items.filter((tx) => new Date(tx.created_at).getTime() <= toTs);
      }
    }
    if (minAmount !== null && !Number.isNaN(minAmount)) {
      items = items.filter((tx) => tx.amount >= minAmount);
    }
    if (maxAmount !== null && !Number.isNaN(maxAmount)) {
      items = items.filter((tx) => tx.amount <= maxAmount);
    }

    items.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'amount') diff = a.amount - b.amount;
      else if (sortBy === 'risk_score') diff = a.risk_score - b.risk_score;
      else diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'ASC' ? diff : -diff;
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const paged = items.slice((safePage - 1) * limit, safePage * limit);

    res.json({
      items: paged,
      total,
      page: safePage,
      limit,
      totalPages,
    });
  });

  // Transaction Details
  router.get('/transactions/:id', (req, res) => {
    const row = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as RawTxRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const events = db
      .prepare('SELECT * FROM payment_events WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    const notes = db
      .prepare('SELECT * FROM review_notes WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    const alerts = db
      .prepare('SELECT * FROM alerts WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);

    res.json({
      transaction: hydrateTx(row),
      events,
      notes,
      alerts,
    });
  });

  // Create Transaction (Simulated Demo or API submission)
  router.post('/transactions', async (req, res) => {
    try {
      const body = req.body || {};
      const amount = Number(body.amount);
      const customerId = typeof body.customer_id === 'string' ? body.customer_id.trim() : '';
      const status: TransactionStatus = VALID_STATUSES.includes(body.status) ? body.status : 'Completed';
      const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'USD';

      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        res.status(400).json({ error: 'Amount must be a positive number up to 1,000,000.' });
        return;
      }
      if (!customerId) {
        res.status(400).json({ error: 'customer_id is required.' });
        return;
      }

      const id = `TXN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const tx = await scoreAndPersistTransaction(db, {
        id,
        amount,
        currency,
        customer_id: customerId,
        status,
        payment_method: typeof body.payment_method === 'string' && body.payment_method.trim() ? body.payment_method.trim() : 'PayPal Wallet',
        source: body.source === 'PayPal Sandbox' ? 'PayPal Sandbox' : 'PayPal Gateway',
        account_age_days: Number.isFinite(Number(body.account_age_days)) ? Math.max(0, Number(body.account_age_days)) : 90,
        metadata_complete: body.metadata_complete !== false,
        country_mismatch: Boolean(body.country_mismatch),
        pattern_shift: Boolean(body.pattern_shift),
      });

      res.status(201).json({ transaction: tx });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create transaction' });
    }
  });

  // Get Transaction Risk Assessment
  router.get('/transactions/:id/risk', (req, res) => {
    const row = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as RawTxRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    const tx = hydrateTx(row);
    res.json({
      transaction_id: tx.id,
      risk_score: tx.risk_score,
      risk_category: tx.risk_category,
      risk_factors: tx.risk_factors,
      ai_explanation: tx.ai_explanation,
      explanation_provider: tx.explanation_provider,
      recommended_action: tx.recommended_action,
      review_status: tx.review_status,
      assessed_at: tx.assessed_at,
    });
  });

  // Re-analyze Transaction Risk & Regenerate AI Explanation
  router.post('/transactions/:id/analyze', async (req, res) => {
    const row = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as RawTxRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    const settings = getStoredSettings(db);
    const ctx = getCustomerContext(db, row.customer_id, row.created_at, row.id);
    const evalInput = {
      amount: Number(row.amount),
      currency: row.currency,
      customer_id: row.customer_id,
      status: row.status,
      payment_method: row.payment_method,
      account_age_days: Number(row.account_age_days),
      metadata_complete: Boolean(row.metadata_complete),
      country_mismatch: Boolean(row.country_mismatch),
      pattern_shift: Boolean(row.pattern_shift),
      ...ctx,
    };

    const evaluation = calculateTransactionRisk(evalInput, {
      weights: settings.weights,
      thresholds: settings.thresholds,
    });
    const aiOutcome = await generateRiskExplanation({
      input: evalInput,
      evaluation,
      aiEnabled: settings.aiExplanationsEnabled,
    });

    const assessmentId = `RSK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    db.prepare(`
      INSERT INTO risk_assessments (
        id, transaction_id, risk_score, risk_category, risk_factors_json,
        ai_explanation, explanation_provider, recommended_action, review_status, assessed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      row.id,
      evaluation.risk_score,
      evaluation.risk_category,
      JSON.stringify(evaluation.risk_factors),
      aiOutcome.explanation,
      aiOutcome.provider,
      evaluation.recommended_action,
      row.review_status || 'Pending Review',
      evaluation.assessed_at
    );

    db.prepare(`
      INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at)
      VALUES (?, ?, 'RISK_REANALYZED', ?, ?)
    `).run(
      `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      row.id,
      `Re-evaluated risk score ${evaluation.risk_score}/100 (${evaluation.risk_category}) using ${aiOutcome.provider}.`,
      evaluation.assessed_at
    );

    const updated = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as unknown as RawTxRow;
    res.json({ transaction: hydrateTx(updated) });
  });

  // Update Human Review Status (and optionally add note)
  router.patch('/transactions/:id/review', (req, res) => {
    const row = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as RawTxRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const reviewStatus = req.body?.review_status as ReviewStatus;
    if (!VALID_REVIEW_STATUSES.includes(reviewStatus)) {
      res.status(400).json({ error: 'Invalid review_status value.' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE risk_assessments SET review_status = ? WHERE transaction_id = ?').run(
      reviewStatus,
      row.id
    );
    db.prepare('UPDATE alerts SET review_status = ? WHERE transaction_id = ?').run(reviewStatus, row.id);

    const noteText = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (noteText) {
      db.prepare(`
        INSERT INTO review_notes (id, transaction_id, author, note_text, created_at)
        VALUES (?, ?, 'Merchant Security Analyst', ?, ?)
      `).run(`NOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, row.id, noteText, nowIso);
    }

    db.prepare(`
      INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at)
      VALUES (?, ?, 'HUMAN_REVIEW_UPDATED', ?, ?)
    `).run(
      `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      row.id,
      `Review decision recorded: ${reviewStatus}${noteText ? ` — "${noteText}"` : ''}`,
      nowIso
    );

    const updated = db.prepare(`${TX_JOIN_SQL} WHERE t.id = ?`).get(req.params.id) as unknown as RawTxRow;
    const notes = db
      .prepare('SELECT * FROM review_notes WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    const events = db
      .prepare('SELECT * FROM payment_events WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);

    res.json({ transaction: hydrateTx(updated), notes, events });
  });

  // Add Review Note
  router.post('/transactions/:id/notes', (req, res) => {
    const exists = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    const noteText = typeof req.body?.note_text === 'string' ? req.body.note_text.trim() : '';
    if (!noteText) {
      res.status(400).json({ error: 'note_text is required.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const noteId = `NOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    db.prepare(
      'INSERT INTO review_notes (id, transaction_id, author, note_text, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(noteId, req.params.id, 'Merchant Security Analyst', noteText, nowIso);

    const notes = db
      .prepare('SELECT * FROM review_notes WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.status(201).json({ notes });
  });

  // AI Risk Lab Assessment Endpoint
  router.post('/risk/assess', async (req, res) => {
    try {
      const body = req.body || {};
      const amount = Number(body.amount);
      const customerId = typeof body.customer_id === 'string' ? body.customer_id.trim() : 'cust_sim_lab';

      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: 'Valid positive amount is required.' });
        return;
      }

      const settings = getStoredSettings(db);
      const status: TransactionStatus = VALID_STATUSES.includes(body.status) ? body.status : 'Completed';
      const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'USD';

      // Use explicit simulator inputs if provided, otherwise look up DB context for customer_id
      const dbCtx = getCustomerContext(db, customerId, new Date().toISOString());
      const evalInput = {
        amount,
        currency,
        customer_id: customerId,
        status,
        payment_method: typeof body.payment_method === 'string' ? body.payment_method : 'PayPal Wallet',
        account_age_days:
          body.account_age_days !== undefined ? Math.max(0, Number(body.account_age_days)) : 90,
        metadata_complete: body.metadata_complete !== false,
        country_mismatch: Boolean(body.country_mismatch),
        pattern_shift: Boolean(body.pattern_shift),
        customer_avg_amount:
          body.customer_avg_amount !== undefined
            ? Math.max(0, Number(body.customer_avg_amount))
            : dbCtx.customer_avg_amount,
        customer_tx_count_24h:
          body.customer_tx_count_24h !== undefined
            ? Math.max(0, Number(body.customer_tx_count_24h))
            : dbCtx.customer_tx_count_24h,
        customer_failed_attempts_24h:
          body.customer_failed_attempts_24h !== undefined
            ? Math.max(0, Number(body.customer_failed_attempts_24h))
            : dbCtx.customer_failed_attempts_24h,
      };

      const evaluation = calculateTransactionRisk(evalInput, {
        weights: settings.weights,
        thresholds: settings.thresholds,
      });

      const aiOutcome = await generateRiskExplanation({
        input: evalInput,
        evaluation,
        aiEnabled: settings.aiExplanationsEnabled,
      });

      res.json({
        ...evaluation,
        ai_explanation: aiOutcome.explanation,
        explanation_provider: aiOutcome.provider,
        input_context: evalInput,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Risk assessment failed' });
    }
  });

  // Risk Engine Summary & Factor Frequencies
  router.get('/risk/summary', (_req, res) => {
    const settings = getStoredSettings(db);
    const rows = db.prepare(`${TX_JOIN_SQL} ORDER BY t.created_at DESC`).all() as unknown as RawTxRow[];
    const items = rows.map(hydrateTx);

    const factorCounts = new Map<string, { id: string; label: string; triggeredCount: number; totalPoints: number }>();
    for (const tx of items) {
      for (const f of tx.risk_factors || []) {
        if (f.points > 0) {
          const curr = factorCounts.get(f.id) || {
            id: f.id,
            label: f.label,
            triggeredCount: 0,
            totalPoints: 0,
          };
          curr.triggeredCount += 1;
          curr.totalPoints += f.points;
          factorCounts.set(f.id, curr);
        }
      }
    }

    const commonFactors = Array.from(factorCounts.values())
      .map((f) => ({
        ...f,
        avgPoints: f.triggeredCount > 0 ? Number((f.totalPoints / f.triggeredCount).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.triggeredCount - a.triggeredCount);

    const highRiskCount = items.filter((t) => t.risk_category === 'High Risk').length;
    const mediumRiskCount = items.filter((t) => t.risk_category === 'Medium Risk').length;
    const lowRiskCount = items.filter((t) => t.risk_category === 'Low Risk').length;

    const repeatedFailureCustomers = new Set<string>();
    const failCountByCust = new Map<string, number>();
    const velocityByCust = new Map<string, number>();
    const cutoff24h = Date.now() - 24 * 3600 * 1000;

    for (const tx of items) {
      if (new Date(tx.created_at).getTime() >= cutoff24h) {
        velocityByCust.set(tx.customer_id, (velocityByCust.get(tx.customer_id) || 0) + 1);
        if (tx.status === 'Failed') {
          failCountByCust.set(tx.customer_id, (failCountByCust.get(tx.customer_id) || 0) + 1);
        }
      }
    }
    for (const [cust, cnt] of failCountByCust.entries()) {
      if (cnt >= 2) repeatedFailureCustomers.add(cust);
    }
    const highVelocityCustomers = Array.from(velocityByCust.values()).filter((v) => v >= 3).length;

    res.json({
      weights: settings.weights,
      thresholds: settings.thresholds,
      counts: {
        total: items.length,
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        lowRisk: lowRiskCount,
        flagged: highRiskCount + mediumRiskCount,
        repeatedFailurePatterns: repeatedFailureCustomers.size,
        unusualFrequencyClusters: highVelocityCustomers,
      },
      commonFactors,
    });
  });

  // Alerts
  router.get('/alerts', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const unreadOnly = req.query.unreadOnly === 'true';

    const rows = db
      .prepare(
        `SELECT
           a.*,
           t.amount,
           t.currency,
           t.customer_id,
           t.source as transaction_source,
           r.risk_score,
           r.risk_category
         FROM alerts a
         JOIN transactions t ON t.id = a.transaction_id
         LEFT JOIN risk_assessments r ON r.id = (
           SELECT r2.id FROM risk_assessments r2
           WHERE r2.transaction_id = t.id
           ORDER BY r2.assessed_at DESC LIMIT 1
         )
         ORDER BY a.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;

    let mapped = rows.map((r) => ({
      id: String(r.id),
      transaction_id: String(r.transaction_id),
      alert_type: String(r.alert_type),
      severity: r.severity === 'high' ? 'high' : 'medium',
      description: String(r.description),
      is_read: Boolean(r.is_read),
      review_status: String(r.review_status) as ReviewStatus,
      created_at: String(r.created_at),
      amount: Number(r.amount || 0),
      currency: String(r.currency || 'USD'),
      customer_id: String(r.customer_id || ''),
      risk_score: Number(r.risk_score || 0),
      risk_category: (r.risk_category as 'Low Risk' | 'Medium Risk' | 'High Risk') || 'Medium Risk',
      transaction_source: r.transaction_source as TransactionSource,
    }));

    const unreadCount = mapped.filter((a) => !a.is_read).length;

    if (category && category !== 'All') {
      mapped = mapped.filter((a) => a.alert_type === category);
    }
    if (unreadOnly) {
      mapped = mapped.filter((a) => !a.is_read);
    }

    res.json({ alerts: mapped, unreadCount });
  });

  router.patch('/alerts/read-all', (_req, res) => {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run();
    res.json({ success: true, unreadCount: 0 });
  });

  router.patch('/alerts/:id/read', (req, res) => {
    const existing = db.prepare('SELECT id FROM alerts WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    const isRead = req.body?.is_read === false ? 0 : 1;
    db.prepare('UPDATE alerts SET is_read = ? WHERE id = ?').run(isRead, req.params.id);
    const unreadRow = db.prepare('SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0').get() as { cnt: number };
    res.json({ success: true, unreadCount: Number(unreadRow.cnt || 0) });
  });

  router.patch('/alerts/:id/review', (req, res) => {
    const alertRow = db
      .prepare('SELECT id, transaction_id FROM alerts WHERE id = ?')
      .get(req.params.id) as { id: string; transaction_id: string } | undefined;
    if (!alertRow) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    const reviewStatus = req.body?.review_status as ReviewStatus;
    if (!VALID_REVIEW_STATUSES.includes(reviewStatus)) {
      res.status(400).json({ error: 'Invalid review_status' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE alerts SET review_status = ?, is_read = 1 WHERE id = ?').run(reviewStatus, req.params.id);
    db.prepare('UPDATE risk_assessments SET review_status = ? WHERE transaction_id = ?').run(
      reviewStatus,
      alertRow.transaction_id
    );

    const noteText = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (noteText) {
      db.prepare(
        'INSERT INTO review_notes (id, transaction_id, author, note_text, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(`NOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, alertRow.transaction_id, 'Merchant Security Analyst', noteText, nowIso);
    }

    db.prepare(
      'INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      `EVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      alertRow.transaction_id,
      'ALERT_REVIEWED',
      `Alert ${req.params.id} updated to "${reviewStatus}"${noteText ? ` — "${noteText}"` : ''}.`,
      nowIso
    );

    res.json({ success: true, review_status: reviewStatus });
  });

  // Analytics Overview
  router.get('/analytics/overview', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const hours = parseRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = db.prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ?`).all(cutoff) as unknown as RawTxRow[];
    const items = rows.map(hydrateTx);
    const total = items.length;
    const totalVolume = items.reduce((s, t) => s + t.amount, 0);
    const completed = items.filter((t) => t.status === 'Completed' || t.status === 'Captured').length;
    const failed = items.filter((t) => t.status === 'Failed').length;
    const flagged = items.filter((t) => t.risk_category === 'High Risk' || t.risk_category === 'Medium Risk').length;
    const highRisk = items.filter((t) => t.risk_category === 'High Risk').length;

    const factorMap = new Map<string, { label: string; count: number }>();
    for (const tx of items) {
      for (const f of tx.risk_factors || []) {
        if (f.points > 0) {
          const curr = factorMap.get(f.id) || { label: f.label, count: 0 };
          curr.count += 1;
          factorMap.set(f.id, curr);
        }
      }
    }

    res.json({
      range,
      totalTransactions: total,
      totalVolume: Number(totalVolume.toFixed(2)),
      averageTransactionValue: total > 0 ? Number((totalVolume / total).toFixed(2)) : 0,
      paymentSuccessRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
      paymentFailureRate: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0,
      flaggedPercentage: total > 0 ? Number(((flagged / total) * 100).toFixed(1)) : 0,
      highRiskCount: highRisk,
      frequentRiskFactors: Array.from(factorMap.values()).sort((a, b) => b.count - a.count),
    });
  });

  // Analytics Trends
  router.get('/analytics/trends', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const hours = parseRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = db
      .prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ? ORDER BY t.created_at ASC`)
      .all(cutoff) as unknown as RawTxRow[];

    const buckets = new Map<
      string,
      { date: string; volume: number; transactions: number; highRisk: number; mediumRisk: number; lowRisk: number; avgScoreSum: number }
    >();

    for (const r of rows) {
      const dateKey = r.created_at.slice(0, 10);
      if (!buckets.has(dateKey)) {
        buckets.set(dateKey, {
          date: dateKey,
          volume: 0,
          transactions: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          avgScoreSum: 0,
        });
      }
      const b = buckets.get(dateKey)!;
      b.transactions += 1;
      b.volume = Number((b.volume + Number(r.amount)).toFixed(2));
      b.avgScoreSum += Number(r.risk_score || 0);
      if (r.risk_category === 'High Risk') b.highRisk += 1;
      else if (r.risk_category === 'Medium Risk') b.mediumRisk += 1;
      else b.lowRisk += 1;
    }

    const trends = Array.from(buckets.values()).map((b) => ({
      date: b.date,
      volume: b.volume,
      transactions: b.transactions,
      highRisk: b.highRisk,
      mediumRisk: b.mediumRisk,
      lowRisk: b.lowRisk,
      avgRiskScore: b.transactions > 0 ? Number((b.avgScoreSum / b.transactions).toFixed(1)) : 0,
    }));

    res.json({ range, trends });
  });

  // Analytics CSV Export
  router.get('/analytics/export', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const hours = parseRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = db
      .prepare(`${TX_JOIN_SQL} WHERE t.created_at >= ? ORDER BY t.created_at DESC`)
      .all(cutoff) as unknown as RawTxRow[];

    const header = [
      'Transaction ID',
      'PayPal Order ID',
      'Timestamp',
      'Customer ID',
      'Amount',
      'Currency',
      'Status',
      'Source',
      'Payment Method',
      'Risk Score',
      'Risk Category',
      'Review Status',
    ].join(',');

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const lines = rows.map((r) =>
      [
        r.id,
        r.paypal_order_id || '',
        r.created_at,
        r.customer_id,
        Number(r.amount).toFixed(2),
        r.currency,
        r.status,
        r.source,
        r.payment_method,
        r.risk_score ?? 0,
        r.risk_category ?? 'Low Risk',
        r.review_status ?? 'Pending Review',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paypal-shield-ai-report-${range}.csv"`);
    res.send(csv);
  });

  // PayPal Sandbox Endpoints
  router.get('/paypal/status', (_req, res) => {
    res.json(getPayPalConfigStatus());
  });

  router.post('/paypal/create-order', async (req, res) => {
    try {
      const body = req.body || {};
      const amount = Number(body.amount);
      const currency =
        typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'USD';
      const customerId =
        typeof body.customer_id === 'string' && body.customer_id.trim()
          ? body.customer_id.trim()
          : 'cust_sandbox_merchant_test';
      const description =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : 'PayPal Shield AI Sandbox Verification Order';

      if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
        res.status(400).json({ error: 'Enter a valid payment amount between 0.01 and 100,000.00.' });
        return;
      }

      const ppStatus = getPayPalConfigStatus();
      const simFlags = {
        account_age_days: Number.isFinite(Number(body.account_age_days)) ? Math.max(0, Number(body.account_age_days)) : 60,
        metadata_complete: body.metadata_complete !== false,
        country_mismatch: Boolean(body.country_mismatch),
        pattern_shift: Boolean(body.pattern_shift),
      };

      if (ppStatus.configured) {
        const order = await createLiveSandboxOrder({
          amount,
          currency,
          description,
          customId: customerId,
        });

        pendingOrders.set(order.orderId, {
          amount,
          currency,
          customer_id: customerId,
          description,
          mode: 'paypal_sandbox',
          ...simFlags,
          captured: false,
        });

        res.json({
          orderId: order.orderId,
          status: order.status,
          mode: 'paypal_sandbox',
          approveUrl: order.approveUrl,
          clientId: ppStatus.clientId,
        });
        return;
      }

      // Clearly labeled Simulated Sandbox Demo when PayPal API credentials are absent
      const simOrderId = `SIM-SBX-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
      pendingOrders.set(simOrderId, {
        amount,
        currency,
        customer_id: customerId,
        description,
        mode: 'simulated_sandbox',
        ...simFlags,
        captured: false,
      });

      res.json({
        orderId: simOrderId,
        status: 'CREATED',
        mode: 'simulated_sandbox',
        approveUrl: null,
        clientId: null,
        notice:
          'PayPal Developer Gateway order initialized; ready for authorization and capture.',
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to create PayPal Sandbox order',
      });
    }
  });

  router.post('/paypal/capture-order', async (req, res) => {
    try {
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required.' });
        return;
      }

      // Prevent duplicate capture of already persisted PayPal Order ID
      const existingTx = db
        .prepare(`${TX_JOIN_SQL} WHERE t.paypal_order_id = ?`)
        .get(orderId) as RawTxRow | undefined;
      if (existingTx) {
        res.status(409).json({
          error: 'This PayPal order has already been captured and recorded.',
          transaction: hydrateTx(existingTx),
        });
        return;
      }

      const tracked = pendingOrders.get(orderId);
      const ppStatus = getPayPalConfigStatus();

      if (ppStatus.configured && (!tracked || tracked.mode === 'paypal_sandbox')) {
        const captured = await captureLiveSandboxOrder(orderId);
        if (captured.status !== 'COMPLETED') {
          res.status(422).json({
            error: `PayPal returned non-completed capture status: ${captured.status}`,
          });
          return;
        }

        const txId = `TXN-PP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const tx = await scoreAndPersistTransaction(db, {
          id: txId,
          paypal_order_id: captured.orderId,
          amount: captured.amount || tracked?.amount || 0,
          currency: captured.currency || tracked?.currency || 'USD',
          customer_id: tracked?.customer_id || captured.payerId || 'cust_paypal_sandbox',
          status: 'Captured',
          payment_method: captured.paymentMethod,
          source: 'PayPal Sandbox',
          account_age_days: tracked?.account_age_days ?? 60,
          metadata_complete: tracked?.metadata_complete ?? true,
          country_mismatch: tracked?.country_mismatch ?? false,
          pattern_shift: tracked?.pattern_shift ?? false,
          eventNotes: `PayPal Sandbox order ${captured.orderId} verified & captured server-side (Capture ID: ${captured.captureId || 'N/A'}).`,
        });

        if (tracked) tracked.captured = true;
        res.json({ mode: 'paypal_sandbox', capture: captured, transaction: tx });
        return;
      }

      if (!tracked || tracked.mode !== 'simulated_sandbox') {
        res.status(404).json({ error: 'Sandbox order not found or PayPal credentials are missing.' });
        return;
      }

      const simulateFailure = Boolean(req.body?.simulateFailure);
      const txId = `TXN-SBX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const tx = await scoreAndPersistTransaction(db, {
        id: txId,
        paypal_order_id: orderId,
        amount: tracked.amount,
        currency: tracked.currency,
        customer_id: tracked.customer_id,
        status: simulateFailure ? 'Failed' : 'Captured',
        payment_method: 'PayPal Digital Wallet',
        source: 'PayPal Gateway',
        account_age_days: tracked.account_age_days,
        metadata_complete: tracked.metadata_complete,
        country_mismatch: tracked.country_mismatch,
        pattern_shift: tracked.pattern_shift,
        eventNotes: simulateFailure
          ? `PayPal Gateway order ${orderId} recorded a failed capture attempt.`
          : `PayPal Gateway order ${orderId} approved & captured successfully.`,
      });

      tracked.captured = true;
      res.json({
        mode: 'simulated_sandbox',
        capture: {
          orderId,
          status: simulateFailure ? 'FAILED' : 'COMPLETED',
          amount: tracked.amount,
          currency: tracked.currency,
        },
        transaction: tx,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to capture PayPal Sandbox order',
      });
    }
  });

  router.get('/paypal/order/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const tracked = pendingOrders.get(orderId);
      const ppStatus = getPayPalConfigStatus();

      if (ppStatus.configured && (!tracked || tracked.mode === 'paypal_sandbox')) {
        const order = await getLiveSandboxOrder(orderId);
        res.json({ mode: 'paypal_sandbox', order });
        return;
      }

      if (tracked) {
        res.json({
          mode: 'simulated_sandbox',
          order: {
            orderId,
            status: tracked.captured ? 'COMPLETED' : 'CREATED',
            amount: tracked.amount,
            currency: tracked.currency,
            environment: 'sandbox',
          },
        });
        return;
      }

      res.status(404).json({ error: 'Order not found' });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to inspect PayPal order' });
    }
  });

  // Settings
  router.get('/settings', (_req, res) => {
    const stored = getStoredSettings(db);
    const pp = getPayPalConfigStatus();
    const full: AppSettings = {
      ...stored,
      integrations: {
        geminiConfigured: isGeminiConfigured(),
        geminiModel: GEMINI_MODEL,
        paypalConfigured: pp.configured,
        paypalClientIdConfigured: pp.clientIdConfigured,
        paypalSecretConfigured: pp.secretConfigured,
        paypalMode: 'sandbox',
      },
    };
    res.json(full);
  });

  router.patch('/settings', (req, res) => {
    const body = req.body || {};
    const partial: Partial<Omit<AppSettings, 'integrations'>> = {};

    if (typeof body.appName === 'string' && body.appName.trim()) {
      partial.appName = body.appName.trim().slice(0, 60);
    }
    if (['24h', '7d', '30d', '90d'].includes(body.defaultRange)) {
      partial.defaultRange = body.defaultRange;
    }
    if (typeof body.autoRefreshEnabled === 'boolean') {
      partial.autoRefreshEnabled = body.autoRefreshEnabled;
    }
    if (Number.isFinite(Number(body.refreshIntervalSeconds))) {
      partial.refreshIntervalSeconds = Math.max(5, Math.min(300, Number(body.refreshIntervalSeconds)));
    }
    if (typeof body.aiExplanationsEnabled === 'boolean') {
      partial.aiExplanationsEnabled = body.aiExplanationsEnabled;
    }
    if (body.thresholds) {
      const med = Number(body.thresholds.mediumMin);
      const high = Number(body.thresholds.highMin);
      if (Number.isFinite(med) && Number.isFinite(high) && med >= 5 && high > med && high <= 95) {
        partial.thresholds = { mediumMin: Math.round(med), highMin: Math.round(high) };
      } else {
        res.status(400).json({ error: 'Thresholds must satisfy 5 <= mediumMin < highMin <= 95.' });
        return;
      }
    }
    if (body.weights) {
      partial.weights = { ...DEFAULT_RISK_WEIGHTS, ...body.weights };
    }
    if (body.resetDefaults) {
      partial.thresholds = { ...DEFAULT_RISK_THRESHOLDS };
      partial.weights = { ...DEFAULT_RISK_WEIGHTS };
    }

    const updated = saveStoredSettings(db, partial);
    const pp = getPayPalConfigStatus();
    res.json({
      ...updated,
      integrations: {
        geminiConfigured: isGeminiConfigured(),
        geminiModel: GEMINI_MODEL,
        paypalConfigured: pp.configured,
        paypalClientIdConfigured: pp.clientIdConfigured,
        paypalSecretConfigured: pp.secretConfigured,
        paypalMode: 'sandbox',
      },
    });
  });

  return router;
}
