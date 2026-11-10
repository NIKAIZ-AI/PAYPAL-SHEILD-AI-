import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PaymentStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency } from '../services/api';
import type { TransactionRecord } from '../types';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (err: unknown) => void;
      }) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

interface PayPalSandboxPageProps {
  onSelectTransaction: (id: string) => void;
  onPaymentCaptured: () => void;
}

export function PayPalSandboxPage({
  onSelectTransaction,
  onPaymentCaptured,
}: PayPalSandboxPageProps) {
  const [ppStatus, setPpStatus] = useState<{
    configured: boolean;
    clientIdConfigured: boolean;
    secretConfigured: boolean;
    clientId: string | null;
    environment: 'sandbox';
  } | null>(null);

  const [amount, setAmount] = useState('185.00');
  const [currency, setCurrency] = useState('USD');
  const [customerId, setCustomerId] = useState('cust_sandbox_buyer_01');
  const [description, setDescription] = useState('Shield AI Merchant Sandbox Test Order');
  const [simulateAnomalies, setSimulateAnomalies] = useState(false);

  const [creating, setCreating] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    status: string;
    mode: 'paypal_sandbox' | 'simulated_sandbox';
    notice?: string;
  } | null>(null);

  const [capturedTx, setCapturedTx] = useState<TransactionRecord | null>(null);
  const sdkContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.getPayPalStatus().then(setPpStatus).catch(() => {});
  }, []);

  // Dynamically load PayPal JS SDK only if live Sandbox Client ID is configured
  useEffect(() => {
    if (!ppStatus?.configured || !ppStatus.clientId) return;
    if (window.paypal) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      ppStatus.clientId
    )}&currency=${encodeURIComponent(currency)}`;
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => setError('Failed to load PayPal JS SDK script.');
    document.body.appendChild(script);
  }, [ppStatus, currency]);

  // Render official PayPal Buttons when live SDK is ready
  useEffect(() => {
    if (!sdkLoaded || !window.paypal || !sdkContainerRef.current || !ppStatus?.configured) return;
    sdkContainerRef.current.innerHTML = '';

    try {
      window.paypal
        .Buttons({
          createOrder: async () => {
            setError(null);
            const res = await api.createPayPalOrder({
              amount: Number(amount),
              currency,
              customer_id: customerId.trim() || 'cust_sandbox_buyer',
              description,
              account_age_days: simulateAnomalies ? 2 : 120,
              metadata_complete: !simulateAnomalies,
              country_mismatch: simulateAnomalies,
              pattern_shift: simulateAnomalies,
            });
            setActiveOrder({
              orderId: res.orderId,
              status: res.status,
              mode: res.mode,
            });
            return res.orderId;
          },
          onApprove: async (data) => {
            setCapturing(true);
            setError(null);
            try {
              const cap = await api.capturePayPalOrder(data.orderID);
              setCapturedTx(cap.transaction);
              setActiveOrder((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
              onPaymentCaptured();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Capture failed');
            } finally {
              setCapturing(false);
            }
          },
          onError: () => {
            setError('PayPal Sandbox checkout encountered an error.');
          },
        })
        .render(sdkContainerRef.current);
    } catch {
      // ignore render unmount race
    }
  }, [sdkLoaded, ppStatus?.configured, amount, currency, customerId, description, simulateAnomalies, onPaymentCaptured]);

  const handleCreateSimulatedOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCapturedTx(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive payment amount.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.createPayPalOrder({
        amount: amt,
        currency,
        customer_id: customerId.trim() || 'cust_sandbox_buyer_01',
        description,
        account_age_days: simulateAnomalies ? 2 : 120,
        metadata_complete: !simulateAnomalies,
        country_mismatch: simulateAnomalies,
        pattern_shift: simulateAnomalies,
      });
      setActiveOrder({
        orderId: res.orderId,
        status: res.status,
        mode: res.mode,
        notice: res.notice,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create order');
    } finally {
      setCreating(false);
    }
  };

  const handleCaptureOrder = async (simulateFailure = false) => {
    if (!activeOrder) return;
    setCapturing(true);
    setError(null);
    try {
      const res = await api.capturePayPalOrder(activeOrder.orderId, simulateFailure);
      setCapturedTx(res.transaction);
      setActiveOrder({ ...activeOrder, status: simulateFailure ? 'FAILED' : 'COMPLETED' });
      onPaymentCaptured();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order capture failed');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            PayPal Sandbox Integration
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Sandbox-only payment testing pipeline: Order Creation → Approval → Server-Side Capture → Risk Scoring → Gemini Explanation.
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-[#003087] self-start whitespace-nowrap">
          Sandbox Environment Only · Non-Production
        </div>
      </div>

      {/* Credential Status Banner */}
      {ppStatus && !ppStatus.configured && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">
              PayPal Sandbox API credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured on the server
            </div>
            <p className="text-amber-800">
              To run live PayPal Sandbox API v2 calls and render the PayPal JS SDK button, add your Sandbox Client ID and Secret to server environment variables. The integrated PayPal Developer Gateway simulator below enables end-to-end testing of order creation, capture, risk scoring, and intelligence.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Order Form */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#0070E0]" />
              <h2 className="text-base font-semibold text-[#0B1B36]">
                Step 1: Configure Sandbox Payment
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {ppStatus?.configured ? 'Live PayPal Sandbox API' : 'PayPal Developer Gateway'}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateSimulatedOrder} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sbx-amount" className="block font-medium text-slate-700 mb-1">
                  Payment Amount
                </label>
                <input
                  id="sbx-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="sbx-currency" className="block font-medium text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  id="sbx-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="sbx-customer" className="block font-medium text-slate-700 mb-1">
                Customer Account Identifier
              </label>
              <input
                id="sbx-customer"
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>

            <div>
              <label htmlFor="sbx-desc" className="block font-medium text-slate-700 mb-1">
                Order Description
              </label>
              <input
                id="sbx-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800">Test Risk Scenario Preset</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAmount('145.00');
                    setSimulateAnomalies(false);
                  }}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium ${
                    !simulateAnomalies
                      ? 'bg-white border-[#1D4ED8] text-[#1D4ED8]'
                      : 'bg-transparent border-slate-200 text-slate-600'
                  }`}
                >
                  Normal Purchase ($145)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAmount('3400.00');
                    setSimulateAnomalies(true);
                  }}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium ${
                    simulateAnomalies
                      ? 'bg-white border-red-500 text-red-700'
                      : 'bg-transparent border-slate-200 text-slate-600'
                  }`}
                >
                  High-Risk Anomaly Test ($3,400 + New Account)
                </button>
              </div>
            </div>

            {ppStatus?.configured ? (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium text-slate-700">
                  PayPal Sandbox Checkout (Official JS SDK)
                </div>
                <div ref={sdkContainerRef} className="min-h-[45px]" />
              </div>
            ) : (
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0070E0] hover:bg-[#005EA6] rounded-lg transition-colors disabled:opacity-50"
              >
                {creating
                  ? 'Creating Simulated Sandbox Order...'
                  : 'Create Simulated Sandbox Order'}
              </button>
            )}
          </form>

          {/* Step 2: Approval & Capture for Simulated Mode */}
          {activeOrder && activeOrder.mode === 'simulated_sandbox' && activeOrder.status === 'CREATED' && (
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#003087]">
                  Step 2: Approve & Capture Order
                </span>
                <span className="font-mono text-slate-600">{activeOrder.orderId}</span>
              </div>
              <p className="text-xs text-slate-700">
                Approve this gateway order to execute server-side capture, database persistence, risk scoring, and AI explanation.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={capturing}
                  onClick={() => handleCaptureOrder(false)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {capturing ? 'Capturing...' : 'Approve & Capture Payment'}
                </button>
                <button
                  type="button"
                  disabled={capturing}
                  onClick={() => handleCaptureOrder(true)}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Simulate Failed Capture
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result & Verification Card */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <h2 className="text-base font-semibold text-[#0B1B36]">
              Step 3: Server Verification & Risk Result
            </h2>
          </div>

          {!capturedTx ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-500">
              <p className="font-medium text-slate-700">No Sandbox order captured yet</p>
              <p>
                Create and approve an order on the left to watch server-side capture, SQLite persistence, deterministic risk scoring, and Gemini explanation in action.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Order verified, persisted to SQLite (<strong className="font-mono">{capturedTx.id}</strong>), and scored automatically.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Order / Tx Amount</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#0B1B36] mt-0.5">
                    {formatCurrency(capturedTx.amount, capturedTx.currency)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Payment & Source</div>
                  <div className="mt-1 flex items-center gap-2">
                    <PaymentStatusLabel status={capturedTx.status} />
                    <span className="text-[11px] text-slate-500">{capturedTx.source}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">PayPal / Sandbox Order ID</div>
                  <div className="font-mono text-slate-800 mt-0.5 break-all">
                    {capturedTx.paypal_order_id}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Risk Assessment</div>
                  <div className="mt-1">
                    <RiskIndicator
                      category={capturedTx.risk_category}
                      score={capturedTx.risk_score}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[#5B21B6]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Risk Explanation
                  </span>
                  <span className="text-[11px]">
                    {capturedTx.explanation_provider === 'gemini'
                      ? 'Google Gemini'
                      : 'Deterministic Fallback'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#2E1065]">
                  {capturedTx.ai_explanation}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectTransaction(capturedTx.id)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors"
              >
                <span>Open Full Investigation & Human Review Drawer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
