"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Mail, LogOut, UserRound, ShieldCheck,
  MessageCircle, ChevronRight, KeyRound
} from "lucide-react";
import { clearSession } from "@/lib/supabase";

type UserData = {
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("roofray_access_token")) {
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
    return (
      <main className="min-h-screen bg-[#080C15] flex items-center justify-center text-slate-400">
        Loading profile...
      </main>
    );
  }

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email available";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-[#080C15] text-white">
      <header className="border-b border-white/[0.06] bg-[#080C15]">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="shrink-0">
            <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={190} height={65} className="h-12 w-auto object-contain" priority />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/[0.06] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-blue-500/[0.06] blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">Account</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your Profile</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Manage your RoofRay account and access your solar assistant.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            <section className="rounded-3xl border border-white/[0.08] bg-[#0D1421] shadow-2xl shadow-black/20">
              <div className="border-b border-white/[0.06] px-6 py-7 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-blue-300/30 bg-blue-600 text-3xl font-bold text-white shadow-lg shadow-blue-600/20">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-blue-400">RoofRay account</p>
                      <h2 className="mt-1 truncate text-2xl font-bold text-white">{name}</h2>
                      <p className="mt-1 break-all text-sm text-slate-400">{email}</p>
                    </div>
                  </div>

                  <button onClick={logout} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:border-red-400/30 hover:bg-red-400/10">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              </div>

              <div className="px-6 py-7 sm:px-8 sm:py-8">
                <h3 className="text-base font-semibold text-white">Personal information</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07]">
                  <div className="flex items-center gap-4 border-b border-white/[0.07] bg-white/[0.015] px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><UserRound className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="text-xs text-slate-500">Full name</p><p className="mt-1 truncate text-sm font-medium text-slate-200">{name}</p></div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/[0.015] px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Mail className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="text-xs text-slate-500">Email address</p><p className="mt-1 break-all text-sm font-medium text-slate-200">{email}</p></div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="rounded-3xl border border-blue-400/15 bg-[#0D1728] p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400"><ShieldCheck className="h-5 w-5" /></div>
                <h3 className="mt-5 text-lg font-semibold text-white">Account active</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Your RoofRay account is ready to use. Continue your rooftop solar analysis anytime.</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0D1421]">
                <Link href="/#top" className="group flex items-center gap-4 border-b border-white/[0.06] p-5 transition hover:bg-white/[0.035]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><MessageCircle className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Talk to RoofRay</p><p className="mt-1 text-xs text-slate-500">Open your solar assistant</p></div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
                </Link>
                <Link href="/reset-password" className="group flex items-center gap-4 p-5 transition hover:bg-white/[0.035]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><KeyRound className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Password</p><p className="mt-1 text-xs text-slate-500">Change your password</p></div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
