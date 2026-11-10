import React, { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, Save, Shield, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import type { AppSettings } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const updated = await api.updateSettings({
        appName: settings.appName,
        defaultRange: settings.defaultRange,
        autoRefreshEnabled: settings.autoRefreshEnabled,
        refreshIntervalSeconds: settings.refreshIntervalSeconds,
        aiExplanationsEnabled: settings.aiExplanationsEnabled,
        thresholds: settings.thresholds,
      });
      setSettings(updated);
      setSavedMsg('Settings persisted to SQLite successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const updated = await api.updateSettings({ resetDefaults: true });
      setSettings(updated);
      setSavedMsg('Risk thresholds and weights reset to defaults.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1B36] tracking-tight">
          Platform Settings
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Configure risk-scoring thresholds, dashboard refresh behavior, and verify server-side AI & PayPal Sandbox readiness.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Application & Risk Thresholds */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-[#0B1B36]">
              Application & Risk Threshold Preferences
            </h2>
            <p className="text-xs text-slate-500">
              Changes affect subsequent deterministic risk assessments and monitoring views.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="set-app-name" className="block font-medium text-slate-700 mb-1">
                Application Display Name
              </label>
              <input
                id="set-app-name"
                type="text"
                value={settings.appName}
                onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="set-range" className="block font-medium text-slate-700 mb-1">
                Default Dashboard Timeframe
              </label>
              <select
                id="set-range"
                value={settings.defaultRange}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultRange: e.target.value as AppSettings['defaultRange'],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
              </select>
            </div>

            <div>
              <label htmlFor="set-med-thresh" className="block font-medium text-slate-700 mb-1">
                Medium Risk Threshold (Min Score)
              </label>
              <input
                id="set-med-thresh"
                type="number"
                min="5"
                max="80"
                value={settings.thresholds.mediumMin}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      mediumMin: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label htmlFor="set-high-thresh" className="block font-medium text-slate-700 mb-1">
                High Risk Threshold (Min Score)
              </label>
              <input
                id="set-high-thresh"
                type="number"
                min="20"
                max="95"
                value={settings.thresholds.highMin}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      highMin: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label htmlFor="set-refresh" className="block font-medium text-slate-700 mb-1">
                Monitoring Polling Interval (Seconds)
              </label>
              <input
                id="set-refresh"
                type="number"
                min="5"
                max="300"
                value={settings.refreshIntervalSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    refreshIntervalSeconds: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoRefreshEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, autoRefreshEnabled: e.target.checked })
                  }
                />
                <span>Enable automatic polling on Payment Monitoring</span>
              </label>
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6D28D9]" />
              <h2 className="text-base font-semibold text-[#0B1B36]">AI Explanation Settings</h2>
            </div>
            <span className="text-xs font-medium text-slate-600">
              {settings.integrations.geminiConfigured
                ? 'Gemini API Key Detected (Server)'
                : 'Fallback Mode Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Gemini API Status</div>
              <div className="font-semibold text-[#0B1B36] mt-1">
                {settings.integrations.geminiConfigured ? 'Configured on Server' : 'Not Configured'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Active Explanation Model</div>
              <div className="font-mono font-semibold text-[#0B1B36] mt-1">
                {settings.integrations.geminiModel}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Deterministic Fallback</div>
              <div className="font-semibold text-emerald-700 mt-1">Always Ready</div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={settings.aiExplanationsEnabled}
              onChange={(e) =>
                setSettings({ ...settings, aiExplanationsEnabled: e.target.checked })
              }
            />
            <span>Enable Gemini AI natural-language explanations (falls back deterministically if unavailable)</span>
          </label>
        </div>

        {/* PayPal Sandbox Status (never exposes secrets) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0070E0]" />
              <h2 className="text-base font-semibold text-[#0B1B36]">
                PayPal Sandbox Configuration Status
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-600">
              Environment: {settings.integrations.paypalMode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Client ID Status</div>
              <div className="font-semibold text-[#0B1B36] mt-1">
                {settings.integrations.paypalClientIdConfigured
                  ? 'Configured (Server Env)'
                  : 'Missing'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Client Secret Status</div>
              <div className="font-semibold text-[#0B1B36] mt-1">
                {settings.integrations.paypalSecretConfigured
                  ? 'Configured (Hidden)'
                  : 'Missing'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Sandbox Connection Mode</div>
              <div className="font-semibold text-[#0B1B36] mt-1">
                {settings.integrations.paypalConfigured
                  ? 'Live Sandbox Orders v2'
                  : 'Developer Gateway Simulator'}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Security policy: API keys and PayPal secrets remain strictly on the backend and are never returned to the browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thresholds to Defaults</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
