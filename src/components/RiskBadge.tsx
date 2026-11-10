import type { ReviewStatus, RiskCategory, TransactionStatus } from '../types';

export function RiskIndicator({
  category,
  score,
}: {
  category: RiskCategory;
  score?: number;
}) {
  const styles =
    category === 'High Risk'
      ? 'text-[#B91C1C] bg-[#FEE2E2]/70 border-[#FECACA]'
      : category === 'Medium Risk'
        ? 'text-[#B45309] bg-[#FEF3C7]/70 border-[#FDE68A]'
        : 'text-[#15803D] bg-[#DCFCE7]/70 border-[#BBF7D0]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${styles}`}
    >
      {score !== undefined && (
        <span className="font-mono tabular-nums font-semibold">{score}</span>
      )}
      <span>{category}</span>
    </span>
  );
}

export function PaymentStatusLabel({ status }: { status: TransactionStatus }) {
  const styles =
    status === 'Completed' || status === 'Captured'
      ? 'text-[#15803D] bg-[#DCFCE7]/60 border-[#BBF7D0]'
      : status === 'Failed'
        ? 'text-[#B91C1C] bg-[#FEE2E2]/60 border-[#FECACA]'
        : 'text-[#B45309] bg-[#FEF3C7]/60 border-[#FDE68A]';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  );
}

export function ReviewStatusLabel({ status }: { status: ReviewStatus }) {
  const styles =
    status === 'Escalated for Further Review'
      ? 'text-[#B91C1C] bg-[#FEE2E2]/60 border-[#FECACA]'
      : status === 'Reviewed — No Issue Identified'
        ? 'text-[#15803D] bg-[#DCFCE7]/60 border-[#BBF7D0]'
        : 'text-slate-700 bg-slate-100 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  );
}
