"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sun } from "lucide-react";
import { requestPasswordReset, saveSession, supabaseAuth } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  function validateEmail(value: string) {
    const normalizedEmail = value.trim();
    if (!normalizedEmail) return "Please enter your email address.";
    if (normalizedEmail.length > 254) return "Email address is too long.";
    if (!EMAIL_REGEX.test(normalizedEmail)) return "Please enter a valid email address.";
    return "";
  }

  function validateForm() {
    const emailError = validateEmail(email);
    if (emailError) return emailError;
    if (!password) return "Please enter your password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password.length > 72) return "Password must be 72 characters or fewer.";
    return "";
  }

  async function handleForgotPassword() {
    setError("");
    setResetMessage("");
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setResetLoading(true);
    try {
      const redirectTo = window.location.origin + "/reset-password";
      await requestPasswordReset(email.trim(), redirectTo);
      setResetMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the password reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResetMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await supabaseAuth("login", email.trim(), password);
      saveSession(data);
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get("redirect") || "/";
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-[#E2E8F0] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 overflow-hidden rounded-[2rem] border border-[#1E293B] bg-[#0D1424]/95 shadow-2xl shadow-black/30">
        <section className="hidden lg:flex relative flex-col justify-between p-12 bg-[#101827] border-r border-[#1E293B]">
          <Link href="/" className="inline-flex w-fit">
            <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={260} height={90} className="h-20 w-auto object-contain" priority />
          </Link>
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/20">
              <Sun className="h-7 w-7 text-blue-400" />
            </div>
            <p className="section-label mb-4">Welcome back</p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight text-white">Continue your solar journey with RoofRay.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">Sign in to keep your rooftop analysis experience connected and ready for your next solar decision.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-blue-400" />Secure authentication powered by Supabase</div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><Link href="/" className="inline-flex"><Image src="/Logo-removebg-preview.png" alt="RoofRay" width={220} height={80} className="h-16 w-auto object-contain" priority /></Link></div>

          <div className="max-w-md mx-auto">
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-blue-400 transition-colors">← Back to RoofRay</Link>
            <p className="section-label mt-8 mb-3">Account access</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-white">Welcome back.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Enter your details to continue to your RoofRay solar assistant.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Email address</span>
                <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" /><input className="auth-input pl-12" type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); setResetMessage(""); }} placeholder="you@example.com" /></div>
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-300">Password</span>
                  <button type="button" disabled={resetLoading} className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50" onClick={handleForgotPassword}>{resetLoading ? "Sending..." : "Forgot password?"}</button>
                </div>
                <div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" /><input className="auth-input pl-12 pr-12" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); setResetMessage(""); }} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-blue-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              </label>

              {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
              {resetMessage && <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">{resetMessage}</p>}

              <button disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit">{loading ? "Signing in..." : "Log in"}{!loading && <ArrowRight className="h-4 w-4" />}</button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-500">Don&apos;t have an account? <Link href="/signup" className="font-semibold text-blue-400 hover:text-blue-300">Create one</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}