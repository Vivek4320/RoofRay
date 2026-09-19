"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, LogOut, UserRound, ShieldCheck, MessageCircle } from "lucide-react";
import { clearSession } from "@/lib/supabase";

type UserData = {
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("roofray_access_token");
    const storedUser = localStorage.getItem("roofray_user");

    if (!token) {
      window.location.replace("/login?redirect=/profile");
      return;
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("roofray_user");
      }
    }

    setReady(true);
  }, []);

  function handleLogout() {
    clearSession();
    window.location.replace("/");
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#0B0F1A] flex items-center justify-center text-slate-400">
        Loading profile...
      </main>
    );
  }

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email available";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-[#E2E8F0] px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-blue-400 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to RoofRay
          </Link>
          <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={180} height={60} className="h-12 w-auto object-contain" priority />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#1E293B] bg-[#0D1424]/95 shadow-2xl shadow-black/30">
          <div className="h-32 sm:h-40 bg-[#101827] border-b border-[#1E293B]" />

          <div className="px-6 pb-8 sm:px-10 sm:pb-10">
            <div className="-mt-12 sm:-mt-14 mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-full border-4 border-[#0D1424] bg-blue-600/15 text-3xl sm:text-4xl font-bold text-blue-300 shadow-xl shadow-blue-500/10">
                  {initial}
                </div>
                <div className="pb-1">
                  <p className="section-label mb-1">RoofRay account</p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">{name}</h1>
                </div>
              </div>
              <button onClick={handleLogout} className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/15 transition-colors">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#1E293B] bg-[#101827] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <UserRound className="h-5 w-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Full name</p>
                <p className="mt-1 text-sm font-medium text-slate-200 break-words">{name}</p>
              </div>

              <div className="rounded-2xl border border-[#1E293B] bg-[#101827] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Mail className="h-5 w-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Email address</p>
                <p className="mt-1 text-sm font-medium text-slate-200 break-all">{email}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-500/15 bg-blue-500/5 p-5">
              <div className="flex gap-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                <div>
                  <h2 className="font-semibold text-white">Your RoofRay account is active</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    You can use your account to access RoofRay&apos;s solar assistant and continue your rooftop analysis.
                  </p>
                </div>
              </div>
            </div>

            <Link href="/#top" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
              <MessageCircle className="h-4 w-4" />
              Talk to RoofRay
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
