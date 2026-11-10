import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import { Interactive3DShield } from './Interactive3DShield';

export interface UserSession {
  email: string;
  name: string;
  role: 'Fraud & Risk Analyst' | 'Senior Compliance Officer' | 'Platform Engineer';
  organization: string;
}

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('analyst@merchant.com');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<
    'Fraud & Risk Analyst' | 'Senior Compliance Officer' | 'Platform Engineer'
  >('Fraud & Risk Analyst');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3D Card Parallax Tilt state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((y - centerY) / centerY) * 10;
    const rotateY = ((x - centerX) / centerX) * 10;
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setCardTilt({ rotateX, rotateY, glareX, glareY });
  };

  const handleMouseLeave = () => {
    setCardTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      onLogin({
        email: email.trim() || 'analyst@merchant.com',
        name:
          selectedRole === 'Senior Compliance Officer'
            ? 'Elena Rostova'
            : selectedRole === 'Platform Engineer'
              ? 'Marcus Vance'
              : 'Alex Mercer',
        role: selectedRole,
        organization: 'Apex Merchant Services',
      });
    }, 450);
  };

  const handleSelectRole = (
    role: 'Fraud & Risk Analyst' | 'Senior Compliance Officer' | 'Platform Engineer',
    defaultEmail: string
  ) => {
    setSelectedRole(role);
    setEmail(defaultEmail);
  };

  return (
    <div className="min-h-screen w-full bg-[#040814] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* 3D Cyber Perspective Floor Grid */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-96 pointer-events-none opacity-20 [transform:perspective(500px)_rotateX(65deg)] [transform-origin:bottom_center]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to top, black, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent 85%)',
        }}
      />

      {/* Dynamic ambient 3D glows */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] bg-sky-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header */}
      <header className="h-16 px-6 lg:px-12 border-b border-white/10 flex items-center justify-between z-20 backdrop-blur-xl bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0070E0] to-[#003087] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 border border-sky-400/30">
            <Shield className="w-5 h-5 text-sky-200" />
          </div>
          <div>
            <div className="font-display font-bold text-base text-white tracking-tight leading-none flex items-center gap-2">
              <span>PayPal Shield AI</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300">
                v2.4
              </span>
            </div>
            <div className="text-[10px] text-blue-300/80 font-medium tracking-wide">
              Payment Fraud Detection & Transaction Intelligence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-slate-400 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="font-mono text-[11px]">PayPal Sandbox & Gemini Core Active</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogin({
                email: 'analyst@merchant.com',
                name: 'Alex Mercer',
                role: 'Fraud & Risk Analyst',
                organization: 'Apex Merchant Services',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 border border-sky-400/30 flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/10"
          >
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Quick Access</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Split: 3D Interactive Scene + Parallax Tilt Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8 z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: 3D Interactive Shield Canvas & Persona Cards */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/15 to-sky-500/10 border border-sky-400/30 text-xs text-sky-300 backdrop-blur-md shadow-lg shadow-sky-950/40">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span>Merchant Compliance & Payment Risk Operations</span>
            </div>

            <div className="space-y-2 max-w-xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-display leading-[1.12]">
                Real-Time Payment Security &{' '}
                <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  AI Fraud Defense
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                Interact with the 3D security core below: rotate 360°, trigger laser scans, and test merchant roles with instant PayPal Sandbox checkout.
              </p>
            </div>

            {/* Interactive 3D Canvas Box */}
            <div className="w-full h-80 sm:h-96 relative rounded-2xl bg-gradient-to-b from-slate-900/60 via-[#071329]/80 to-[#040A17]/90 border border-sky-400/25 p-2 overflow-hidden shadow-2xl shadow-blue-950/70 group">
              <Interactive3DShield />
            </div>

            {/* Target Audience Persona Cards with 3D Pop */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              {[
                {
                  role: 'Fraud & Risk Analyst',
                  email: 'analyst@merchant.com',
                  desc: 'Investigate flagged transactions & manage security alerts',
                  metric: '10 Flagged Txns',
                  icon: Activity,
                },
                {
                  role: 'Senior Compliance Officer',
                  email: 'compliance@merchant.com',
                  desc: 'Audit explainability, policy rules & human review decisions',
                  metric: 'Audit Trail 100%',
                  icon: ShieldCheck,
                },
                {
                  role: 'Platform Engineer',
                  email: 'dev@merchant.com',
                  desc: 'Test PayPal Sandbox Orders v2 checkout & API telemetry',
                  metric: 'Orders v2 Active',
                  icon: Layers,
                },
              ].map((persona) => {
                const isSelected = selectedRole === persona.role;
                const Icon = persona.icon;
                return (
                  <button
                    key={persona.role}
                    type="button"
                    onClick={() => handleSelectRole(persona.role as UserSession['role'], persona.email)}
                    className={`text-left p-3 rounded-xl border transition-all duration-200 backdrop-blur-md transform-gpu hover:scale-[1.03] ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-600/30 to-sky-600/20 border-sky-400/60 shadow-lg shadow-sky-950/80 ring-1 ring-sky-400/40'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-sky-400/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-300' : 'text-slate-400'}`} />
                        <span className="text-xs font-semibold text-white">{persona.role}</span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">{persona.metric}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{persona.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: 3D Perspective Tilt Login Card */}
          <div className="lg:col-span-5 w-full [perspective:1200px]">
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`,
                transition: 'transform 0.15s ease-out',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-2xl bg-gradient-to-b from-[#0D1C38]/95 via-[#0A172F]/95 to-[#060E1E]/98 backdrop-blur-2xl border border-sky-400/30 p-6 sm:p-8 shadow-[0_0_50px_rgba(2,132,199,0.25)] relative overflow-hidden group"
            >
              {/* Dynamic 3D Glare Flare that tracks cursor */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300 group-hover:opacity-75"
                style={{
                  background: `radial-gradient(circle at ${cardTilt.glareX}% ${cardTilt.glareY}%, rgba(56, 189, 248, 0.25) 0%, transparent 60%)`,
                }}
              />

              <div className="space-y-1.5 mb-6 [transform:translateZ(30px)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-md shadow-blue-500/20">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                  </div>
                  <h2 className="text-xl font-bold font-display text-white">Merchant Portal Sign In</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Select your operations role or enter your credentials to access the live dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 [transform:translateZ(20px)]">
                <div className="space-y-1.5">
                  <label htmlFor="login-role" className="block text-xs font-medium text-slate-300">
                    Operating Role
                  </label>
                  <select
                    id="login-role"
                    value={selectedRole}
                    onChange={(e) =>
                      setSelectedRole(e.target.value as UserSession['role'])
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-slate-200 text-xs focus:outline-none focus:border-sky-400 focus:bg-white/[0.1] transition-colors"
                  >
                    <option value="Fraud & Risk Analyst" className="bg-[#0A1628] text-white">
                      Fraud & Risk Analyst (Investigation & Alerts)
                    </option>
                    <option value="Senior Compliance Officer" className="bg-[#0A1628] text-white">
                      Senior Compliance Officer (Audit & Governance)
                    </option>
                    <option value="Platform Engineer" className="bg-[#0A1628] text-white">
                      Platform Engineer (Sandbox & Orders API)
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-300">
                    Business Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="analyst@merchant.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-400 focus:bg-white/[0.1] transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-pass" className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Encrypted Authentication
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-pass"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-400 focus:bg-white/[0.1] transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5 [transform:translateZ(25px)]">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full group py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0070E0] via-blue-600 to-[#1D4ED8] hover:from-sky-500 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-blue-600/40 flex items-center justify-center gap-2 disabled:opacity-50 border border-sky-400/40 transform-gpu hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{isSubmitting ? 'Authenticating...' : `Enter as ${selectedRole}`}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLogin({
                        email: 'analyst@merchant.com',
                        name: 'Alex Mercer',
                        role: 'Fraud & Risk Analyst',
                        organization: 'Apex Merchant Services',
                      });
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-sky-200 hover:text-white bg-gradient-to-r from-sky-500/15 to-blue-600/15 hover:from-sky-500/25 hover:to-blue-600/25 border border-sky-400/35 transition-all flex items-center justify-center gap-1.5 shadow-sm transform-gpu hover:scale-[1.01]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>One-Click Analyst Access (Alex Mercer)</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 text-center pt-1 font-mono">
                  Role-based access control enabled. Enterprise single sign-on active.
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="h-12 px-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400/80 z-20 backdrop-blur-xl bg-slate-950/40">
        <span>PayPal Shield AI · Decision-Support System</span>
        <span>PayPal Sandbox Orders API v2 & Google Gemini Integration</span>
      </footer>
    </div>
  );
}
