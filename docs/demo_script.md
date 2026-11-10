# PayPal Shield AI — Hackathon Demo Script (< 3 Minutes)

- **0:00 – 0:30 | Overview Dashboard**:
  Open PayPal Shield AI (`http://localhost:3000`). Point out the 6 live SQLite-backed KPI cards, the Transaction Activity area chart (switch between `7 Days` and `30 Days`), Risk Distribution donut, and Recent Security Alerts. Emphasize that scores are decision-support signals, never automated blocks.

- **0:30 – 1:15 | Transaction Investigation & AI Explanation**:
  Navigate to **Transactions**, filter by `High Risk`, and open `TXN-DEMO-1015` ($3,480.00). Show the transparent 7-signal deterministic score breakdown (e.g., 24x historical spend spike + 3 prior failed attempts) alongside the plain-English Gemini explanation. Submit an analyst decision (**Reviewed** or **Escalated**) with a note and point out the live Payment Event History update.

- **1:15 – 2:10 | PayPal Sandbox Checkout & Live Scoring**:
  Open **PayPal Sandbox**. Select the **High-Risk Anomaly Test** preset (`$3,400.00`), create the order, approve & capture it through the backend (`POST /api/paypal/create-order` -> `POST /api/paypal/capture-order`). Show the instant server-verified transaction, generated risk score, and AI explanation card, then jump directly to its investigation drawer.

- **2:10 – 2:45 | Fraud Intelligence, Monitoring & CSV Reports**:
  Briefly show **Fraud Intelligence** (repeated failure patterns & common risk factors) and **Analytics & Reports** (showing the newly captured transaction reflected in live volume and one-click **Export CSV**). Conclude on **Settings** highlighting server-side secret isolation and configurable risk thresholds.
