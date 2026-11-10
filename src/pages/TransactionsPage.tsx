import React, { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { PaymentStatusLabel, ReviewStatusLabel, RiskIndicator } from '../components/RiskBadge';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type { TransactionRecord, TransactionStatus } from '../types';

interface TransactionsPageProps {
  initialSearch?: string;
  onSelectTransaction: (id: string) => void;
  refreshTick: number;
  onTransactionCreated: () => void;
}

export function TransactionsPage({
  initialSearch = '',
  onSelectTransaction,
  refreshTick,
  onTransactionCreated,
}: TransactionsPageProps) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState('All');
  const [riskCategory, setRiskCategory] = useState('All');
  const [source, setSource] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'risk_score'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick transaction recording modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAmount, setNewAmount] = useState('1450');
  const [newCustomer, setNewCustomer] = useState('cust_meridian_corp');
  const [newStatus, setNewStatus] = useState<TransactionStatus>('Completed');
  const [newAccountAge, setNewAccountAge] = useState('4');
  const [newMetadataComplete, setNewMetadataComplete] = useState(false);
  const [newCountryMismatch, setNewCountryMismatch] = useState(true);
  const [newPatternShift, setNewPatternShift] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
    setPage(1);
  }, [initialSearch]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getTransactions({
          search,
          status,
          riskCategory,
          source,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          sortBy,
          sortDir,
          page,
          limit: 10,
        });
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to fetch transactions');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [
    search,
    status,
    riskCategory,
    source,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    sortBy,
    sortDir,
    page,
    refreshTick,
  ]);

  const toggleSort = (col: 'date' | 'amount' | 'risk_score') => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('All');
    setRiskCategory('All');
    setSource('All');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const amountNum = Number(newAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setCreateError('Please enter a valid positive amount.');
      return;
    }
    if (!newCustomer.trim()) {
      setCreateError('Please provide a customer identifier.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.createTransaction({
        amount: amountNum,
        currency: 'USD',
        customer_id: newCustomer.trim(),
        status: newStatus,
        account_age_days: Number(newAccountAge) || 0,
        metadata_complete: newMetadataComplete,
        country_mismatch: newCountryMismatch,
        pattern_shift: newPatternShift,
      });
      setShowCreateModal(false);
      onTransactionCreated();
      onSelectTransaction(res.transaction.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to record transaction');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
            Transaction Management
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Search, filter, audit risk assessments, and submit human review decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Record Transaction</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search transactions by ID, PayPal Order ID, or Customer ID"
              placeholder="Search by Transaction ID, PayPal Order ID, or Customer..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#1D4ED8]"
            />
          </div>

          <select
            aria-label="Filter by payment status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Captured">Captured</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>

          <select
            aria-label="Filter by risk category"
            value={riskCategory}
            onChange={(e) => {
              setRiskCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
          >
            <option value="All">All Risk Categories</option>
            <option value="Low Risk">Low Risk (0–29)</option>
            <option value="Medium Risk">Medium Risk (30–69)</option>
            <option value="High Risk">High Risk (70–100)</option>
          </select>

          <select
            aria-label="Filter by transaction source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
          >
            <option value="All">All Sources</option>
            <option value="PayPal Sandbox">PayPal Sandbox</option>
            <option value="PayPal Gateway">PayPal Gateway</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end pt-1">
          <div>
            <label htmlFor="tx-date-from" className="block text-[11px] font-medium text-slate-500 mb-1">
              From Date
            </label>
            <input
              id="tx-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="tx-date-to" className="block text-[11px] font-medium text-slate-500 mb-1">
              To Date
            </label>
            <input
              id="tx-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="tx-min-amt" className="block text-[11px] font-medium text-slate-500 mb-1">
              Min Amount ($)
            </label>
            <input
              id="tx-min-amt"
              type="number"
              min="0"
              placeholder="0"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label htmlFor="tx-max-amt" className="block text-[11px] font-medium text-slate-500 mb-1">
              Max Amount ($)
            </label>
            <input
              id="tx-max-amt"
              type="number"
              min="0"
              placeholder="Any"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,27,54,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Customer Identifier</th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('amount')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('date')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Timestamp</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('risk_score')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Risk Assessment</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Review Status</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={8} className="py-3.5 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No transactions matched your current filters.
                  </td>
                </tr>
              ) : (
                items.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx.id)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer"
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
                    <td className="py-3 px-4">
                      <ReviewStatusLabel status={tx.review_status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500">{tx.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
          <div className="font-mono tabular-nums">
            Showing {items.length} of {total} transactions · Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Gateway Transaction Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Record Gateway Transaction"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0B1B36]">Record Gateway Transaction</h2>
                <p className="text-xs text-slate-500">
                  Evaluated immediately by the deterministic engine + Gemini AI
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTx} className="p-5 space-y-4 text-xs">
              {createError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  {createError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tx-record-amount" className="block font-medium text-slate-700 mb-1">
                    Amount (USD)
                  </label>
                  <input
                    id="tx-record-amount"
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tx-record-status" className="block font-medium text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    id="tx-record-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TransactionStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Captured">Captured</option>
                    <option value="Pending">Pending</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tx-record-customer" className="block font-medium text-slate-700 mb-1">
                    Customer Identifier
                  </label>
                  <input
                    id="tx-record-customer"
                    type="text"
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tx-record-age" className="block font-medium text-slate-700 mb-1">
                    Account Age (Days)
                  </label>
                  <input
                    id="tx-record-age"
                    type="number"
                    min="0"
                    value={newAccountAge}
                    onChange={(e) => setNewAccountAge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={!newMetadataComplete}
                    onChange={(e) => setNewMetadataComplete(!e.target.checked)}
                  />
                  <span>Incomplete transaction verification metadata</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={newCountryMismatch}
                    onChange={(e) => setNewCountryMismatch(e.target.checked)}
                  />
                  <span>Billing / region mismatch indicator</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={newPatternShift}
                    onChange={(e) => setNewPatternShift(e.target.checked)}
                  />
                  <span>Sudden change from historical payment pattern</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {creating ? 'Scoring...' : 'Save & Score Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
