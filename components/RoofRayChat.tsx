"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type SolarAnalysis = Record<string, unknown>;

const initialMessage: ChatMessage = { id: "roofray-welcome", role: "assistant", content: "" };

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("roofray_access_token") || "";
}

async function getValidToken() {
  const token = getToken();
  if (token) {
    const refreshToken = localStorage.getItem("roofray_refresh_token") || "";
    if (!refreshToken) return token;

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return token;

      const response = await fetch(
        supabaseUrl + "/auth/v1/user",
        {
          headers: {
            apikey: anonKey,
            Authorization: "Bearer " + token,
          },
          cache: "no-store",
        },
      );

      if (response.ok) return token;
    } catch {}
  }

  const refreshToken = localStorage.getItem("roofray_refresh_token") || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!refreshToken || !supabaseUrl || !anonKey) return "";

  try {
    const response = await fetch(
      supabaseUrl + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      },
    );
    if (!response.ok) return "";

    const data = await response.json();
    if (data.access_token) localStorage.setItem("roofray_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("roofray_refresh_token", data.refresh_token);
    return data.access_token || "";
  } catch {
    return "";
  }
}

function getStoredAnalysis(): SolarAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem("roofray_solar_analysis");
    return value ? (JSON.parse(value) as SolarAnalysis) : null;
  } catch { return null; }
}

function readNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function RoofRayChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "detecting" | "ready" | "warning" | "denied" | "unavailable">("idle");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [solarContext, setSolarContext] = useState<SolarAnalysis | null>(null);
  const [roofArea, setRoofArea] = useState<number | null>(null);
  const [monthlyBill, setMonthlyBill] = useState<number | null>(null);
  const [shading, setShading] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const currentStep = shading !== null ? 4 : monthlyBill !== null ? 3 : roofArea !== null ? 2 : 1;

  const starterOptions = useMemo(() => roofArea === null ? ["How does RoofRay work?", "What data do you analyze?"] : monthlyBill === null ? ["Why do you need my bill?", "Can I use an estimated bill?"] : shading === null ? [] : ["Explain my solar potential", "What affects my savings?", "Explain the shadow analysis"], [roofArea, monthlyBill, shading]);

  const quickOptions = useMemo(() => {
    if (roofArea === null || monthlyBill === null || shading !== null) return [];
    return ["No", "Partial", "Heavy"];
  }, [roofArea, monthlyBill, shading]);

  function hydrateStoredLocation() {
    try {
      const stored = sessionStorage.getItem("roofray_location");
      if (!stored) return;
      const value = JSON.parse(stored) as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
      const latitude = readNumber(value.latitude);
      const longitude = readNumber(value.longitude);
      const accuracy = readNumber(value.accuracy);
      if (latitude !== null && longitude !== null) setLocationCoords({ latitude, longitude });
      if (accuracy !== null) setLocationAccuracy(accuracy);
      if (latitude !== null && longitude !== null) setLocationStatus(accuracy !== null && accuracy > 100 ? "warning" : "ready");
    } catch {}
  }

  useEffect(() => {
    setSolarContext(getStoredAnalysis());
    hydrateStoredLocation();
    const handleOpen = () => {
      setOpen(true);
      if (!getStoredAnalysis()) void loadLocationAnalysis();
    };
    window.addEventListener("roofray:open-chat", handleOpen);

    if (sessionStorage.getItem("roofray_pending_chat") === "true") {
      sessionStorage.removeItem("roofray_pending_chat");
      setOpen(true);
      void loadLocationAnalysis();
    }

    return () => window.removeEventListener("roofray:open-chat", handleOpen);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function loadLocationAnalysis() {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    setLocationStatus("detecting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setLocationCoords({ latitude, longitude });
        setLocationAccuracy(accuracy);
        setLocationStatus(accuracy > 100 ? "warning" : "ready");
        sessionStorage.setItem("roofray_location", JSON.stringify({ latitude, longitude, accuracy, timestamp: Date.now() }));
        try {
          const response = await fetch("/api/solar-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude,
              longitude,
              peakPowerKw: 1,
              obstacleRadiusMeters: 500,
            }),
          });
          const data = await response.json();
          if (response.ok && data.ok && data.analysis) {
            sessionStorage.setItem("roofray_solar_analysis", JSON.stringify(data.analysis));
            setSolarContext(data.analysis);
          }
        } catch {} finally { setLocationLoading(false); }
      },
      (error) => {
        setLocationLoading(false);
        if (error.code === 1) setLocationStatus("denied");
        else setLocationStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function refreshAnalysisWithRoofArea(areaSqFt: number) {
    const location = solarContext?.location as Record<string, unknown> | undefined;
    const latitude = readNumber(location?.latitude);
    const longitude = readNumber(location?.longitude);
    if (latitude === null || longitude === null) return;

    try {
      const response = await fetch("/api/solar-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          peakPowerKw: 1,
          roofAreaM2: areaSqFt * 0.092903,
          obstacleRadiusMeters: 500,
        }),
      });
      const data = await response.json();
      if (response.ok && data.ok && data.analysis) {
        sessionStorage.setItem("roofray_solar_analysis", JSON.stringify(data.analysis));
        setSolarContext(data.analysis);
      }
    } catch {}
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setHasStarted(true);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const number = readNumber(content.replace(/[^0-9.]/g, ""));
    let nextRoofArea = roofArea;
    let nextMonthlyBill = monthlyBill;
    let nextShading = shading;

    if (roofArea === null && number !== null && number > 0) {
      nextRoofArea = number;
      setRoofArea(number);
      void refreshAnalysisWithRoofArea(number);
    } else if (roofArea !== null && monthlyBill === null && number !== null && number > 0) {
      nextMonthlyBill = number;
      setMonthlyBill(number);
    } else if (roofArea !== null && monthlyBill !== null && shading === null) {
      const normalized = content.toLowerCase();
      if (["no", "none", "no shading"].includes(normalized)) nextShading = "No";
      else if (normalized.includes("partial")) nextShading = "Partial";
      else if (normalized.includes("heavy")) nextShading = "Heavy";
      if (nextShading) setShading(nextShading);
    }

    const validToken = await getValidToken();
    if (!validToken) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Your login session is not available. Please log in again, then try your message." }]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + validToken },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          solarContext: {
            ...(solarContext || {}),
            userInputs: { roofAreaSqFt: nextRoofArea, monthlyBillInr: nextMonthlyBill, shading: nextShading },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to get a response.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: data.message }]);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  }

  function openChat() {
    if (!getToken()) {
      sessionStorage.setItem("roofray_pending_chat", "true");
      window.location.href = "/login?redirect=/";
      return;
    }
    setOpen(true);
    if (!solarContext) void loadLocationAnalysis();
  }

  return (
    <>
      {open && (
        <section aria-label="RoofRay AI assistant" className="fixed bottom-0 right-0 z-[80] flex h-[min(760px,100vh)] w-full flex-col overflow-hidden border border-blue-400/20 bg-[#0B1220] text-white shadow-2xl shadow-black/50 sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100vh-2rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:rounded-3xl lg:bottom-7 lg:right-7">
          <div className="flex h-16 items-center justify-end border-b border-white/5 bg-[#0B1220] px-4">

            <button type="button" onClick={() => { setMessages([]); setRoofArea(null); setMonthlyBill(null); setShading(null); setHasStarted(false); }} aria-label="Reset RoofRay chat" title="New chat" className="group relative right-auto top-auto z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20 active:scale-95"><span className="text-lg transition-transform duration-200 group-hover:rotate-180">↻</span></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close RoofRay chat" className="group relative right-auto top-auto z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20 active:scale-95"><span className="text-2xl font-light leading-none transition-transform duration-200 group-hover:rotate-90">×</span></button>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#0B1220] p-4">
            {!hasStarted && <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Image src="/Logo-removebg-preview.png" alt="RoofRay Logo" width={260} height={100} priority className="h-auto w-48 object-contain" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">RoofRay</h2>
            </div>}
            {messages.filter((message) => message.content.trim()).map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex items-end gap-2 justify-start"}>
                {message.role === "assistant" && <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-500/10 text-xs">☀</div>}
                <div className={message.role === "user" ? "max-w-[86%] rounded-2xl rounded-br-md border border-blue-400/20 bg-blue-600 px-4 py-3 text-sm leading-6 shadow-lg shadow-blue-950/20" : "max-w-[86%] rounded-2xl rounded-bl-md border border-white/8 bg-[#111B2B] px-4 py-3 text-sm leading-6 text-slate-200 shadow-lg shadow-black/10"}>
                  {message.content}
                </div>
              </div>
            ))}
            {quickOptions.length > 0 && (
              <div className="ml-9 flex flex-wrap gap-2">
                {quickOptions.map((option) => (
                  <button key={option} type="button" onClick={() => void sendMessage(option)} className="rounded-xl border border-blue-400/20 bg-blue-500/5 px-3 py-2 text-xs font-medium text-blue-200 transition hover:border-blue-300/40 hover:bg-blue-500/10">
                    {option === "No" ? "No shade" : option === "Partial" ? "Partial shade" : "Heavy shade"}
                  </button>
                ))}
              </div>
            )}
            {hasStarted && starterOptions.length > 0 && (<div className="ml-9"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Suggested</p><div className="flex flex-wrap gap-2">{starterOptions.map((option) => <button key={option} type="button" onClick={() => void sendMessage(option)} className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-left text-[11px] font-medium text-slate-300 transition hover:-translate-y-0.5 hover:border-blue-300/20 hover:bg-blue-500/5 hover:text-blue-200">{option}</button>)}</div></div>)}
            {loading && <div className="ml-9 flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/8 bg-[#111B2B] px-3 py-2.5 text-xs text-slate-400"><span>RoofRay is thinking</span><span className="flex gap-1"><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400" /><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" /><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" /></span></div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-white/10 bg-[#0D1422] p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between px-1"><span className="text-[10px] font-medium text-slate-600">Ask RoofRay anything</span><span className="text-[10px] text-slate-700">Enter to send</span></div>
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#111B2B] p-2 shadow-inner shadow-black/10">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={roofArea === null ? "e.g. 1200 sq ft" : monthlyBill === null ? "e.g. ₹2500 per month" : shading === null ? "No, Partial, or Heavy" : "Ask RoofRay anything about your analysis…"}
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-slate-500"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Send</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
