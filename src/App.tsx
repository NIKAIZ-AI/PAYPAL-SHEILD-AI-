import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { LoginPage, type UserSession } from './components/LoginPage';
import { TransactionDrawer } from './components/TransactionDrawer';
import { AiRiskAnalysisPage } from './pages/AiRiskAnalysisPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FraudIntelligencePage } from './pages/FraudIntelligencePage';
import { OverviewPage } from './pages/OverviewPage';
import { PaymentMonitoringPage } from './pages/PaymentMonitoringPage';
import { PayPalSandboxPage } from './pages/PayPalSandboxPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { api } from './services/api';

type NavKey =
  | 'overview'
  | 'transactions'
  | 'ai-risk'
  | 'fraud-intel'
  | 'monitoring'
  | 'analytics'
  | 'alerts'
  | 'sandbox'
  | 'settings';

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { key: 'ai-risk', label: 'AI Risk Analysis', icon: BrainCircuit },
  { key: 'fraud-intel', label: 'Fraud Intelligence', icon: ShieldAlert },
  { key: 'monitoring', label: 'Payment Monitoring', icon: Activity },
  { key: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { key: 'alerts', label: 'Alerts & Notifications', icon: Bell },
  { key: 'sandbox', label: 'PayPal Sandbox', icon: CreditCard },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const DEFAULT_SESSION: UserSession = {
  email: 'analyst@merchant.com',
  name: 'Alex Mercer',
  role: 'Fraud & Risk Analyst',
  organization: 'Apex Merchant Services',
};

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('paypal_shield_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1' || params.get('dashboard') === '1') {
        return DEFAULT_SESSION;
      }
    }
    // Default to null so the user experiences the interactive 3D Login Page first!
    return null;
  });

  const [activeTab, setActiveTab] = useState<NavKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearchInput, setGlobalSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [sandboxConfigured, setSandboxConfigured] = useState(false);

  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  useEffect(() => {
    api
      .getAlerts()
      .then((res) => setUnreadAlerts(res.unreadCount))
      .catch(() => {});
    api
      .getPayPalStatus()
      .then((res) => setSandboxConfigured(res.configured))
      .catch(() => {});
  }, [refreshTick]);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(globalSearchInput.trim());
    setActiveTab('transactions');
  };

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const handleNavClick = (key: NavKey) => {
    setActiveTab(key);
    setMobileMenuOpen(false);
  };

  const handleLogin = (user: UserSession) => {
    setSession(user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('paypal_shield_session', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setSession(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('paypal_shield_session');
    }
  };

  // If not logged in, render interactive 3D login page
  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex bg-[#F6F8FC] text-[#0B1B36]">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Glass-Themed Sidebar: Sticky 100vh with zero blank space on scroll */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 bg-gradient-to-b from-[#0B172F] via-[#0D1E3D] to-[#071021] backdrop-blur-2xl border-r border-sky-400/25 text-slate-200 flex flex-col justify-between transition-transform duration-300 shadow-2xl shadow-sky-950/50 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex flex-col min-h-0 flex-1">
        {/* Brand header */}
        <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0070E0] to-[#003087] flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-tight text-white whitespace-nowrap">
                PayPal Shield AI
              </span>
              <span className="text-[10px] font-medium text-blue-300/80 -mt-0.5">
                Risk & Fraud Intelligence
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Operating Role User Pill inside Sidebar */}
        <div className="px-4 pt-3 pb-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-400/15 backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600/40 border border-blue-400/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                <User className="w-3.5 h-3.5 text-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{session.name}</div>
                <div className="text-[10px] text-blue-300/90 truncate">{session.role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out to Login Screen"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item.key)}
                className={`group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ease-out whitespace-nowrap transform-gpu ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/35 to-blue-500/20 text-white border border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] backdrop-blur-md scale-[1.02]'
                    : 'text-slate-300/85 hover:text-white hover:bg-white/[0.08] hover:border-blue-400/30 hover:scale-[1.02] hover:shadow-[0_0_18px_rgba(56,189,248,0.22)] border border-transparent active:scale-[0.99]'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-blue-400 to-sky-400 rounded-r-full shadow-sm shadow-blue-400"
                  />
                )}
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isActive
                        ? 'text-sky-400 scale-110'
                        : 'text-slate-400 group-hover:text-sky-300 group-hover:scale-110'
                    }`}
                  />
                  <span className="tracking-wide">{item.label}</span>
                </span>
                {item.key === 'alerts' && unreadAlerts > 0 && (
                  <span className="font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {unreadAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        </div>

        {/* Footer Support Notice & Role switcher */}
        <div className="shrink-0 p-3.5 m-3 rounded-xl border border-sky-400/20 bg-sky-950/30 backdrop-blur-md text-[11px] text-slate-300/80 space-y-2 shadow-inner">
          <div className="flex items-center gap-1.5 font-semibold text-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>Payment Decision Intelligence</span>
          </div>
          <p className="leading-relaxed text-slate-400 text-[10.5px]">
            Risk scores provide decision support to assist merchant transaction review.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-semibold text-sky-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/35 border border-sky-400/35 flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Switch Role / Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={globalSearchInput}
                onChange={(e) => setGlobalSearchInput(e.target.value)}
                placeholder="Search Tx ID or customer..."
                aria-label="Global transaction search"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F6F8FC] border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#1D4ED8]"
              />
            </form>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span>{todayFormatted}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700">
                {sandboxConfigured ? 'PayPal Gateway: Connected' : 'PayPal Gateway: Active'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleNavClick('alerts')}
              aria-label={`View alerts (${unreadAlerts} unread)`}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B91C1C] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </button>

            {/* Security Portal switch button */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
              title="Return to the Security Portal to switch operating role"
            >
              <Shield className="w-3.5 h-3.5 text-sky-200" />
              <span>Security Portal</span>
            </button>

            {/* Profile lockup with role & switch/sign out affordance */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className="flex items-center gap-2.5 text-left focus:outline-none"
                aria-label="Open analyst profile and settings"
              >
                {!avatarError ? (
                  <img
                    src="/src/assets/images/analyst_avatar_1794298971628.jpg"
                    alt={session.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center">
                    {session.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-[#0B1B36] leading-tight">
                    {session.name}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">{session.role}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="Switch role or sign out to 3D login page"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
                aria-label="Sign out to login page"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              onSelectTransaction={setSelectedTransactionId}
              onNavigate={(tab) => handleNavClick(tab as NavKey)}
              refreshTick={refreshTick}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsPage
              initialSearch={submittedSearch}
              onSelectTransaction={setSelectedTransactionId}
              refreshTick={refreshTick}
              onTransactionCreated={triggerRefresh}
            />
          )}
          {activeTab === 'ai-risk' && <AiRiskAnalysisPage />}
          {activeTab === 'fraud-intel' && (
            <FraudIntelligencePage
              onSelectTransaction={setSelectedTransactionId}
              refreshTick={refreshTick}
              onUpdated={triggerRefresh}
            />
          )}
          {activeTab === 'monitoring' && (
            <PaymentMonitoringPage
              onSelectTransaction={setSelectedTransactionId}
              refreshTick={refreshTick}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsPage refreshTick={refreshTick} />}
          {activeTab === 'alerts' && (
            <AlertsPage
              onSelectTransaction={setSelectedTransactionId}
              refreshTick={refreshTick}
              onAlertsChanged={triggerRefresh}
            />
          )}
          {activeTab === 'sandbox' && (
            <PayPalSandboxPage
              onSelectTransaction={setSelectedTransactionId}
              onPaymentCaptured={triggerRefresh}
            />
          )}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Transaction Detail Investigation Drawer */}
      <TransactionDrawer
        transactionId={selectedTransactionId}
        onClose={() => setSelectedTransactionId(null)}
        onUpdated={triggerRefresh}
      />
    </div>
  );
}
