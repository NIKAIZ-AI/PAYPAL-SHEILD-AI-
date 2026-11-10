export type RiskCategory = 'Low Risk' | 'Medium Risk' | 'High Risk';

export type ReviewStatus =
  | 'Pending Review'
  | 'Reviewed — No Issue Identified'
  | 'Escalated for Further Review';

export type TransactionStatus = 'Completed' | 'Pending' | 'Failed' | 'Captured';

export type TransactionSource = 'PayPal Sandbox' | 'PayPal Gateway' | 'Simulated Demo';

export interface RiskFactor {
  id: string;
  label: string;
  signal: string;
  points: number;
  maxPoints: number;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface RiskWeights {
  amountSpike: number; // Max points when transaction far exceeds customer historical average
  highAbsoluteAmount: number; // Max points for unusually large single transaction
  repeatedFailedAttempts: number; // Max points for recent failed attempts
  unusualVelocity: number; // Max points for rapid transaction burst
  newAccountAge: number; // Max points for brand-new account (< 7 days)
  metadataMismatch: number; // Max points for missing/inconsistent metadata
  patternDeviation: number; // Max points for sudden behavioral/currency/payment shift
}

export interface RiskThresholds {
  mediumMin: number; // Default 30
  highMin: number; // Default 70
}

export interface RiskEngineConfig {
  weights: RiskWeights;
  thresholds: RiskThresholds;
}

export interface RiskEvaluationInput {
  amount: number;
  currency: string;
  customer_id: string;
  status: TransactionStatus;
  payment_method?: string;
  account_age_days?: number;
  metadata_complete?: boolean;
  country_mismatch?: boolean;
  pattern_shift?: boolean;
  // Historical context (computed from DB or entered in simulator)
  customer_avg_amount?: number;
  customer_tx_count_24h?: number;
  customer_failed_attempts_24h?: number;
}

export interface RiskEvaluationResult {
  risk_score: number;
  risk_category: RiskCategory;
  risk_factors: RiskFactor[];
  recommended_action: string;
  fallback_explanation: string;
  assessed_at: string;
}

export interface RiskAssessment {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_category: RiskCategory;
  risk_factors: RiskFactor[];
  ai_explanation: string;
  explanation_provider: 'gemini' | 'deterministic_fallback';
  recommended_action: string;
  review_status: ReviewStatus;
  assessed_at: string;
}

export interface TransactionRecord {
  id: string;
  paypal_order_id: string | null;
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
  created_at: string;
  // Joined latest risk info
  risk_score: number;
  risk_category: RiskCategory;
  review_status: ReviewStatus;
  ai_explanation?: string;
  explanation_provider?: 'gemini' | 'deterministic_fallback';
  recommended_action?: string;
  risk_factors?: RiskFactor[];
  assessed_at?: string;
}

export interface PaymentEvent {
  id: string;
  transaction_id: string;
  event_type: string;
  event_details: string;
  created_at: string;
}

export interface ReviewNote {
  id: string;
  transaction_id: string;
  author: string;
  note_text: string;
  created_at: string;
}

export interface AlertRecord {
  id: string;
  transaction_id: string;
  alert_type: string;
  severity: 'medium' | 'high';
  description: string;
  is_read: boolean;
  review_status: ReviewStatus;
  created_at: string;
  // Joined fields
  amount?: number;
  currency?: string;
  customer_id?: string;
  risk_score?: number;
  risk_category?: RiskCategory;
  transaction_source?: TransactionSource;
}

export interface DashboardSummary {
  totalTransactions: number;
  totalVolume: number;
  successfulPayments: number;
  flaggedTransactions: number;
  failedPayments: number;
  averageRiskScore: number;
  changes: {
    transactionsPct: number | null;
    volumePct: number | null;
    successfulPct: number | null;
    flaggedPct: number | null;
    failedPct: number | null;
    riskScoreDiff: number | null;
  };
  unreadAlerts: number;
}

export interface ActivityPoint {
  label: string;
  total: number;
  successful: number;
  failed: number;
  flagged: number;
  volume: number;
}

export interface RiskDistributionItem {
  category: RiskCategory;
  count: number;
  percentage: number;
}

export interface AppSettings {
  appName: string;
  defaultRange: '24h' | '7d' | '30d' | '90d';
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;
  aiExplanationsEnabled: boolean;
  thresholds: RiskThresholds;
  weights: RiskWeights;
  integrations: {
    geminiConfigured: boolean;
    geminiModel: string;
    paypalConfigured: boolean;
    paypalClientIdConfigured: boolean;
    paypalSecretConfigured: boolean;
    paypalMode: 'sandbox';
  };
}
