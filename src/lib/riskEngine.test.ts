import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTransactionRisk,
  classifyRiskScore,
  DEFAULT_RISK_CONFIG,
} from './riskEngine';

test('classifyRiskScore respects default 0-29, 30-69, 70-100 bands', () => {
  assert.equal(classifyRiskScore(0), 'Low Risk');
  assert.equal(classifyRiskScore(29), 'Low Risk');
  assert.equal(classifyRiskScore(30), 'Medium Risk');
  assert.equal(classifyRiskScore(69), 'Medium Risk');
  assert.equal(classifyRiskScore(70), 'High Risk');
  assert.equal(classifyRiskScore(100), 'High Risk');
});

test('classifyRiskScore honors custom thresholds', () => {
  const custom = { mediumMin: 20, highMin: 60 };
  assert.equal(classifyRiskScore(19, custom), 'Low Risk');
  assert.equal(classifyRiskScore(25, custom), 'Medium Risk');
  assert.equal(classifyRiskScore(60, custom), 'High Risk');
});

test('low-risk routine transaction scores below 30 and provides non-accusatory explanation', () => {
  const result = calculateTransactionRisk({
    amount: 48.5,
    currency: 'USD',
    customer_id: 'cust_usr_001',
    status: 'Completed',
    account_age_days: 240,
    metadata_complete: true,
    country_mismatch: false,
    pattern_shift: false,
    customer_avg_amount: 45,
    customer_tx_count_24h: 1,
    customer_failed_attempts_24h: 0,
  });

  assert.ok(result.risk_score < 30, `Expected <30, got ${result.risk_score}`);
  assert.equal(result.risk_category, 'Low Risk');
  assert.match(result.fallback_explanation, /decision-support/i);
});

test('high-risk anomalous transaction scores >= 70 and clamps <= 100', () => {
  const result = calculateTransactionRisk({
    amount: 4500,
    currency: 'USD',
    customer_id: 'cust_usr_999',
    status: 'Failed',
    account_age_days: 1,
    metadata_complete: false,
    country_mismatch: true,
    pattern_shift: true,
    customer_avg_amount: 120,
    customer_tx_count_24h: 8,
    customer_failed_attempts_24h: 4,
  });

  assert.ok(result.risk_score >= 70 && result.risk_score <= 100);
  assert.equal(result.risk_category, 'High Risk');
  assert.equal(result.recommended_action, 'Hold & Escalate for Manual Verification');
  assert.match(result.fallback_explanation, /not confirmed fraud/i);
  assert.equal(result.risk_factors.length, 7);
});

test('medium-risk transaction identifies moderate elevation without false high classification', () => {
  const result = calculateTransactionRisk(
    {
      amount: 850,
      currency: 'USD',
      customer_id: 'cust_usr_042',
      status: 'Completed',
      account_age_days: 10,
      metadata_complete: true,
      country_mismatch: false,
      pattern_shift: true,
      customer_avg_amount: 260,
      customer_tx_count_24h: 2,
      customer_failed_attempts_24h: 1,
    },
    DEFAULT_RISK_CONFIG
  );

  assert.ok(result.risk_score >= 30 && result.risk_score < 70, `Got ${result.risk_score}`);
  assert.equal(result.risk_category, 'Medium Risk');
});
