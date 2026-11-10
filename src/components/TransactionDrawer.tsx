import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquarePlus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { api, formatCurrency, formatTimestamp } from '../services/api';
import type {
  AlertRecord,
  PaymentEvent,
  ReviewNote,
  ReviewStatus,
  TransactionRecord,
} from '../types';
import { PaymentStatusLabel, ReviewStatusLabel, RiskIndicator } from './RiskBadge';

interface TransactionDrawerProps {
  transactionId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function TransactionDrawer({
  transactionId,
  onClose,
  onUpdated,
}: TransactionDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TransactionRecord | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTransactionDetail(id);
      setTx(data.transaction);
      setEvents(data.events);
      setNotes(data.notes);
      setAlerts(data.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      setFeedback(null);
      setNoteInput('');
      loadDetail(transactionId);
    } else {
      setTx(null);
    }
  }, [transactionId]);

  if (!transactionId) return null;

  const handleReviewChange = async (nextStatus: ReviewStatus) => {
    if (!tx) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.updateTransactionReview(
        tx.id,
        nextStatus,
        noteInput.trim() || undefined
      );
      setTx(res.transaction);
      setNotes(res.notes);
      setEvents(res.events);
      setNoteInput('');
      setFeedback(`Review status updated to "${nextStatus}".`);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx || !noteInput.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.addTransactionNote(tx.id, noteInput.trim());
      setNotes(res.notes);
      setNoteInput('');
      setFeedback('Internal analyst note saved.');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReanalyze = async () => {
    if (!tx) return;
    setReanalyzing(true);
    setFeedback(null);
    try {
      const res = await api.reanalyzeTransaction(tx.id);
      setTx(res.transaction);
      await loadDetail(tx.id);
      setFeedback('Risk score and explanation refreshed.');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-analyze transaction');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction details for ${transactionId}`}
    >
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">Transaction Investigation</p>
            <h2 className="text-lg font-bold text-[#0B1B36] font-mono tabular-nums">
              {transactionId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction details"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-32 bg-slate-100 rounded-xl" />
              <div className="h-44 bg-slate-100 rounded-xl" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {!loading && tx && (
            <>
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Amount</div>
                  <div className="text-lg font-bold text-[#0B1B36] font-mono tabular-nums">
                    {formatCurrency(tx.amount, tx.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Payment Status</div>
                  <PaymentStatusLabel status={tx.status} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Risk Signal</div>
                  <RiskIndicator category={tx.risk_category} score={tx.risk_score} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Source</div>
                  <div className="text-sm font-medium text-slate-800">{tx.source}</div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs text-slate-500">Customer Identifier</div>
                  <div className="font-mono text-slate-900 mt-0.5 break-all">{tx.customer_id}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs text-slate-500">PayPal Order ID</div>
                  <div className="font-mono text-slate-900 mt-0.5 break-all">
                    {tx.paypal_order_id || 'Direct Merchant Settlement'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs text-slate-500">Payment Method (Sanitized)</div>
                  <div className="font-medium text-slate-900 mt-0.5">{tx.payment_method}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs text-slate-500">Timestamp</div>
                  <div className="font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatTimestamp(tx.created_at)}
                  </div>
                </div>
              </div>

              {/* AI Explanation Panel */}
              <div className="p-5 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6D28D9]" />
                    <h3 className="text-sm font-semibold text-[#3B0764]">
                      AI-Assisted Risk Explanation
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-white text-[#5B21B6] border border-[#DDD6FE] hover:bg-purple-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
                    <span>{reanalyzing ? 'Analyzing...' : 'Refresh Explanation'}</span>
                  </button>
                </div>

                <p className="text-sm leading-relaxed text-[#2E1065]">{tx.ai_explanation}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DDD6FE]/70 text-xs text-[#5B21B6]">
                  <span>
                    Mode:{' '}
                    {tx.explanation_provider === 'gemini'
                      ? 'Google Gemini API'
                      : 'Deterministic Fallback Explanation'}
                  </span>
                  <span>Recommended: {tx.recommended_action}</span>
                </div>
                <p className="text-xs text-slate-600">
                  Decision-support notice: Risk scores highlight unusual payment signals for analyst review and are never proof of fraudulent intent.
                </p>
              </div>

              {/* Risk Factor Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0B1B36]">
                    Deterministic Score Breakdown ({tx.risk_score}/100)
                  </h3>
                  <span className="text-xs text-slate-500">Rule-based primary scoring</span>
                </div>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                  {(tx.risk_factors || []).map((factor) => (
                    <div
                      key={factor.id}
                      className="p-3.5 flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-900">
                          {factor.label}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="text-xs font-mono text-slate-500">{factor.signal}</span>
                        </div>
                        <div className="text-xs text-slate-600">{factor.detail}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono tabular-nums text-xs font-semibold ${
                            factor.points > 0 ? 'text-[#B91C1C]' : 'text-slate-400'
                          }`}
                        >
                          +{factor.points} / {factor.maxPoints}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Human Review Workflow */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#0B1B36]">
                      Human Analyst Review Decision
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customers are never automatically blocked solely from an AI score.
                    </p>
                  </div>
                  <ReviewStatusLabel status={tx.review_status} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReviewChange('Pending Review')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      tx.review_status === 'Pending Review'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Pending Review
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReviewChange('Reviewed — No Issue Identified')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      tx.review_status === 'Reviewed — No Issue Identified'
                        ? 'bg-[#15803D] text-white border-[#15803D]'
                        : 'bg-white text-[#15803D] border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reviewed — No Issue Identified</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReviewChange('Escalated for Further Review')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      tx.review_status === 'Escalated for Further Review'
                        ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                        : 'bg-white text-[#B91C1C] border-red-300 hover:bg-red-50'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Escalated for Further Review</span>
                  </button>
                </div>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <label htmlFor="tx-review-note" className="block text-xs font-medium text-slate-700">
                    Internal Analyst Note
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="tx-review-note"
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Add verification context or escalation reason..."
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !noteInput.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>
                  </div>
                </form>

                {notes.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-medium text-slate-500">Analyst Notes ({notes.length})</div>
                    {notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg bg-white border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="font-medium text-slate-700">{n.author}</span>
                          <span className="font-mono tabular-nums">{formatTimestamp(n.created_at)}</span>
                        </div>
                        <p className="text-slate-800">{n.note_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Alerts & Payment Event History */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#0B1B36]">Associated Alerts</h3>
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-900">{a.alert_type}</div>
                        <div className="text-amber-800 mt-0.5">{a.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pb-6">
                <h3 className="text-sm font-semibold text-[#0B1B36]">Payment Event History</h3>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {events.map((ev) => (
                    <div key={ev.id} className="p-3 text-xs flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-mono font-semibold text-slate-800">{ev.event_type}</div>
                          <div className="text-slate-600 mt-0.5">{ev.event_details}</div>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-slate-400 shrink-0">
                        {formatTimestamp(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
