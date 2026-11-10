# PayPal Shield AI

**AI-Powered Payment Fraud Detection & Transaction Intelligence Platform**

PayPal Shield AI is a full-stack fintech hackathon application demonstrating how transparent deterministic risk scoring, Google Gemini natural-language explanations, and PayPal Sandbox Orders API v2 work together to help merchants monitor payments and review suspicious activity responsibly.

> **Decision-Support Disclaimer:** Risk scores and AI-generated explanations in PayPal Shield AI are advisory decision-support signals for human analysts—never proof of fraudulent intent. Customers are never automatically blocked solely because of an AI score.

---

## Problem Statement

Growing online merchants face two challenges simultaneously:
1. **Opaque risk alerts:** Legacy fraud alerts often give a binary block/pass signal without explaining *why* a transaction looked unusual.
2. **Manual investigation overhead:** Analysts spend significant time cross-referencing failed payment bursts, historical average spend, and account age across disconnected logs.

## Proposed Solution

PayPal Shield AI combines:
- **Deterministic Primary Risk Engine (`0–100`)**: Transparent, configurable rule weights evaluating historical value spikes, absolute ticket thresholds, repeated failed attempts, 24-hour transaction velocity, account maturity, metadata consistency, and pattern deviations.
- **Google Gemini AI Explanations**: Translates triggered risk factors into concise, non-accusatory analyst summaries without inventing facts or altering the deterministic score. Automatic deterministic fallback ensures resilience if the Gemini API is unavailable.
- **PayPal Sandbox Integration**: End-to-end server-verified PayPal Orders v2 checkout (`create-order`, `capture-order`, `GET /api/paypal/order/:orderId`) with a clearly labeled Simulated Sandbox Demo fallback when credentials are omitted.
- **Persistent SQLite Storage & Human Review Workflow**: Stores transactions, risk assessments, alerts, payment events, review notes, and settings across sessions.

---

## Features

- **Overview Dashboard**: 6 database-backed KPI cards with period deltas, Transaction Activity chart (`24h / 7d / 30d / 90d`), Risk Distribution chart, Recent Transactions, and Recent Security Alerts.
- **Transaction Management**: Global & multi-criteria search (ID, PayPal Order ID, customer identifier, status, risk band, source, date range, min/max amount), column sorting, pagination, and a slide-over investigation drawer.
- **AI Risk Analysis Simulator**: Interactive sandbox form to test how signals change scores, inspect factor weights, and compare Gemini vs. fallback explanations.
- **Fraud Intelligence**: Pattern summaries for repeated failed attempts and velocity clusters, risk factor frequencies, trend charts, and an actionable suspicious-activity feed.
- **Payment Monitoring**: Live-style polling monitor (explicitly labeled 15s polling interval, not a PayPal webhook) with status counters and per-transaction payment event timelines.
- **Analytics & Reports**: Database-derived volume, success/failure rates, risk score trends, and one-click CSV report export.
- **Alerts & Notifications**: Deduplicated alert generation, unread counters, category filters, and linked transaction review.
- **PayPal Sandbox**: Real PayPal Sandbox Orders API v2 + PayPal JS SDK checkout when configured, or clearly labeled Simulated Sandbox Demo mode for instant evaluation.
- **Settings**: Persisted risk thresholds, polling intervals, AI toggle, and server-side integration status checks (zero secrets exposed to browser).

---

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts (`Manrope`, `Plus Jakarta Sans`, `JetBrains Mono`)
- **Backend**: Node.js + Express (`server.ts`, `server/routes.ts`, `server/paypal.ts`, `server/gemini.ts`)
- **Database**: SQLite (`node:sqlite`, `data/paypal_shield.db`) with normalized relational schema designed for seamless PostgreSQL migration
- **AI Layer**: `@google/genai` (`gemini-3.8-flash`) server-side with automatic deterministic fallback
- **Payment Layer**: PayPal Developer Sandbox REST API v2 (`/v1/oauth2/token`, `/v2/checkout/orders`)

---

## Environment Configuration

Copy `.env.example` to `.env` and configure variables as needed:

```env
GEMINI_API_KEY="your-gemini-api-key"
PAYPAL_CLIENT_ID="your-paypal-sandbox-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-sandbox-client-secret"
PAYPAL_MODE="sandbox"
DATABASE_PATH="./data/paypal_shield.db"
```

- **First-run ready**: The app automatically initializes the SQLite schema and seeds 24 realistic demo transactions (labeled `Simulated Demo`) on startup—no external credentials required to explore the dashboard.
- **Never expose secrets**: `GEMINI_API_KEY` and `PAYPAL_CLIENT_SECRET` are strictly read on the backend and never sent to frontend code or logs.

---

## Installation & Startup

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack server (Express API + Vite frontend on port 3000)
npm run dev

# 3. Build for production
npm run build
npm start
```

Open `http://localhost:3000`.

---

## Testing

Run the automated unit and API integration tests:

```bash
npx --yes tsx --test src/lib/riskEngine.test.ts server/api.test.ts
```

See `docs/testing_guide.md` for manual PayPal Sandbox validation scenarios and `docs/demo_script.md` for a 3-minute hackathon judge walkthrough.

---

## Known Limitations & Future Improvements

- This is a **hackathon prototype**, not a certified PCI-DSS or production fraud-prevention engine.
- Polling in Payment Monitoring refreshes every 15 seconds rather than receiving signed PayPal webhooks.
- Future enhancements: PostgreSQL migration, PayPal Webhook signature verification (`/v1/notifications/verify-webhook-signature`), device/IP velocity enrichment (with privacy controls), and role-based analyst authentication.
