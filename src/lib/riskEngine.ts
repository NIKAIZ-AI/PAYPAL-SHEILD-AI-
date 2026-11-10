import type {
  RiskCategory,
  RiskEngineConfig,
  RiskEvaluationInput,
  RiskEvaluationResult,
  RiskFactor,
  RiskThresholds,
  RiskWeights,
} from '../types';

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  amountSpike: 25,
  highAbsoluteAmount: 18,
  repeatedFailedAttempts: 24,
  unusualVelocity: 15,
  newAccountAge: 10,
  metadataMismatch: 12,
  patternDeviation: 14,
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  mediumMin: 30,
  highMin: 70,
};

export const DEFAULT_RISK_CONFIG: RiskEngineConfig = {
  weights: DEFAULT_RISK_WEIGHTS,
  thresholds: DEFAULT_RISK_THRESHOLDS,
};

export function classifyRiskScore(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskCategory {
  if (score >= thresholds.highMin) {
    return 'High Risk';
  }
  if (score >= thresholds.mediumMin) {
    return 'Medium Risk';
  }
  return 'Low Risk';
}

export function getRecommendedAction(category: RiskCategory): string {
  switch (category) {
    case 'High Risk':
      return 'Hold & Escalate for Manual Verification';
    case 'Medium Risk':
      return 'Queue for Analyst Review';
    default:
      return 'Approve / Standard Monitoring';
  }
}

export function buildDeterministicExplanation(
  score: number,
  category: RiskCategory,
  factors: RiskFactor[],
  input: RiskEvaluationInput
): string {
  const activeFactors = factors.filter((f) => f.points > 0);
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: input.currency || 'USD',
  }).format(input.amount);

  if (activeFactors.length === 0) {
    return (
      `This ${formattedAmount} transaction scored ${score}/100 (${category}) because no elevated risk signals were triggered ` +
      `in the available history for ${input.customer_id}. This score serves as a decision-support indicator only and does not ` +
      `guarantee transaction legitimacy.`
    );
  }

  const topReasons = activeFactors
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((f) => f.detail.replace(/\.$/, '').toLowerCase());

  const joinedReasons =
    topReasons.length === 1
      ? topReasons[0]
      : topReasons.length === 2
        ? `${topReasons[0]} and ${topReasons[1]}`
        : `${topReasons.slice(0, -1).join(', ')}, and ${topReasons[topReasons.length - 1]}`;

  if (category === 'High Risk') {
    return (
      `Transaction of ${formattedAmount} is flagged for manual review (${score}/100, ${category}) because ${joinedReasons}. ` +
      `These indicators highlight unusual activity relative to baseline signals, not confirmed fraud—a human analyst should verify before taking action.`
    );
  }

  if (category === 'Medium Risk') {
    return (
      `Transaction of ${formattedAmount} received an elevated decision-support score (${score}/100, ${category}) due to ${joinedReasons}. ` +
      `This warrants routine secondary review alongside customer context rather than an automated block.`
    );
  }

  return (
    `Transaction of ${formattedAmount} scored ${score}/100 (${category}) with minor signals noted (${joinedReasons}). ` +
    `Standard monitoring is recommended; risk scores provide decision support rather than definitive intent.`
  );
}

export function calculateTransactionRisk(
  input: RiskEvaluationInput,
  config: RiskEngineConfig = DEFAULT_RISK_CONFIG
): RiskEvaluationResult {
  const weights = { ...DEFAULT_RISK_WEIGHTS, ...config.weights };
  const thresholds = { ...DEFAULT_RISK_THRESHOLDS, ...config.thresholds };
  const factors: RiskFactor[] = [];

  const amount = Math.max(0, Number(input.amount) || 0);
  const historicalAvg = Math.max(0, Number(input.customer_avg_amount) || 0);
  const failedAttempts = Math.max(0, Math.floor(Number(input.customer_failed_attempts_24h) || 0));
  const txCount24h = Math.max(0, Math.floor(Number(input.customer_tx_count_24h) || 0));
  const accountAgeDays =
    input.account_age_days === undefined ? 90 : Math.max(0, Number(input.account_age_days));

  // 1. Amount Spike vs Customer Baseline
  let spikePoints = 0;
  let spikeDetail = 'Transaction amount aligns with historical customer average';
  if (historicalAvg > 0) {
    const ratio = amount / historicalAvg;
    if (ratio >= 5) {
      spikePoints = weights.amountSpike;
      spikeDetail = `Transaction value is ${ratio.toFixed(1)}x higher than the customer's historical average ($${historicalAvg.toFixed(2)})`;
    } else if (ratio >= 3) {
      spikePoints = Math.round(weights.amountSpike * 0.68);
      spikeDetail = `Transaction value is ${ratio.toFixed(1)}x higher than the customer's baseline ($${historicalAvg.toFixed(2)})`;
    } else if (ratio >= 2) {
      spikePoints = Math.round(weights.amountSpike * 0.35);
      spikeDetail = `Transaction value is ${ratio.toFixed(1)}x above the customer's average ($${historicalAvg.toFixed(2)})`;
    }
  } else if (amount >= 2500) {
    spikePoints = Math.round(weights.amountSpike * 0.65);
    spikeDetail = 'No prior baseline exists for this identifier on a high-value ($2,500+) order';
  } else if (amount >= 1000) {
    spikePoints = Math.round(weights.amountSpike * 0.5);
    spikeDetail = 'No prior baseline exists for this identifier on a high-value order';
  }
  factors.push({
    id: 'amount_spike',
    label: 'Historical Value Deviation',
    signal: historicalAvg > 0 ? `${(amount / historicalAvg).toFixed(1)}x baseline` : 'No baseline',
    points: spikePoints,
    maxPoints: weights.amountSpike,
    severity: spikePoints >= weights.amountSpike * 0.6 ? 'high' : spikePoints > 0 ? 'medium' : 'low',
    detail: spikeDetail,
  });

  // 2. High Absolute Amount
  let highAmtPoints = 0;
  let highAmtDetail = 'Order value is within typical merchant ticket thresholds';
  if (amount >= 3000) {
    highAmtPoints = weights.highAbsoluteAmount;
    highAmtDetail = `High single-transaction value ($${amount.toFixed(2)}) exceeds $3,000 review threshold`;
  } else if (amount >= 1500) {
    highAmtPoints = Math.round(weights.highAbsoluteAmount * 0.65);
    highAmtDetail = `Elevated single-transaction value ($${amount.toFixed(2)}) exceeds $1,500`;
  } else if (amount >= 750) {
    highAmtPoints = Math.round(weights.highAbsoluteAmount * 0.3);
    highAmtDetail = `Moderate ticket value ($${amount.toFixed(2)}) above standard $750 tier`;
  }
  factors.push({
    id: 'high_absolute_amount',
    label: 'Ticket Size Threshold',
    signal: `$${amount.toFixed(2)}`,
    points: highAmtPoints,
    maxPoints: weights.highAbsoluteAmount,
    severity:
      highAmtPoints >= weights.highAbsoluteAmount * 0.6 ? 'high' : highAmtPoints > 0 ? 'medium' : 'low',
    detail: highAmtDetail,
  });

  // 3. Repeated Failed Attempts
  let failedPoints = 0;
  let failedDetail = 'No repeated failed payment attempts observed in the last 24 hours';
  const effectiveFailed = input.status === 'Failed' ? Math.max(failedAttempts, 1) : failedAttempts;
  if (effectiveFailed >= 3) {
    failedPoints = weights.repeatedFailedAttempts;
    failedDetail = `${effectiveFailed} recent failed payment attempts were recorded within 24 hours`;
  } else if (effectiveFailed === 2) {
    failedPoints = Math.round(weights.repeatedFailedAttempts * 0.65);
    failedDetail = '2 failed payment attempts were recorded in the last 24 hours';
  } else if (effectiveFailed === 1) {
    failedPoints = Math.round(weights.repeatedFailedAttempts * 0.25);
    failedDetail = '1 failed payment attempt occurred in the recent window';
  }
  factors.push({
    id: 'repeated_failures',
    label: 'Repeated Failed Attempts',
    signal: `${effectiveFailed} failed (24h)`,
    points: failedPoints,
    maxPoints: weights.repeatedFailedAttempts,
    severity:
      failedPoints >= weights.repeatedFailedAttempts * 0.6
        ? 'high'
        : failedPoints > 0
          ? 'medium'
          : 'low',
    detail: failedDetail,
  });

  // 4. Unusual Transaction Velocity
  let velocityPoints = 0;
  let velocityDetail = 'Transaction cadence is within normal customer frequency';
  if (txCount24h >= 6) {
    velocityPoints = weights.unusualVelocity;
    velocityDetail = `Unusual transaction frequency with ${txCount24h} attempts in 24 hours`;
  } else if (txCount24h >= 4) {
    velocityPoints = Math.round(weights.unusualVelocity * 0.6);
    velocityDetail = `Elevated transaction velocity (${txCount24h} transactions in 24 hours)`;
  }
  factors.push({
    id: 'unusual_velocity',
    label: 'Transaction Velocity',
    signal: `${txCount24h} tx / 24h`,
    points: velocityPoints,
    maxPoints: weights.unusualVelocity,
    severity:
      velocityPoints >= weights.unusualVelocity * 0.6
        ? 'high'
        : velocityPoints > 0
          ? 'medium'
          : 'low',
    detail: velocityDetail,
  });

  // 5. New Account Age
  let agePoints = 0;
  let ageDetail = `Established identifier age (${accountAgeDays} days)`;
  if (accountAgeDays <= 3) {
    agePoints = weights.newAccountAge;
    ageDetail = `Recently created account identifier (${accountAgeDays} days old)`;
  } else if (accountAgeDays <= 14) {
    agePoints = Math.round(weights.newAccountAge * 0.5);
    ageDetail = `Relatively new account identifier (${accountAgeDays} days old)`;
  }
  factors.push({
    id: 'new_account',
    label: 'Account Maturity',
    signal: `${accountAgeDays} days`,
    points: agePoints,
    maxPoints: weights.newAccountAge,
    severity: agePoints >= weights.newAccountAge * 0.8 ? 'medium' : 'low',
    detail: ageDetail,
  });

  // 6. Missing or Inconsistent Metadata
  const metadataComplete = input.metadata_complete !== false;
  const countryMismatch = Boolean(input.country_mismatch);
  let metaPoints = 0;
  let metaDetail = 'Transaction metadata and billing signals are consistent';
  if (!metadataComplete && countryMismatch) {
    metaPoints = weights.metadataMismatch;
    metaDetail = 'Incomplete transaction metadata combined with billing/location region mismatch';
  } else if (!metadataComplete) {
    metaPoints = Math.round(weights.metadataMismatch * 0.6);
    metaDetail = 'Missing or incomplete transaction verification metadata';
  } else if (countryMismatch) {
    metaPoints = Math.round(weights.metadataMismatch * 0.65);
    metaDetail = 'Inconsistent region signal detected in transaction metadata';
  }
  factors.push({
    id: 'metadata_consistency',
    label: 'Metadata Consistency',
    signal: !metadataComplete || countryMismatch ? 'Inconsistent' : 'Complete',
    points: metaPoints,
    maxPoints: weights.metadataMismatch,
    severity: metaPoints >= weights.metadataMismatch * 0.6 ? 'medium' : 'low',
    detail: metaDetail,
  });

  // 7. Behavioral / Pattern Deviation
  let patternPoints = 0;
  let patternDetail = 'Payment method and currency match prior customer behavior';
  if (input.pattern_shift) {
    patternPoints = weights.patternDeviation;
    patternDetail = 'Abrupt change in transaction pattern compared to historical customer activity';
  }
  factors.push({
    id: 'pattern_deviation',
    label: 'Pattern Continuity',
    signal: input.pattern_shift ? 'Shift detected' : 'Consistent',
    points: patternPoints,
    maxPoints: weights.patternDeviation,
    severity: patternPoints > 0 ? 'medium' : 'low',
    detail: patternDetail,
  });

  const rawSum = factors.reduce((sum, f) => sum + f.points, 0);
  const risk_score = Math.max(0, Math.min(100, Math.round(rawSum)));
  const risk_category = classifyRiskScore(risk_score, thresholds);
  const recommended_action = getRecommendedAction(risk_category);
  const fallback_explanation = buildDeterministicExplanation(
    risk_score,
    risk_category,
    factors,
    input
  );

  return {
    risk_score,
    risk_category,
    risk_factors: factors,
    recommended_action,
    fallback_explanation,
    assessed_at: new Date().toISOString(),
  };
}
