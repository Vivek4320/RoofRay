'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  FileText,
  Lock,
  ArrowRight,
  Sparkles,
  X,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { saveSession, supabaseAuth } from '@/lib/supabase';

const METRICS = [
  { label: 'System size', value: '9.1 kW', sub: '26 panels', icon: '⚡' },
  { label: 'Est. generation', value: '38.6 units', sub: 'per day, avg.', icon: '☀️' },
  { label: 'Investment', value: '₹6,18,000', sub: 'before subsidy', icon: '💰' },
  { label: 'Monthly savings', value: '₹2,180', sub: 'at current tariff', icon: '📉' },
  { label: 'Payback period', value: '4.2 yrs', sub: 'vs 25-yr panel life', icon: '⏱️' },
  { label: 'Sun-hours', value: '5.4 / day', sub: 'long-term avg, this point', icon: '🌤️' },
];

export default function ReportPreview() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auth modal internal state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('roofray_access_token');
      const logged = Boolean(token);
      setIsLoggedIn(logged);
      if (logged) {
        setIsUnlocked(true);
      }
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const handleGetSampleReportClick = () => {
    const token = localStorage.getItem('roofray_access_token');
    if (token) {
      setIsLoggedIn(true);
      setIsUnlocked(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleModalSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setAuthLoading(true);
    try {
      const data = await supabaseAuth('login', email.trim(), password);
      saveSession(data);
      setIsLoggedIn(true);
      setIsUnlocked(true);
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDownloadSample = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <section id="report" className="relative bg-background overflow-hidden py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header — asymmetric: wide headline + narrow description */}
        <div className="mb-10 md:mb-16 grid gap-6 md:gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="section-label mb-5">The output</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              A verdict,
              <br />
              <span className="relative inline-block">
                <span className="blue-text">not a spreadsheet</span>
                <svg className="absolute -bottom-6 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                </svg>
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-muted lg:text-lg">
            Every number below is tied to your coordinates and your bill — no
            city-wide estimate standing in for your actual roof.
          </p>
        </div>

        {/* Report card wrapper */}
        <div className="relative">
          {/* Background shadow card (offset) */}
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-primary/5 opacity-40" />

          {/* Card status bar when unlocked */}
          {isUnlocked && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 sm:px-6 py-3 text-xs sm:text-sm text-emerald-300 backdrop-blur-md">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Sample Report Unlocked</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3.5 py-1.5 font-semibold text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadSuccess ? 'Downloaded PDF!' : 'Download Sample PDF'}
                </button>
                <button
                  onClick={() => setIsUnlocked(false)}
                  className="text-xs text-slate-400 hover:text-white underline transition-colors cursor-pointer"
                >
                  Lock Preview
                </button>
              </div>
            </div>
          )}

          <div className="solar-rays relative overflow-hidden rounded-3xl border border-primary/20 shadow-xl">
            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-primary/20 px-4 sm:px-6 py-3 sm:py-4 lg:px-8 bg-[#0D1424]/90">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-xs text-muted">
                  report_jamnagar_2026-07-24.json
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-4 py-1.5 font-mono text-[0.72rem] font-semibold text-emerald-400 border border-emerald-500/20">
                  PROFITABLE ✓
                </span>
              </div>
            </div>

            {/* Content area: Metrics grid with blur & overlay when locked */}
            <div className="relative">
              {/* Metrics grid */}
              <div
                className={`grid grid-cols-2 divide-x divide-y divide-primary/20 lg:grid-cols-3 transition-all duration-700 ${
                  !isUnlocked
                    ? 'filter blur-md opacity-40 select-none pointer-events-none'
                    : 'opacity-100'
                }`}
              >
                {METRICS.map((m, i) => (
                  <div
                    key={m.label}
                    className="group p-4 sm:p-6 lg:p-8 transition-all duration-300 hover:bg-primary/5"
                  >
                    <span className="text-xl mb-3 block">{m.icon}</span>
                    <p className="section-label !text-[0.65rem] !gap-1.5 mb-2 !before:w-3">{m.label}</p>
                    <p
                      className={`font-display text-xl sm:text-2xl lg:text-3xl font-bold transition-colors duration-300 ${
                        i === 4 ? 'blue-text' : 'text-white group-hover:text-primary'
                      }`}
                    >
                      {m.value}
                    </p>
                    <p className="mt-1.5 font-mono text-[0.72rem] text-muted">{m.sub}</p>
                  </div>
                ))}
              </div>

              {/* Centered Blur Overlay & "Get Sample Report" CTA (shown when locked) */}
              {!isUnlocked && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-[#0B0F1A]/75 backdrop-blur-md transition-all duration-500">
                  {/* Glowing Icon Badge */}
                  <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 shadow-lg shadow-blue-500/20">
                    <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  </div>

                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                    Sample Rooftop Solar Verdict
                  </h3>
                  <p className="max-w-md text-xs sm:text-sm text-slate-300 leading-relaxed mb-8">
                    View precise system size, daily generation estimations, and 25-year financial payback breakdown for your coordinates.
                  </p>

                  {/* Central "Get Sample Report" Button */}
                  <button
                    onClick={handleGetSampleReportClick}
                    className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-8 py-4 text-sm sm:text-base font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #1E40AF 100%)',
                      boxShadow: '0 0 30px rgba(37, 99, 235, 0.5), 0 4px 20px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-2.5">
                      <FileText className="h-5 w-5 text-blue-200 transition-transform group-hover:scale-110" />
                      Get Sample Report
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>

                  <p className="mt-5 text-xs text-slate-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-blue-400" />
                    <span>Please log in first to view or download the report</span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-primary/20 px-4 sm:px-6 py-3 sm:py-4 lg:px-8 bg-[#0D1424]/90">
              <p className="font-mono text-xs leading-relaxed text-muted">
                Forecast window: next 14 days, Open-Meteo · Irradiance baseline:
                NASA POWER · Subsidy slab not yet applied — ask for PM Surya Ghar
                estimate
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal (shown when user clicks Get Sample Report while logged out) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-[#0D1424] p-6 sm:p-8 shadow-2xl shadow-blue-500/10 text-left">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/20">
                <LockKeyhole className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="font-display text-2xl font-bold text-white">Login Required</h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Please log in to your RoofRay account to unlock and view the sample rooftop report.
              </p>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Email address</span>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="auth-input pl-12"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="auth-input pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {authError && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary w-full py-3.5 text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {authLoading ? 'Logging in...' : 'Log In & Unlock Report'}
                {!authLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-2 border-t border-slate-800 pt-5 text-center text-xs text-slate-400">
              <p>
                Don&apos;t have an account yet?{' '}
                <Link
                  href="/signup?redirect=/#report"
                  className="font-semibold text-blue-400 hover:text-blue-300 underline"
                >
                  Create Account
                </Link>
              </p>
              <p>
                Or jump to full{' '}
                <Link
                  href="/login?redirect=/#report"
                  className="font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                >
                  Login Page <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
