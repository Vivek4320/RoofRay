"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, LogOut, UserRound, ShieldCheck, MessageCircle, ChevronRight, KeyRound } from "lucide-react";
import { clearSession } from "@/lib/supabase";

type UserData = {
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("roofray_access_token");
    if (!token) {
      window.location.replace("/login?redirect=/profile");
      return;
    }
    const stored = localStorage.getItem("roofray_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem("roofray_user"); }
    }
    setReady(true);
  }, []);

  function logout() {
    clearSession();
    window.location.replace("/");
  }

  if (!ready) {
    return <main className="min-h-screen bg-[#080C15] flex items-center justify-center text-slate-400">Loading profile...</main>;
  }

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email available";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-[#080C15] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(37,99,235,0.14),transparent_32%),radial-gradient(circle_at_10%_90%,rgba(59,130,246,0.08),transparent_28%)]" />

      <header className="relative z-10 border-b border-white/[0.06] bg-[#080C15]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={190} height={65} className="h-12 w-auto object-contain" priority />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-blue-400/30 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your Profile</h1>
          <p className="mt-2 text-sm text-slate-400">Manage your RoofRay account and access your solar assistant.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0D1421]/90 shadow-2xl shadow-black/20">
            <div className="relative h-32 overflow-hidden border-b border-white/[0.06] bg-[#101A2B]">
              <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-blue-600/15 blur-3xl" />
              <div className="absolute left-1/3 top-10 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl" />
            </div>

            <div className="px-6 pb-7 sm:px-8">
              <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[5px] border-[#0D1421] bg-blue-600 text-3xl font-bold shadow-xl shadow-blue-600/20">
                    {initial}
                  </div>
                  <div className="pb-1">
                    <h2 className="text-2xl font-bold text-white">{name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{email}</p>
                  </div>
                </div>
                <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/10">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>

              <div className="mt-8 border-t border-white/[0.06] pt-6">
                <h3 className="text-sm font-semibold text-white">Personal information</h3>
                <div className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><UserRound className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="text-xs text-slate-500">Full name</p><p className="mt-0.5 truncate text-sm font-medium text-slate-200">{name}</p></div>
                  </div>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Mail className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="text-xs text-slate-500">Email address</p><p className="mt-0.5 break-all text-sm font-medium text-slate-200">{email}</p></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-blue-400/15 bg-blue-500/[0.06] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400"><ShieldCheck className="h-5 w-5" /></div>
              <h3 className="mt-5 text-lg font-semibold">Account active</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Your RoofRay account is ready to use. Continue your rooftop solar analysis anytime.</p>
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-[#0D1421]/90 p-2">
              <Link href="/#top" className="group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.04]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><MessageCircle className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Talk to RoofRay</p><p className="mt-0.5 text-xs text-slate-500">Open your solar assistant</p></div>
                <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
              </Link>
              <Link href="/reset-password" className="group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.04]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><KeyRound className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Password</p><p className="mt-0.5 text-xs text-slate-500">Change your password</p></div>
                <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
