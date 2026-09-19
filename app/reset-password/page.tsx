"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { updatePassword } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get("access_token");
    const errorDescription = hashParams.get("error_description");

    const savedToken = localStorage.getItem("roofray_access_token");

    if (token) {
      setAccessToken(token);
    } else if (errorDescription) {
      setError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
    } else if (savedToken) {
      // Allow logged-in users to change their password from Profile.
      setAccessToken(savedToken);
    } else {
      setError("This password reset link is invalid or has expired. Please request a new link.");
    }
  }, []);

  function validateForm() {
    if (!accessToken) return "This password reset link is invalid or has expired.";
    if (!password) return "Please enter a new password.";
    if (password.length < MIN_PASSWORD_LENGTH) return "Password must be at least 6 characters.";
    if (password.length > MAX_PASSWORD_LENGTH) return "Password must be 72 characters or fewer.";
    if (!confirm) return "Please confirm your new password.";
    if (password !== confirm) return "Passwords do not match.";
    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      await updatePassword(accessToken, password);
      setSuccess(true);
      setPassword("");
      setConfirm("");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-[#E2E8F0] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="w-full max-w-lg rounded-[2rem] border border-[#1E293B] bg-[#0D1424]/95 p-6 sm:p-10 shadow-2xl shadow-black/30">
        <Link href="/" className="inline-flex mb-8"><Image src="/Logo-removebg-preview.png" alt="RoofRay" width={220} height={80} className="h-16 w-auto object-contain" priority /></Link>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/20"><LockKeyhole className="h-7 w-7 text-blue-400" /></div>
        <p className="section-label mb-3">Account security</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-white">{success ? "Password updated." : "Create a new password."}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{success ? "Your RoofRay password has been updated successfully. You can continue directly to your profile." : "Choose a new password for your RoofRay account."}</p>

        {success ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-300"><ShieldCheck className="h-4 w-4 shrink-0" />Your password was changed successfully.</div>
            <Link href="/profile" className="btn-primary w-full"><span>Go to profile</span><ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">New password</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" /><input className="auth-input pl-12 pr-12" type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={MAX_PASSWORD_LENGTH} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Enter new password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-blue-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Confirm new password</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" /><input className="auth-input pl-12" type="password" autoComplete="new-password" maxLength={MAX_PASSWORD_LENGTH} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Repeat new password" /></div></label>
            {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
            <button disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit">{loading ? "Updating password..." : "Update password"}{!loading && <ArrowRight className="h-4 w-4" />}</button>
          </form>
        )}
        {!success && <p className="mt-7 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">← Back to login</Link></p>}
      </div>
    </main>
  );
}