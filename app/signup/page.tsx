"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound, Sun } from "lucide-react";
import { saveSession, supabaseAuth } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function validateForm() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName) return "Please enter your full name.";
    if (normalizedName.length < 2) return "Full name must be at least 2 characters.";
    if (normalizedName.length > 80) return "Full name must be 80 characters or fewer.";
    if (!/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u.test(normalizedName)) {
      return "Full name contains invalid characters.";
    }

    if (!normalizedEmail) return "Please enter your email address.";
    if (normalizedEmail.length > 254) return "Email address is too long.";
    if (!EMAIL_REGEX.test(normalizedEmail)) return "Please enter a valid email address.";

    if (!password) return "Please create a password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password.length > 72) return "Password must be 72 characters or fewer.";
    if (!confirm) return "Please confirm your password.";
    if (password !== confirm) return "Passwords do not match.";

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await supabaseAuth("signup", email.trim(), password, name.trim());
      if (data?.access_token) {
        saveSession(data);
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get("redirect") || "/";
        window.location.href = redirectUrl;
      } else {
        setMessage("Account created successfully. You can now log in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-[#E2E8F0] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 overflow-hidden rounded-[2rem] border border-[#1E293B] bg-[#0D1424]/95 shadow-2xl shadow-black/30">
        <section className="hidden lg:flex relative flex-col justify-between p-12 bg-[#101827] border-r border-[#1E293B]">
          <Link href="/" className="inline-flex w-fit">
            <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={260} height={90} className="h-20 w-auto object-contain" priority />
          </Link>
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/20">
              <Sun className="h-7 w-7 text-blue-400" />
            </div>
            <p className="section-label mb-4">Start with RoofRay</p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight text-white">
              Make your rooftop ready for smarter solar decisions.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              Create your account and keep your RoofRay experience connected as you explore your rooftop&apos;s solar potential.
            </p>
          </div>
          <div className="space-y-3 text-xs text-slate-500">
            {["Simple rooftop analysis", "Clear solar feasibility insights", "One account for your RoofRay experience"].map((item) => (
              <div key={item} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400"><Check className="h-3 w-3" /></span>{item}</div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex">
              <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={220} height={80} className="h-16 w-auto object-contain" priority />
            </Link>
          </div>

          <div className="max-w-md mx-auto">
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-blue-400 transition-colors">← Back to RoofRay</Link>
            <p className="section-label mt-8 mb-3">Create account</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-white">Join RoofRay.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Create your account to start using your RoofRay solar assistant.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Full name</span>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input className="auth-input pl-12" type="text" required autoComplete="name" maxLength={80} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Your name" />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Email address</span>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input className="auth-input pl-12" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input className="auth-input pl-12 pr-12" type={showPassword ? "text" : "password"} required autoComplete="new-password" maxLength={72} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Create a password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-blue-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Confirm password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input className="auth-input pl-12" type="password" required autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Repeat your password" />
                </div>
              </label>

              {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
              {message && <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">{message}</p>}

              <button disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit">
                {loading ? "Creating account..." : "Create account"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">Log in</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
