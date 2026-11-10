import { useCallback, useEffect, useState } from 'react';
import { Clock, RefreshCw, Search } from 'lucide-react';
import { PaymentStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type { PaymentEvent, TransactionRecord } from '../types';

interface PaymentMonitoringPageProps {
  onSelectTransaction: (id: string) => void;
  refreshTick: number;
}

export function PaymentMonitoringPage({
  onSelectTransaction,
  refreshTick,
}: PaymentMonitoringPageProps) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastPolled, setLastPolled] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(true);

  const [allTx, setAllTx] = useState<TransactionRecord[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<PaymentEvent[]>([]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTransactions({
        limit: 50,
        status: statusFilter,
        dateFrom,
        search,
      });
      setAllTx(res.items);
      setLastPolled(new Date().toISOString());
      if (res.items.length > 0 && !selectedTx) {
        setSelectedTx(res.items[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, search, selectedTx]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed, refreshTick]);

  // Polling interval (explicitly labeled as polling, not a webhook)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      fetchFeed();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchFeed]);

  useEffect(() => {
    if (!selectedTx) {
      setSelectedEvents([]);
      return;
    }
    api
      .getTransactionDetail(selectedTx.id)
      .then((d) => setSelectedEvents(d.events))
      .catch(() => setSelectedEvents([]));
  }, [selectedTx?.id]);

  const counts = {
    successful: allTx.filter((t) => t.status === 'Completed').length,
    captured: allTx.filter((t) => t.status === 'Captured').length,
    pending: allTx.filter((t) => t.status === 'Pending').length,
    failed: allTx.filter((t) => t.status === 'Failed').length,
    flagged: allTx.filter((t) => t.risk_category === 'High Risk' || t.risk_category === 'Medium Risk').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            Payment Monitoring
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Live-style database polling monitor (15s interval) tracking payment states and event timelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Last polled: {formatTimestamp(lastPolled)}
          </span>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-poll (15s)</span>
          </label>
          <button
            type="button"
            onClick={fetchFeed}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Completed', value: counts.successful, filter: 'Completed', color: 'text-emerald-700' },
          { label: 'Captured', value: counts.captured, filter: 'Captured', color: 'text-[#1D4ED8]' },
          { label: 'Pending', value: counts.pending, filter: 'Pending', color: 'text-amber-700' },
          { label: 'Failed', value: counts.failed, filter: 'Failed', color: 'text-red-700' },
          { label: 'Flagged for Review', value: counts.flagged, filter: 'All', color: 'text-purple-700' },
        ].map((box) => (
          <button
            key={box.label}
            type="button"
            onClick={() => setStatusFilter(box.filter)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              statusFilter === box.filter && box.label !== 'Flagged for Review'
                ? 'bg-blue-50/70 border-[#1D4ED8]'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500">{box.label}</div>
            <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${box.color}`}>
              {box.value}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment ID or customer..."
            aria-label="Search payment monitor"
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
          />
        </div>
        <select
          aria-label="Monitor payment status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        >
          <option value="All">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Captured">Captured</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
        <input
          type="date"
          aria-label="Monitor start date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        />
      </div>

      {/* Master-Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0B1B36]">Monitored Payments Stream</h2>
            <span className="text-xs text-slate-500">Polling mode · {allTx.length} records</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {allTx.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => setSelectedTx(tx)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${
                  selectedTx?.id === tx.id ? 'bg-blue-50/60' : ''
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#1D4ED8]">{tx.id}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-600 truncate">{tx.customer_id}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {formatTimestamp(tx.created_at)} · {tx.source}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-xs font-bold text-[#0B1B36]">
                    {formatCurrency(tx.amount, tx.currency)}
                  </span>
                  <PaymentStatusLabel status={tx.status} />
                  <RiskIndicator category={tx.risk_category} score={tx.risk_score} />
                </div>
              </button>
            ))}
            {allTx.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No payment records match the current filter.
              </div>
            )}
          </div>
        </div>

        {/* Event History Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {selectedTx ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Selected Payment</div>
                  <h3 className="text-base font-bold font-mono text-[#0B1B36]">{selectedTx.id}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedTx.customer_id} · {selectedTx.payment_method}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTransaction(selectedTx.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Full Investigation
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-slate-500">Amount</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-[#0B1B36] mt-0.5">
                    {formatCurrency(selectedTx.amount, selectedTx.currency)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-slate-500">Risk Assessment</div>
                  <div className="mt-1">
                    <RiskIndicator
                      category={selectedTx.risk_category}
                      score={selectedTx.risk_score}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700">Payment Event History</h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="p-3 text-xs flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-mono font-semibold text-slate-800">{ev.event_type}</div>
                          <div className="text-slate-600 mt-0.5">{ev.event_details}</div>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                        {formatTimestamp(ev.created_at)}
                      </span>
                    </div>
                  ))}
                  {selectedEvents.length === 0 && (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      No payment events logged yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-xs text-slate-500">
              Select a payment on the left to inspect its event timeline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
