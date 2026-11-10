import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Eye, ShieldAlert } from 'lucide-react';
import { ReviewStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type { AlertRecord, ReviewStatus } from '../types';

interface AlertsPageProps {
  onSelectTransaction: (id: string) => void;
  refreshTick: number;
  onAlertsChanged: () => void;
}

export function AlertsPage({
  onSelectTransaction,
  refreshTick,
  onAlertsChanged,
}: AlertsPageProps) {
  const [category, setCategory] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAlerts({ category, unreadOnly });
      setAlerts(res.alerts);
      setUnreadCount(res.unreadCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, unreadOnly, refreshTick]);

  const handleMarkRead = async (id: string) => {
    await api.markAlertRead(id, true);
    await load();
    onAlertsChanged();
  };

  const handleMarkAllRead = async () => {
    await api.markAllAlertsRead();
    await load();
    onAlertsChanged();
  };

  const handleReview = async (id: string, reviewStatus: ReviewStatus) => {
    await api.reviewAlert(id, reviewStatus);
    await load();
    onAlertsChanged();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            Alerts & Notifications
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Deduplicated security notifications triggered by high risk scores, repeated failures, and velocity anomalies.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-40 self-start whitespace-nowrap"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark All as Read ({unreadCount})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            'All',
            'High-Risk Payment Signal',
            'Repeated Failed Payment Pattern',
            'Failed Payment Attempt',
            'Unusual Transaction Pattern',
          ].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-[#0B1B36] text-white border-[#0B1B36]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          <span>Unread only</span>
        </label>
      </div>

      {/* Alert List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {loading && alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Bell className="w-6 h-6 text-slate-300 mx-auto" />
            <div className="text-sm font-medium text-slate-700">No alerts match this view</div>
            <div className="text-xs text-slate-500">
              Try clearing the unread filter or choosing another alert category.
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                alert.is_read ? 'bg-white' : 'bg-blue-50/35'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {!alert.is_read && (
                    <span className="font-semibold text-[#1D4ED8]">Unread</span>
                  )}
                  {!alert.is_read && <span className="text-slate-300">·</span>}
                  <span className="font-semibold text-[#0B1B36]">{alert.alert_type}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-500">{alert.id}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {formatTimestamp(alert.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{alert.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono">Tx: {alert.transaction_id}</span>
                  {alert.amount !== undefined && (
                    <span className="font-mono tabular-nums font-medium text-slate-800">
                      {formatCurrency(alert.amount, alert.currency)}
                    </span>
                  )}
                  {alert.risk_category && (
                    <RiskIndicator category={alert.risk_category} score={alert.risk_score} />
                  )}
                  <ReviewStatusLabel status={alert.review_status} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!alert.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(alert.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleReview(alert.id, 'Escalated for Further Review')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Escalate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!alert.is_read) handleMarkRead(alert.id);
                    onSelectTransaction(alert.transaction_id);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Transaction</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
