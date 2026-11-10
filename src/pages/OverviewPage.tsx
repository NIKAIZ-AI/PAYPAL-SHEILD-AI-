import { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  CreditCard,
  DollarSign,
  Gauge,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PaymentStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type {
  ActivityPoint,
  AlertRecord,
  DashboardSummary,
  RiskDistributionItem,
  TransactionRecord,
} from '../types';

interface OverviewPageProps {
  onSelectTransaction: (id: string) => void;
  onNavigate: (tab: string) => void;
  refreshTick: number;
  onStartTour?: () => void;
}

const DIST_COLORS: Record<string, string> = {
  'Low Risk': '#16A34A',
  'Medium Risk': '#D97706',
  'High Risk': '#DC2626',
};

export function OverviewPage({
  onSelectTransaction,
  onNavigate,
  refreshTick,
  onStartTour,
}: OverviewPageProps) {
  const [range, setRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [distribution, setDistribution] = useState<RiskDistributionItem[]>([]);
  const [recentTx, setRecentTx] = useState<TransactionRecord[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sumRes, actRes, distRes, txRes, alertRes] = await Promise.all([
          api.getDashboardSummary(range),
          api.getDashboardActivity(range),
          api.getRiskDistribution(range),
          api.getTransactions({ limit: 6, page: 1 }),
          api.getAlerts(),
        ]);
        if (!active) return;
        setSummary(sumRes);
        setActivity(actRes.series);
        setDistribution(distRes.distribution);
        setRecentTx(txRes.items);
        setRecentAlerts(alertRes.alerts.slice(0, 5));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAll();
    return () => {
      active = false;
    };
  }, [range, refreshTick]);

  const kpiCards = summary
    ? [
        {
          label: 'Total Transactions',
          value: summary.totalTransactions.toLocaleString(),
          change: summary.changes.transactionsPct,
          suffix: '%',
          icon: Activity,
          accent: 'text-[#1D4ED8] bg-blue-50',
        },
        {
          label: 'Total Payment Volume',
          value: formatCurrency(summary.totalVolume),
          change: summary.changes.volumePct,
          suffix: '%',
          icon: DollarSign,
          accent: 'text-[#0070E0] bg-sky-50',
        },
        {
          label: 'Successful Payments',
          value: summary.successfulPayments.toLocaleString(),
          change: summary.changes.successfulPct,
          suffix: '%',
          icon: CheckCircle2,
          accent: 'text-[#15803D] bg-emerald-50',
        },
        {
          label: 'Flagged Transactions',
          value: summary.flaggedTransactions.toLocaleString(),
          change: summary.changes.flaggedPct,
          suffix: '%',
          icon: ShieldAlert,
          accent: 'text-[#B45309] bg-amber-50',
        },
        {
          label: 'Failed Payments',
          value: summary.failedPayments.toLocaleString(),
          change: summary.changes.failedPct,
          suffix: '%',
          icon: XCircle,
          accent: 'text-[#B91C1C] bg-red-50',
        },
        {
          label: 'Average Risk Score',
          value: `${summary.averageRiskScore} / 100`,
          change: summary.changes.riskScoreDiff,
          suffix: ' pts',
          icon: Gauge,
          accent: 'text-[#6D28D9] bg-purple-50',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Range Switcher */}
      <div
        data-tour="overview-header"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            Payment Security Overview
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Decision-support transaction monitoring, deterministic risk scoring, and AI explanations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-700 shadow-sm transition-all"
              title="Start guided feature tour"
            >
              <Compass className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Guided Tour</span>
            </button>
          )}

          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
            role="group"
            aria-label="Dashboard timeframe"
          >
            {(['24h', '7d', '30d', '90d'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  range === opt
                    ? 'bg-white text-[#0B1B36] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B1B36]'
                }`}
              >
                {opt === '24h'
                  ? '24 Hours'
                  : opt === '7d'
                    ? '7 Days'
                    : opt === '30d'
                      ? '30 Days'
                      : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 6 KPI Metric Cards */}
      <div data-tour="kpi-metrics">
        {loading && !summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              const hasChange = card.change !== null && card.change !== undefined;
              const isPositive = (card.change || 0) >= 0;
              return (
                <div
                  key={card.label}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4 shadow-[0_1px_2px_rgba(11,27,54,0.03)]"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">{card.label}</div>
                    <div className="text-2xl font-bold text-[#0B1B36] font-mono tabular-nums tracking-tight">
                      {card.value}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      {hasChange ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-medium ${
                            isPositive ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? '+' : ''}
                          {card.change}
                          {card.suffix} vs prior period
                        </span>
                      ) : (
                        <span>Baseline window ({range})</span>
                      )}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg ${card.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div data-tour="activity-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(11,27,54,0.03)]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0B1B36]">Transaction Activity</h2>
              <p className="text-xs text-slate-500">
                Daily volume of total, successful, failed, and flagged transactions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
            >
              Full Analytics
            </button>
          </div>
          <div className="h-72 w-full">
            {activity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No transactions recorded in this timeframe.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="successful"
                    name="Successful"
                    stroke="#16A34A"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="flagged"
                    name="Flagged"
                    stroke="#D97706"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="#DC2626"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(11,27,54,0.03)] flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#0B1B36]">Risk Distribution</h2>
            <p className="text-xs text-slate-500">Breakdown across deterministic risk bands</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {distribution.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={DIST_COLORS[entry.category] || '#64748B'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="divide-y divide-slate-100 mt-auto pt-2">
            {distribution.map((item) => (
              <div key={item.category} className="py-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: DIST_COLORS[item.category] }}
                  />
                  {item.category}
                </span>
                <span className="font-mono tabular-nums text-slate-900 font-semibold">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Transactions & Recent Security Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div
          data-tour="recent-transactions"
          className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,27,54,0.03)]"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#0B1B36]">Recent Transactions</h2>
              <p className="text-xs text-slate-500">Click any row to inspect risk factors and AI explanation</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Transaction ID</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Risk Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentTx.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    onClick={() => onSelectTransaction(tx.id)}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#1D4ED8]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTransaction(tx.id);
                        }}
                        className="hover:underline text-left"
                      >
                        {tx.id}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{tx.customer_id}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0B1B36]">
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {formatTimestamp(tx.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <PaymentStatusLabel status={tx.status} />
                    </td>
                    <td className="py-3 px-4">
                      <RiskIndicator category={tx.risk_category} score={tx.risk_score} />
                    </td>
                  </tr>
                ))}
                {recentTx.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          data-tour="security-alerts"
          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,27,54,0.03)] flex flex-col"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#0B1B36]">Recent Security Alerts</h2>
              <p className="text-xs text-slate-500">Automated signal triggers requiring review</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
            >
              Alert Center
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1B36]">
                    <AlertOctagon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        alert.severity === 'high' ? 'text-[#B91C1C]' : 'text-[#B45309]'
                      }`}
                    />
                    {alert.alert_type}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {formatTimestamp(alert.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{alert.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">{alert.review_status}</span>
                  <button
                    type="button"
                    onClick={() => onSelectTransaction(alert.transaction_id)}
                    className="text-xs font-medium text-[#1D4ED8] hover:underline inline-flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    Inspect {alert.transaction_id}
                  </button>
                </div>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No security alerts in queue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
