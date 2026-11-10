import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MessageSquare,
  Repeat,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReviewStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type { AlertRecord, ReviewStatus } from '../types';

interface FraudIntelligencePageProps {
  onSelectTransaction: (id: string) => void;
  refreshTick: number;
  onUpdated: () => void;
}

export function FraudIntelligencePage({
  onSelectTransaction,
  refreshTick,
  onUpdated,
}: FraudIntelligencePageProps) {
  const [summary, setSummary] = useState<{
    counts: {
      flagged: number;
      highRisk: number;
      mediumRisk: number;
      repeatedFailurePatterns: number;
      unusualFrequencyClusters: number;
    };
    commonFactors: Array<{ id: string; label: string; triggeredCount: number; avgPoints: number }>;
  } | null>(null);
  const [trends, setTrends] = useState<
    Array<{ date: string; highRisk: number; mediumRisk: number; lowRisk: number }>
  >([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskRes, trendRes, alertRes] = await Promise.all([
        api.getRiskSummary(),
        api.getAnalyticsTrends('30d'),
        api.getAlerts(),
      ]);
      setSummary(riskRes);
      setTrends(trendRes.trends);
      setAlerts(alertRes.alerts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTick]);

  const handleAlertReview = async (
    alert: AlertRecord,
    status: ReviewStatus,
    note?: string
  ) => {
    setBusyId(alert.id);
    try {
      await api.reviewAlert(alert.id, status, note);
      setNoteTarget(null);
      setNoteText('');
      await loadData();
      onUpdated();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
          Fraud Intelligence Center
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Pattern detection across repeated payment failures, velocity bursts, and recurring risk signals across merchant transactions.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Total Flagged</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1B36] mt-1.5">
            {summary?.counts.flagged ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Medium + High Risk</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>High-Risk Count</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#B91C1C] mt-1.5">
            {summary?.counts.highRisk ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Score 70–100</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Medium-Risk Count</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#B45309] mt-1.5">
            {summary?.counts.mediumRisk ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Score 30–69</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Repeated Failures</span>
            <Repeat className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1B36] mt-1.5">
            {summary?.counts.repeatedFailurePatterns ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Identifiers with 2+ fails (24h)</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Velocity Clusters</span>
            <TrendingUp className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1B36] mt-1.5">
            {summary?.counts.unusualFrequencyClusters ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Identifiers with 3+ tx (24h)</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-[#0B1B36]">Risk Distribution Over Time</h2>
          <p className="text-xs text-slate-500 mb-4">Daily trend of High, Medium, and Low risk signals</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="highRisk" name="High Risk" stroke="#DC2626" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="mediumRisk" name="Medium Risk" stroke="#D97706" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="lowRisk" name="Low Risk" stroke="#16A34A" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-[#0B1B36]">Most Common Risk Factors</h2>
          <p className="text-xs text-slate-500 mb-4">Frequency of triggered signals across recorded payments</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary?.commonFactors || []}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={150}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip />
                <Bar dataKey="triggeredCount" name="Triggers" fill="#1D4ED8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Suspicious Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0B1B36]">Suspicious Activity Feed</h2>
            <p className="text-xs text-slate-500">
              Review flagged alerts, escalate cases, or attach internal investigation notes
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{alerts.length} alerts</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading && alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading intelligence feed...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No suspicious activity alerts found.</div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-5 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-500">{alert.id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-[#0B1B36]">{alert.alert_type}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{alert.transaction_source || 'PayPal Gateway'}</span>
                    </div>
                    <p className="text-sm text-slate-700">{alert.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      <span className="font-mono">Tx: {alert.transaction_id}</span>
                      {alert.amount !== undefined && (
                        <span className="font-mono tabular-nums font-medium text-slate-800">
                          {formatCurrency(alert.amount, alert.currency)}
                        </span>
                      )}
                      <span className="font-mono tabular-nums">{formatTimestamp(alert.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {alert.risk_category && (
                        <RiskIndicator category={alert.risk_category} score={alert.risk_score} />
                      )}
                      <ReviewStatusLabel status={alert.review_status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectTransaction(alert.transaction_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Transaction</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === alert.id}
                        onClick={() =>
                          handleAlertReview(alert, 'Reviewed — No Issue Identified')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Reviewed</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === alert.id}
                        onClick={() =>
                          handleAlertReview(alert, 'Escalated for Further Review')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Escalate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNoteTarget(noteTarget === alert.id ? null : alert.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Add Note</span>
                      </button>
                    </div>
                  </div>
                </div>

                {noteTarget === alert.id && (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Enter internal review note for this alert..."
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      disabled={!noteText.trim() || busyId === alert.id}
                      onClick={() =>
                        handleAlertReview(alert, alert.review_status, noteText.trim())
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-blue-800 disabled:opacity-50"
                    >
                      Save Note
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
