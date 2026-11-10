import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateTransactionRisk,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_RISK_WEIGHTS,
} from '../src/lib/riskEngine';
import type {
  AppSettings,
  RiskEngineConfig,
  RiskThresholds,
  RiskWeights,
  TransactionSource,
  TransactionStatus,
} from '../src/types';

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  const configured = process.env.DATABASE_PATH || './data/paypal_shield.db';
  return path.resolve(process.cwd(), configured);
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initializeSchema(db);
  seedDemoDataIfEmpty(db);

  dbInstance = db;
  return db;
}

export function resetDbForTests(memoryPath = ':memory:'): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors
    }
    dbInstance = null;
  }
  const db = new DatabaseSync(memoryPath);
  db.exec('PRAGMA foreign_keys = ON;');
  initializeSchema(db);
  seedDemoDataIfEmpty(db);
  dbInstance = db;
  return db;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      paypal_order_id TEXT UNIQUE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'PayPal Wallet',
      source TEXT NOT NULL DEFAULT 'PayPal Gateway',
      account_age_days INTEGER NOT NULL DEFAULT 90,
      metadata_complete INTEGER NOT NULL DEFAULT 1,
      country_mismatch INTEGER NOT NULL DEFAULT 0,
      pattern_shift INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      risk_category TEXT NOT NULL,
      risk_factors_json TEXT NOT NULL,
      ai_explanation TEXT NOT NULL,
      explanation_provider TEXT NOT NULL DEFAULT 'deterministic_fallback',
      recommended_action TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'Pending Review',
      assessed_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_risk_tx ON risk_assessments(transaction_id);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'Pending Review',
      created_at TEXT NOT NULL,
      UNIQUE(transaction_id, alert_type),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_notes (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Risk Analyst',
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_details TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getStoredSettings(db: DatabaseSync): Omit<AppSettings, 'integrations'> {
  const row = db
    .prepare("SELECT value_json FROM app_settings WHERE key = 'config'")
    .get() as { value_json?: string } | undefined;

  const defaults: Omit<AppSettings, 'integrations'> = {
    appName: 'PayPal Shield AI',
    defaultRange: '30d',
    autoRefreshEnabled: true,
    refreshIntervalSeconds: 15,
    aiExplanationsEnabled: true,
    thresholds: { ...DEFAULT_RISK_THRESHOLDS },
    weights: { ...DEFAULT_RISK_WEIGHTS },
  };

  if (!row?.value_json) return defaults;

  try {
    const parsed = JSON.parse(row.value_json);
    return {
      ...defaults,
      ...parsed,
      thresholds: { ...defaults.thresholds, ...(parsed.thresholds || {}) },
      weights: { ...defaults.weights, ...(parsed.weights || {}) },
    };
  } catch {
    return defaults;
  }
}

export function saveStoredSettings(
  db: DatabaseSync,
  partial: Partial<Omit<AppSettings, 'integrations'>>
): Omit<AppSettings, 'integrations'> {
  const current = getStoredSettings(db);
  const next: Omit<AppSettings, 'integrations'> = {
    ...current,
    ...partial,
    thresholds: {
      ...current.thresholds,
      ...(partial.thresholds || ({} as RiskThresholds)),
    },
    weights: {
      ...current.weights,
      ...(partial.weights || ({} as RiskWeights)),
    },
  };

  db.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at)
     VALUES ('config', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run(JSON.stringify(next), new Date().toISOString());

  return next;
}

export function getCustomerContext(
  db: DatabaseSync,
  customerId: string,
  referenceIso: string,
  excludeTxId?: string
): {
  customer_avg_amount: number;
  customer_tx_count_24h: number;
  customer_failed_attempts_24h: number;
} {
  const refTime = new Date(referenceIso).getTime();
  const windowStart = new Date(refTime - 24 * 60 * 60 * 1000).toISOString();

  const avgRow = db
    .prepare(
      `SELECT AVG(amount) as avg_amt
       FROM transactions
       WHERE customer_id = ? AND id != ? AND status IN ('Completed', 'Captured')`
    )
    .get(customerId, excludeTxId || '') as { avg_amt: number | null } | undefined;

  const recentCounts = db
    .prepare(
      `SELECT
         COUNT(*) as total_24h,
         SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_24h
       FROM transactions
       WHERE customer_id = ? AND id != ? AND created_at >= ? AND created_at <= ?`
    )
    .get(customerId, excludeTxId || '', windowStart, referenceIso) as
    | { total_24h: number; failed_24h: number | null }
    | undefined;

  return {
    customer_avg_amount: Number(avgRow?.avg_amt || 0),
    customer_tx_count_24h: Number(recentCounts?.total_24h || 0),
    customer_failed_attempts_24h: Number(recentCounts?.failed_24h || 0),
  };
}

export function createAlertsIfNeeded(
  db: DatabaseSync,
  params: {
    transaction_id: string;
    risk_score: number;
    risk_category: string;
    status: TransactionStatus;
    failedAttempts24h: number;
    txCount24h: number;
    amount: number;
    currency: string;
    customer_id: string;
    created_at: string;
  }
): void {
  const insertAlert = db.prepare(`
    INSERT OR IGNORE INTO alerts (id, transaction_id, alert_type, severity, description, is_read, review_status, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 'Pending Review', ?)
  `);

  const formattedAmt = `${params.currency} ${params.amount.toFixed(2)}`;

  if (params.risk_category === 'High Risk') {
    insertAlert.run(
      `ALT-${params.transaction_id}-HIGH`,
      params.transaction_id,
      'High-Risk Payment Signal',
      'high',
      `Transaction ${params.transaction_id} (${formattedAmt}) for ${params.customer_id} scored ${params.risk_score}/100 and requires manual analyst review.`,
      params.created_at
    );
  }

  if (params.failedAttempts24h >= 2 || (params.status === 'Failed' && params.failedAttempts24h >= 1)) {
    insertAlert.run(
      `ALT-${params.transaction_id}-FAILBURST`,
      params.transaction_id,
      'Repeated Failed Payment Pattern',
      params.failedAttempts24h >= 3 ? 'high' : 'medium',
      `Multiple failed payment attempts detected for ${params.customer_id} within a 24-hour window (${params.failedAttempts24h + (params.status === 'Failed' ? 1 : 0)} attempts).`,
      params.created_at
    );
  } else if (params.status === 'Failed') {
    insertAlert.run(
      `ALT-${params.transaction_id}-FAIL`,
      params.transaction_id,
      'Failed Payment Attempt',
      'medium',
      `Payment attempt ${params.transaction_id} (${formattedAmt}) failed for ${params.customer_id}.`,
      params.created_at
    );
  }

  if (params.txCount24h >= 4 && params.risk_score >= 30) {
    insertAlert.run(
      `ALT-${params.transaction_id}-VELOCITY`,
      params.transaction_id,
      'Unusual Transaction Pattern',
      params.txCount24h >= 6 ? 'high' : 'medium',
      `Elevated velocity detected (${params.txCount24h + 1} transactions in 24h) for ${params.customer_id}.`,
      params.created_at
    );
  }
}

interface SeedTxSpec {
  id: string;
  hoursAgo: number;
  amount: number;
  currency: string;
  customer_id: string;
  status: TransactionStatus;
  payment_method: string;
  source: TransactionSource;
  paypal_order_id?: string;
  account_age_days: number;
  metadata_complete: boolean;
  country_mismatch: boolean;
  pattern_shift: boolean;
  review_status?: 'Pending Review' | 'Reviewed — No Issue Identified' | 'Escalated for Further Review';
  note?: string;
}

function seedDemoDataIfEmpty(db: DatabaseSync): void {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM transactions').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const now = Date.now();
  const isoAgo = (hoursAgo: number) => new Date(now - hoursAgo * 3600 * 1000).toISOString();

  const seedSpecs: SeedTxSpec[] = [
    // Established baseline customer: cust_meridian_corp (avg ~$145)
    { id: 'TXN-SHIELD-1001', hoursAgo: 620, amount: 129.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Completed', payment_method: 'PayPal Balance', source: 'PayPal Gateway', account_age_days: 410, metadata_complete: true, country_mismatch: false, pattern_shift: false, review_status: 'Reviewed — No Issue Identified' },
    { id: 'TXN-SHIELD-1002', hoursAgo: 480, amount: 158.5, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Completed', payment_method: 'PayPal Balance', source: 'PayPal Gateway', account_age_days: 416, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1003', hoursAgo: 310, amount: 142.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Captured', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 423, metadata_complete: true, country_mismatch: false, pattern_shift: false },

    // Routine low-risk customers
    { id: 'TXN-SHIELD-1004', hoursAgo: 260, amount: 64.99, currency: 'USD', customer_id: 'cust_northstar_co', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 280, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1005', hoursAgo: 215, amount: 89.0, currency: 'USD', customer_id: 'cust_harbor_intl', status: 'Completed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 195, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1006', hoursAgo: 170, amount: 215.4, currency: 'USD', customer_id: 'cust_summit_retail', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 320, metadata_complete: true, country_mismatch: false, pattern_shift: false },

    // Medium risk: newer account + elevated ticket
    { id: 'TXN-SHIELD-1007', hoursAgo: 138, amount: 890.0, currency: 'USD', customer_id: 'cust_verge_media', status: 'Completed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 8, metadata_complete: true, country_mismatch: true, pattern_shift: false, review_status: 'Reviewed — No Issue Identified', note: 'Verified billing postal details with merchant records; cleared.' },
    { id: 'TXN-SHIELD-1008', hoursAgo: 112, amount: 1120.0, currency: 'USD', customer_id: 'cust_atlas_logistics', status: 'Pending', payment_method: 'PayPal eCheck', source: 'PayPal Gateway', account_age_days: 12, metadata_complete: false, country_mismatch: false, pattern_shift: true },

    // Repeated failed-attempt burst leading to high-risk transaction
    { id: 'TXN-SHIELD-1009', hoursAgo: 72, amount: 115.0, currency: 'USD', customer_id: 'cust_harbor_intl', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 201, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1010', hoursAgo: 46, amount: 310.0, currency: 'USD', customer_id: 'cust_cascade_tech', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 140, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1011', hoursAgo: 38, amount: 245.0, currency: 'USD', customer_id: 'cust_northstar_co', status: 'Completed', payment_method: 'PayPal Balance', source: 'PayPal Gateway', account_age_days: 290, metadata_complete: true, country_mismatch: false, pattern_shift: false },

    // Repeated failures on cust_meridian_corp before a huge spike
    { id: 'TXN-SHIELD-1012', hoursAgo: 20, amount: 1950.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Failed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 435, metadata_complete: true, country_mismatch: false, pattern_shift: true },
    { id: 'TXN-SHIELD-1013', hoursAgo: 19.5, amount: 2150.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Failed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 435, metadata_complete: true, country_mismatch: true, pattern_shift: true },
    { id: 'TXN-SHIELD-1014', hoursAgo: 18.8, amount: 2400.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Failed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 435, metadata_complete: false, country_mismatch: true, pattern_shift: true },
    { id: 'TXN-SHIELD-1015', hoursAgo: 18.2, amount: 3480.0, currency: 'USD', customer_id: 'cust_meridian_corp', status: 'Captured', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 435, metadata_complete: false, country_mismatch: true, pattern_shift: true, review_status: 'Pending Review', note: 'Flagged automatically due to 24x historical spend spike after 3 consecutive failed attempts.' },

    // High-velocity + brand new account high-risk cluster
    { id: 'TXN-SHIELD-1016', hoursAgo: 14, amount: 420.0, currency: 'USD', customer_id: 'cust_zephyr_digital', status: 'Failed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 1, metadata_complete: false, country_mismatch: true, pattern_shift: true },
    { id: 'TXN-SHIELD-1017', hoursAgo: 13.5, amount: 680.0, currency: 'USD', customer_id: 'cust_zephyr_digital', status: 'Failed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 1, metadata_complete: false, country_mismatch: true, pattern_shift: true },
    { id: 'TXN-SHIELD-1018', hoursAgo: 12.8, amount: 1650.0, currency: 'USD', customer_id: 'cust_zephyr_digital', status: 'Completed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 1, metadata_complete: false, country_mismatch: true, pattern_shift: true, review_status: 'Escalated for Further Review', note: 'Escalated to senior compliance queue: new identifier with 2 prior failures and region mismatch.' },

    // Recent normal & pending activity (last 12 hours)
    { id: 'TXN-SHIELD-1019', hoursAgo: 9.5, amount: 79.5, currency: 'USD', customer_id: 'cust_summit_retail', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 327, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1020', hoursAgo: 6.2, amount: 134.0, currency: 'USD', customer_id: 'cust_harbor_intl', status: 'Captured', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 204, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1021', hoursAgo: 4.1, amount: 495.0, currency: 'USD', customer_id: 'cust_cascade_tech', status: 'Pending', payment_method: 'PayPal Pay Later', source: 'PayPal Gateway', account_age_days: 142, metadata_complete: true, country_mismatch: false, pattern_shift: true },
    { id: 'TXN-SHIELD-1022', hoursAgo: 2.3, amount: 52.25, currency: 'USD', customer_id: 'cust_northstar_co', status: 'Completed', payment_method: 'PayPal Balance', source: 'PayPal Gateway', account_age_days: 292, metadata_complete: true, country_mismatch: false, pattern_shift: false },
    { id: 'TXN-SHIELD-1023', hoursAgo: 1.1, amount: 2890.0, currency: 'USD', customer_id: 'cust_orbit_systems', status: 'Completed', payment_method: 'PayPal Credit Card', source: 'PayPal Gateway', account_age_days: 2, metadata_complete: false, country_mismatch: true, pattern_shift: true, review_status: 'Pending Review' },
    { id: 'TXN-SHIELD-1024', hoursAgo: 0.4, amount: 118.0, currency: 'USD', customer_id: 'cust_summit_retail', status: 'Completed', payment_method: 'PayPal Wallet', source: 'PayPal Gateway', account_age_days: 327, metadata_complete: true, country_mismatch: false, pattern_shift: false },
  ];

  // Insert in chronological order (oldest first) so historical context builds organically
  const ordered = [...seedSpecs].sort((a, b) => b.hoursAgo - a.hoursAgo);
  const config: RiskEngineConfig = {
    weights: DEFAULT_RISK_WEIGHTS,
    thresholds: DEFAULT_RISK_THRESHOLDS,
  };

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, paypal_order_id, amount, currency, customer_id, status, payment_method,
      source, account_age_days, metadata_complete, country_mismatch, pattern_shift, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAssessment = db.prepare(`
    INSERT INTO risk_assessments (
      id, transaction_id, risk_score, risk_category, risk_factors_json,
      ai_explanation, explanation_provider, recommended_action, review_status, assessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'deterministic_fallback', ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO payment_events (id, transaction_id, event_type, event_details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertNote = db.prepare(`
    INSERT INTO review_notes (id, transaction_id, author, note_text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const spec of ordered) {
    const createdAt = isoAgo(spec.hoursAgo);
    insertTx.run(
      spec.id,
      spec.paypal_order_id || null,
      spec.amount,
      spec.currency,
      spec.customer_id,
      spec.status,
      spec.payment_method,
      spec.source,
      spec.account_age_days,
      spec.metadata_complete ? 1 : 0,
      spec.country_mismatch ? 1 : 0,
      spec.pattern_shift ? 1 : 0,
      createdAt
    );

    const ctx = getCustomerContext(db, spec.customer_id, createdAt, spec.id);
    const evalResult = calculateTransactionRisk(
      {
        amount: spec.amount,
        currency: spec.currency,
        customer_id: spec.customer_id,
        status: spec.status,
        payment_method: spec.payment_method,
        account_age_days: spec.account_age_days,
        metadata_complete: spec.metadata_complete,
        country_mismatch: spec.country_mismatch,
        pattern_shift: spec.pattern_shift,
        ...ctx,
      },
      config
    );

    const reviewStatus = spec.review_status || 'Pending Review';
    insertAssessment.run(
      `RSK-${spec.id}`,
      spec.id,
      evalResult.risk_score,
      evalResult.risk_category,
      JSON.stringify(evalResult.risk_factors),
      evalResult.fallback_explanation,
      evalResult.recommended_action,
      reviewStatus,
      createdAt
    );

    insertEvent.run(
      `EVT-${spec.id}-1`,
      spec.id,
      'TRANSACTION_CREATED',
      `Transaction recorded via ${spec.source} for ${spec.currency} ${spec.amount.toFixed(2)}.`,
      createdAt
    );

    insertEvent.run(
      `EVT-${spec.id}-2`,
      spec.id,
      spec.status === 'Failed'
        ? 'PAYMENT_FAILED'
        : spec.status === 'Pending'
          ? 'PAYMENT_PENDING'
          : 'PAYMENT_CAPTURED',
      `Status recorded as ${spec.status} via ${spec.payment_method}.`,
      createdAt
    );

    insertEvent.run(
      `EVT-${spec.id}-3`,
      spec.id,
      'RISK_SCORED',
      `Deterministic risk assessment completed: ${evalResult.risk_score}/100 (${evalResult.risk_category}).`,
      createdAt
    );

    if (spec.note) {
      insertNote.run(`NOTE-${spec.id}`, spec.id, 'Lead Fraud Analyst', spec.note, createdAt);
    }

    createAlertsIfNeeded(db, {
      transaction_id: spec.id,
      risk_score: evalResult.risk_score,
      risk_category: evalResult.risk_category,
      status: spec.status,
      failedAttempts24h: ctx.customer_failed_attempts_24h,
      txCount24h: ctx.customer_tx_count_24h,
      amount: spec.amount,
      currency: spec.currency,
      customer_id: spec.customer_id,
      created_at: createdAt,
    });

    // Sync alert review_status if already reviewed in seed
    if (reviewStatus !== 'Pending Review') {
      db.prepare('UPDATE alerts SET review_status = ?, is_read = 1 WHERE transaction_id = ?').run(
        reviewStatus,
        spec.id
      );
    }
  }
}
