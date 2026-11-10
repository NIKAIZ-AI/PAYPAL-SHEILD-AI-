export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  highlightText?: string;
  badge?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const ONBOARDING_STORAGE_KEY = 'paypal_shield_tour_completed_v1';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-tour="overview-header"]',
    title: 'Welcome to PayPal Shield AI',
    description:
      'Your real-time fraud defense and transaction intelligence center. This guided walkthrough introduces key controls, risk analysis tools, and decision-support signals.',
    badge: 'Overview',
    highlightText: 'Automated monitoring with explainable AI support',
    position: 'bottom',
  },
  {
    id: 'kpis',
    targetSelector: '[data-tour="kpi-metrics"]',
    title: 'Executive KPI Metrics',
    description:
      'Monitor live transaction velocity, total payment volume, approval rates, and average risk score compared to the prior period.',
    badge: 'Telemetry',
    highlightText: 'Real-time aggregated performance & velocity metrics',
    position: 'bottom',
  },
  {
    id: 'activity',
    targetSelector: '[data-tour="activity-charts"]',
    title: 'Payment Velocity & Risk Distribution',
    description:
      'Analyze payment trends across timeframes and visualize transaction risk distribution across Low, Medium, and High deterministic risk categories.',
    badge: 'Analytics',
    highlightText: 'Dual-engine charts with multi-horizon breakdown',
    position: 'top',
  },
  {
    id: 'transactions',
    targetSelector: '[data-tour="recent-transactions"]',
    title: 'Transaction Ledger & Deep Investigation',
    description:
      'Click any transaction row to open the full investigation drawer, view deterministic risk factor weights, inspect PayPal gateway signals, and read Gemini-powered explanations.',
    badge: 'Investigation',
    highlightText: 'Detailed audit trails with multi-signal breakdown',
    position: 'top',
  },
  {
    id: 'alerts',
    targetSelector: '[data-tour="security-alerts"]',
    title: 'Automated Security Alerts',
    description:
      'Prioritized queue of anomalous payment events—such as velocity spikes, geographical mismatches, and chargeback anomalies—requiring immediate analyst review.',
    badge: 'Alert Center',
    highlightText: 'High-severity alerts with quick transaction lookup',
    position: 'left',
  },
  {
    id: 'sidebar',
    targetSelector: '[data-tour="sidebar-nav"]',
    title: 'Specialized Defense Modules',
    description:
      'Navigate to AI Risk Analysis, customizable Fraud Intelligence rules, Payment Monitoring filters, and the PayPal Developer Sandbox simulator.',
    badge: 'Navigation',
    highlightText: 'Full suite of fraud prevention and sandbox tooling',
    position: 'right',
  },
];

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(completed = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (completed) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  } catch {}
}

export function calculateTourProgress(stepIndex: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  const clamped = Math.max(0, Math.min(stepIndex, totalSteps - 1));
  return Math.round(((clamped + 1) / totalSteps) * 100);
}

export function getNextStepIndex(currentIndex: number, totalSteps: number): number {
  return Math.min(currentIndex + 1, totalSteps - 1);
}

export function getPreviousStepIndex(currentIndex: number): number {
  return Math.max(currentIndex - 1, 0);
}
