import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
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
import { api, formatCurrency } from '../services/api';

interface AnalyticsPageProps {
  refreshTick: number;
}

export function AnalyticsPage({ refreshTick }: AnalyticsPageProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [overview, setOverview] = useState<{
    totalTransactions: number;
    totalVolume: number;
    averageTransactionValue: number;
    paymentSuccessRate: number;
    paymentFailureRate: number;
    flaggedPercentage: number;
    highRiskCount: number;
    frequentRiskFactors: Array<{ label: string; count: number }>;
  } | null>(null);
  const [trends, setTrends] = useState<
    Array<{
      date: string;
      volume: number;
      transactions: number;
      highRisk: number;
      avgRiskScore: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [ov, tr] = await Promise.all([
          api.getAnalyticsOverview(range),
          api.getAnalyticsTrends(range),
        ]);
        if (!active) return;
        setOverview(ov);
        setTrends(tr.trends);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [range, refreshTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            Analytics & Reports
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Aggregated directly from persisted database records with on-demand CSV reporting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {(['7d', '30d', '90d', 'all'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  range === opt
                    ? 'bg-white text-[#0B1B36] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B1B36]'
                }`}
              >
                {opt === 'all' ? 'All Time' : opt.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href={api.getExportCsvUrl(range)}
            download={`paypal-shield-ai-report-${range}.csv`}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Volume</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0B1B36] mt-1">
            {overview ? formatCurrency(overview.totalVolume) : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Success Rate</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#15803D] mt-1">
            {overview ? `${overview.paymentSuccessRate}%` : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Failure Rate</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#B91C1C] mt-1">
            {overview ? `${overview.paymentFailureRate}%` : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Flagged Share</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#B45309] mt-1">
            {overview ? `${overview.flaggedPercentage}%` : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Avg Ticket Value</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0B1B36] mt-1">
            {overview ? formatCurrency(overview.averageTransactionValue) : '—'}
          </div>
        </div>
      </div>

      {/* Volume & Risk Score Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-[#0B1B36]">Transaction Volume Over Time</h2>
          <p className="text-xs text-slate-500 mb-4">Daily USD processed across recorded payments</p>
          <div className="h-72 w-full">
            {loading && trends.length === 0 ? (
              <div className="h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="volume" name="Volume ($)" fill="#0070E0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-[#0B1B36]">High-Risk & Average Score Trends</h2>
          <p className="text-xs text-slate-500 mb-4">Daily average risk score vs high-risk count</p>
          <div className="h-72 w-full">
            {loading && trends.length === 0 ? (
              <div className="h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgRiskScore" name="Avg Risk Score" stroke="#6D28D9" strokeWidth={2} />
                  <Line type="monotone" dataKey="highRisk" name="High-Risk Count" stroke="#DC2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Most Frequent Risk Factors Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-[#0B1B36]">Most Frequent Risk Factors</h2>
          <p className="text-xs text-slate-500">Signals triggered across {overview?.totalTransactions ?? 0} transactions in selected window</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(overview?.frequentRiskFactors || []).map((f) => (
            <div key={f.label} className="px-5 py-3 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">{f.label}</span>
              <span className="font-mono tabular-nums font-semibold text-[#0B1B36]">
                {f.count} occurrences
              </span>
            </div>
          ))}
          {(overview?.frequentRiskFactors || []).length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No risk factors recorded in this timeframe.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
