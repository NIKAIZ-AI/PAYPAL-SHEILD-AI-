import React, { useEffect, useState } from 'react';
import { Calculator, ShieldCheck, Sparkles } from 'lucide-react';
import { RiskIndicator } from '../components/RiskBadge';
import { api } from '../services/api';
import type { RiskEvaluationResult, TransactionStatus } from '../types';

export function AiRiskAnalysisPage() {
  const [amount, setAmount] = useState('2450');
  const [currency, setCurrency] = useState('USD');
  const [customerId, setCustomerId] = useState('cust_sim_meridian');
  const [status, setStatus] = useState<TransactionStatus>('Completed');
  const [paymentMethod, setPaymentMethod] = useState('PayPal Credit Card');
  const [customerAvg, setCustomerAvg] = useState('160');
  const [failed24h, setFailed24h] = useState('2');
  const [txCount24h, setTxCount24h] = useState('4');
  const [accountAge, setAccountAge] = useState('5');
  const [metadataComplete, setMetadataComplete] = useState(false);
  const [countryMismatch, setCountryMismatch] = useState(true);
  const [patternShift, setPatternShift] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (RiskEvaluationResult & {
      ai_explanation: string;
      explanation_provider: 'gemini' | 'deterministic_fallback';
    }) | null
  >(null);

  const [weightsSummary, setWeightsSummary] = useState<{
    weights: Record<string, number>;
    thresholds: { mediumMin: number; highMin: number };
    counts: { highRisk: number; mediumRisk: number; lowRisk: number };
  } | null>(null);

  useEffect(() => {
    api.getRiskSummary().then((data) => setWeightsSummary(data)).catch(() => {});
  }, []);

  const runAnalysis = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const numAmt = Number(amount);
    if (!Number.isFinite(numAmt) || numAmt <= 0) {
      setError('Enter a valid positive transaction amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.assessRiskLab({
        amount: numAmt,
        currency,
        customer_id: customerId.trim() || 'cust_sim_lab',
        status,
        payment_method: paymentMethod,
        account_age_days: Math.max(0, Number(accountAge) || 0),
        metadata_complete: metadataComplete,
        country_mismatch: countryMismatch,
        pattern_shift: patternShift,
        customer_avg_amount: Math.max(0, Number(customerAvg) || 0),
        customer_tx_count_24h: Math.max(0, Number(txCount24h) || 0),
        customer_failed_attempts_24h: Math.max(0, Number(failed24h) || 0),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run risk assessment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset: 'low' | 'medium' | 'high') => {
    if (preset === 'low') {
      setAmount('84.50');
      setCustomerAvg('92');
      setFailed24h('0');
      setTxCount24h('1');
      setAccountAge('320');
      setStatus('Completed');
      setMetadataComplete(true);
      setCountryMismatch(false);
      setPatternShift(false);
    } else if (preset === 'medium') {
      setAmount('890');
      setCustomerAvg('250');
      setFailed24h('1');
      setTxCount24h('3');
      setAccountAge('10');
      setStatus('Pending');
      setMetadataComplete(true);
      setCountryMismatch(true);
      setPatternShift(false);
    } else {
      setAmount('3650');
      setCustomerAvg('140');
      setFailed24h('3');
      setTxCount24h('6');
      setAccountAge('2');
      setStatus('Failed');
      setMetadataComplete(false);
      setCountryMismatch(true);
      setPatternShift(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            AI Risk Analysis Simulator
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Inspect how deterministic rule weights compute risk scores (0–100) and how Gemini translates factors into clear analyst explanations.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start">
          <button
            type="button"
            onClick={() => applyPreset('low')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white rounded-md transition-colors"
          >
            Low-Risk Preset
          </button>
          <button
            type="button"
            onClick={() => applyPreset('medium')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white rounded-md transition-colors"
          >
            Medium-Risk Preset
          </button>
          <button
            type="button"
            onClick={() => applyPreset('high')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white rounded-md transition-colors"
          >
            High-Risk Preset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form
          onSubmit={runAnalysis}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(11,27,54,0.03)]"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Calculator className="w-4 h-4 text-[#1D4ED8]" />
            <h2 className="text-sm font-semibold text-[#0B1B36]">Sample Transaction Signals</h2>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="lab-amount" className="block font-medium text-slate-700 mb-1">
                Amount
              </label>
              <input
                id="lab-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="lab-currency" className="block font-medium text-slate-700 mb-1">
                Currency
              </label>
              <select
                id="lab-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label htmlFor="lab-customer" className="block font-medium text-slate-700 mb-1">
                Customer Identifier
              </label>
              <input
                id="lab-customer"
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="lab-status" className="block font-medium text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                id="lab-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="Completed">Completed</option>
                <option value="Captured">Captured</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
            <div>
              <label htmlFor="lab-avg" className="block font-medium text-slate-700 mb-1">
                Historical Avg Amount ($)
              </label>
              <input
                id="lab-avg"
                type="number"
                min="0"
                value={customerAvg}
                onChange={(e) => setCustomerAvg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="lab-failed" className="block font-medium text-slate-700 mb-1">
                Failed Attempts (24h)
              </label>
              <input
                id="lab-failed"
                type="number"
                min="0"
                value={failed24h}
                onChange={(e) => setFailed24h(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="lab-vel" className="block font-medium text-slate-700 mb-1">
                Tx Count (24h)
              </label>
              <input
                id="lab-vel"
                type="number"
                min="0"
                value={txCount24h}
                onChange={(e) => setTxCount24h(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="lab-age" className="block font-medium text-slate-700 mb-1">
                Account Age (Days)
              </label>
              <input
                id="lab-age"
                type="number"
                min="0"
                value={accountAge}
                onChange={(e) => setAccountAge(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={!metadataComplete}
                onChange={(e) => setMetadataComplete(!e.target.checked)}
              />
              <span>Missing or incomplete transaction metadata</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={countryMismatch}
                onChange={(e) => setCountryMismatch(e.target.checked)}
              />
              <span>Billing / region mismatch indicator</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={patternShift}
                onChange={(e) => setPatternShift(e.target.checked)}
              />
              <span>Sudden behavioral or currency pattern shift</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Running Risk Assessment...' : 'Run Deterministic + AI Risk Assessment'}
          </button>
        </form>

        {/* Results */}
        <div className="lg:col-span-7 space-y-5">
          {result && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(11,27,54,0.03)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Computed Risk Score</div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-4xl font-extrabold text-[#0B1B36] font-mono tabular-nums">
                        {result.risk_score}
                      </span>
                      <span className="text-sm text-slate-400 font-mono">/ 100</span>
                      <RiskIndicator category={result.risk_category} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Suggested Review Action</div>
                    <div className="text-sm font-semibold text-[#0B1B36] mt-1">
                      {result.recommended_action}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        result.risk_category === 'High Risk'
                          ? 'bg-[#DC2626]'
                          : result.risk_category === 'Medium Risk'
                            ? 'bg-[#D97706]'
                            : 'bg-[#16A34A]'
                      }`}
                      style={{ width: `${result.risk_score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>0 (Low Risk)</span>
                    <span>
                      {weightsSummary?.thresholds.mediumMin ?? 30} (Medium)
                    </span>
                    <span>
                      {weightsSummary?.thresholds.highMin ?? 70} (High Risk)
                    </span>
                    <span>100</span>
                  </div>
                </div>

                {/* Gemini Explanation */}
                <div className="p-4 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B21B6]">
                      <Sparkles className="w-4 h-4" />
                      AI Explanation (Non-Modifying Decision Support)
                    </span>
                    <span className="text-[11px] font-medium text-[#6D28D9]">
                      {result.explanation_provider === 'gemini'
                        ? 'Google Gemini'
                        : 'Deterministic Fallback'}
                    </span>
                  </div>
                  <p className="text-sm text-[#2E1065] leading-relaxed">
                    {result.ai_explanation}
                  </p>
                </div>
              </div>

              {/* Factor Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,27,54,0.03)]">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0B1B36]">
                    Rule-Based Factor Breakdown
                  </h3>
                  <span className="text-xs text-slate-500">7 transparent scoring signals</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {result.risk_factors.map((f) => (
                    <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">
                          {f.label}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-mono text-slate-500">{f.signal}</span>
                        </div>
                        <div className="text-slate-600">{f.detail}</div>
                      </div>
                      <div className="font-mono tabular-nums font-semibold text-right shrink-0">
                        <span className={f.points > 0 ? 'text-[#B91C1C]' : 'text-slate-400'}>
                          +{f.points}
                        </span>
                        <span className="text-slate-400"> / {f.maxPoints}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Historical Risk Summary */}
          {weightsSummary && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                <span className="font-semibold">Historical Database Distribution:</span>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-700">Low: {weightsSummary.counts.lowRisk}</span>
                <span className="text-amber-700">Medium: {weightsSummary.counts.mediumRisk}</span>
                <span className="text-red-700">High: {weightsSummary.counts.highRisk}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
