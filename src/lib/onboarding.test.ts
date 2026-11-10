import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS,
  calculateTourProgress,
  getNextStepIndex,
  getPreviousStepIndex,
  ONBOARDING_STORAGE_KEY,
} from './onboarding.ts';

test('TOUR_STEPS contains essential dashboard feature walkthrough items', () => {
  assert.ok(TOUR_STEPS.length >= 5, 'Should have at least 5 tour steps');
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.ok(ids.includes('welcome'), 'Has welcome step');
  assert.ok(ids.includes('kpis'), 'Has KPI metrics step');
  assert.ok(ids.includes('activity'), 'Has activity charts step');
  assert.ok(ids.includes('transactions'), 'Has transactions ledger step');
  assert.ok(ids.includes('alerts'), 'Has security alerts step');
  assert.ok(ids.includes('sidebar'), 'Has sidebar navigation step');

  for (const step of TOUR_STEPS) {
    assert.ok(step.title && step.title.length > 5, `Step ${step.id} has descriptive title`);
    assert.ok(step.description && step.description.length > 15, `Step ${step.id} has description`);
    assert.ok(step.targetSelector.startsWith('['), `Step ${step.id} uses valid attribute selector`);
  }
});

test('calculateTourProgress calculates correct percentage across steps', () => {
  assert.equal(calculateTourProgress(0, 6), 17); // 1/6 ~ 16.67 -> 17%
  assert.equal(calculateTourProgress(2, 6), 50); // 3/6 -> 50%
  assert.equal(calculateTourProgress(5, 6), 100); // 6/6 -> 100%
  assert.equal(calculateTourProgress(-1, 6), 17); // clamped
  assert.equal(calculateTourProgress(10, 6), 100); // clamped
  assert.equal(calculateTourProgress(0, 0), 0);
});

test('getNextStepIndex and getPreviousStepIndex bounds check properly', () => {
  const total = 6;
  assert.equal(getNextStepIndex(0, total), 1);
  assert.equal(getNextStepIndex(4, total), 5);
  assert.equal(getNextStepIndex(5, total), 5); // clamped at max

  assert.equal(getPreviousStepIndex(5), 4);
  assert.equal(getPreviousStepIndex(1), 0);
  assert.equal(getPreviousStepIndex(0), 0); // clamped at min
});

test('ONBOARDING_STORAGE_KEY is non-empty string', () => {
  assert.equal(typeof ONBOARDING_STORAGE_KEY, 'string');
  assert.ok(ONBOARDING_STORAGE_KEY.includes('paypal_shield'));
});
