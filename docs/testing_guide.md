# Testing & Manual Validation Guide

## 1. Automated Test Suite

Run all deterministic risk engine and API integration tests:

```bash
npx --yes tsx --test src/lib/riskEngine.test.ts server/api.test.ts
```

Tests verify:
- `/api/health` endpoint
- Seeded dashboard summary and risk distribution aggregations
- Deterministic risk-score bands (`0–29`, `30–69`, `70–100`) and custom thresholds
- High-risk vs low-risk vs medium-risk classifications
- `POST /api/transactions` scoring, alert generation, and Gemini fallback when `GEMINI_API_KEY` is absent
- Transaction filtering and review status persistence
- PayPal order validation (`400`), creation, capture, and duplicate-capture protection (`409`)

## 2. Manual Validation Scenarios

### Scenario A: Investigate & Escalate a Flagged Demo Transaction
1. Open **Transactions** in the left sidebar.
2. Filter by **High Risk (70–100)** and click `TXN-DEMO-1015`.
3. Verify the **Risk Score Breakdown** shows `Historical Value Deviation` and `Repeated Failed Attempts`.
4. Read the **AI-Assisted Risk Explanation** and confirm it does not claim fraud is proven.
5. Click **Escalated for Further Review**, enter a note, and reload the browser—verify the updated status and note persist.

### Scenario B: PayPal Sandbox Payment Flow
1. Open **PayPal Sandbox** in the sidebar.
2. Enter `$3,400.00` or select **High-Risk Anomaly Test**, then create the order.
   - *With Sandbox credentials configured:* Click the PayPal JS SDK button and sign in with a PayPal Sandbox Buyer account.
   - *Without credentials configured:* Use the clearly labeled **Approve & Capture Payment** button in Simulated Sandbox Demo mode.
3. Verify the newly captured transaction appears in **Overview**, **Payment Monitoring**, and **Alerts & Notifications**.

### Scenario C: CSV Analytics Export
1. Open **Analytics & Reports**.
2. Switch timeframes (`7D`, `30D`, `ALL`) and click **Export CSV**.
3. Open the downloaded `.csv` file and verify it matches database transaction records.
