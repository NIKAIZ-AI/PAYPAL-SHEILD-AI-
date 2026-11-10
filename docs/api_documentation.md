# PayPal Shield AI — REST API Documentation

All endpoints are served under `/api` on `http://localhost:3000`.

## Health & Configuration
- `GET /api/health` — Returns service status, database type, and server-side integration readiness (`geminiConfigured`, `paypalSandboxConfigured`).
- `GET /api/settings` — Returns application settings, configurable thresholds/weights, and integration status (never exposes secrets).
- `PATCH /api/settings` — Updates thresholds, default range, polling interval, or AI explanation toggle.

## Dashboard
- `GET /api/dashboard/summary?range=24h|7d|30d|90d` — Returns 6 KPI metrics, period-over-period changes, and unread alert count.
- `GET /api/dashboard/activity?range=24h|7d|30d|90d` — Returns time-bucketed counts for total, successful, failed, and flagged transactions.
- `GET /api/dashboard/risk-distribution?range=24h|7d|30d|90d` — Returns counts and percentages across Low, Medium, and High Risk bands.

## Transactions
- `GET /api/transactions` — Supports `search`, `status`, `riskCategory`, `source`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `sortBy`, `sortDir`, `page`, `limit`.
- `GET /api/transactions/:id` — Returns transaction details, latest risk assessment, payment events, review notes, and linked alerts.
- `POST /api/transactions` — Validates input, persists transaction, runs deterministic risk engine + Gemini explanation, logs events, and generates alerts.
- `GET /api/transactions/:id/risk` — Returns risk assessment fields for a transaction.
- `POST /api/transactions/:id/analyze` — Re-runs deterministic scoring and regenerates AI explanation.
- `PATCH /api/transactions/:id/review` — Updates `review_status` (`Pending Review`, `Reviewed — No Issue Identified`, `Escalated for Further Review`) and optional analyst note.
- `POST /api/transactions/:id/notes` — Appends an internal analyst note.

## AI Risk & Intelligence
- `POST /api/risk/assess` — Evaluates hypothetical or sample transaction parameters via the deterministic engine + Gemini explanation without mutating ledger history.
- `GET /api/risk/summary` — Returns configured weights, thresholds, flagged counts, repeated-failure patterns, velocity clusters, and most common risk factors.

## Alerts
- `GET /api/alerts?category=...&unreadOnly=true|false` — Lists alerts and unread count.
- `PATCH /api/alerts/:id/read` — Marks an alert read/unread.
- `PATCH /api/alerts/read-all` — Marks all alerts as read.
- `PATCH /api/alerts/:id/review` — Updates alert & associated transaction review status with optional note.

## Analytics & Reports
- `GET /api/analytics/overview?range=7d|30d|90d|all` — Returns success rate, failure rate, flagged percentage, average ticket value, and factor counts.
- `GET /api/analytics/trends?range=7d|30d|90d|all` — Returns daily volume and average risk score trends.
- `GET /api/analytics/export?range=...` — Streams downloadable CSV report from SQLite records.

## PayPal Sandbox
- `GET /api/paypal/status` — Returns Sandbox readiness and public Client ID (if configured).
- `POST /api/paypal/create-order` — Creates a PayPal Sandbox v2 order (`intent: CAPTURE`) or a clearly labeled Simulated Sandbox Demo order if credentials are unconfigured.
- `POST /api/paypal/capture-order` — Server-side captures & verifies order, prevents duplicate capture (`409`), persists transaction, runs risk scoring & Gemini explanation.
- `GET /api/paypal/order/:orderId` — Fetches order status from PayPal Sandbox API or tracked demo store.
