# PayPal Shield AI — System Architecture

## 1. High-Level Flow

```text
[React + TypeScript SPA]
        │  REST JSON (/api/*)
        ▼
[Express API Server (server.ts / server/routes.ts)]
   ├──► [Deterministic Risk Engine (src/lib/riskEngine.ts)]
   ├──► [Google Gemini Service (server/gemini.ts)] ──(fallback if unavailable)──► Deterministic Template
   ├──► [PayPal Sandbox Client (server/paypal.ts)] ──► https://api-m.sandbox.paypal.com
   └──► [SQLite Relational Store (server/db.ts -> data/paypal_shield.db)]
```

## 2. Database Schema (SQLite -> PostgreSQL Ready)

1. **`transactions`**: Core ledger (`id`, `paypal_order_id`, `amount`, `currency`, `customer_id`, `status`, `payment_method`, `source`, `account_age_days`, `metadata_complete`, `country_mismatch`, `pattern_shift`, `created_at`).
2. **`risk_assessments`**: Immutable scoring snapshots (`id`, `transaction_id`, `risk_score`, `risk_category`, `risk_factors_json`, `ai_explanation`, `explanation_provider`, `recommended_action`, `review_status`, `assessed_at`).
3. **`alerts`**: Deduplicated security alerts (`id`, `transaction_id`, `alert_type`, `severity`, `description`, `is_read`, `review_status`, `created_at`) with `UNIQUE(transaction_id, alert_type)`.
4. **`review_notes`**: Analyst investigation notes (`id`, `transaction_id`, `author`, `note_text`, `created_at`).
5. **`payment_events`**: Audit trail (`id`, `transaction_id`, `event_type`, `event_details`, `created_at`).
6. **`app_settings`**: Persisted threshold, polling, and AI toggle configuration.

## 3. Deterministic Risk Scoring Model

| Signal | Default Max Points | Trigger Logic |
| :--- | :--- | :--- |
| Historical Value Deviation | 25 | Ratio of amount to customer historical mean (`>=2x`, `>=3x`, `>=5x`) |
| Ticket Size Threshold | 18 | Single-order tiers (`>=$750`, `>=$1,500`, `>=$3,000`) |
| Repeated Failed Attempts | 24 | Failed attempts in prior 24h (`1`, `2`, `>=3`) |
| Transaction Velocity | 15 | Attempts in prior 24h (`>=4`, `>=6`) |
| Account Maturity | 10 | Account age (`<=3 days`, `<=14 days`) |
| Metadata Consistency | 12 | Incomplete metadata and/or region mismatch |
| Pattern Continuity | 14 | Abrupt shift from historical customer behavior |

Total score is clamped `0–100`:
- `0–29`: **Low Risk**
- `30–69`: **Medium Risk**
- `70–100`: **High Risk**
