"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type SolarAnalysis = Record<string, unknown>;

const initialMessage: ChatMessage = {
  id: "roofray-welcome",
  role: "assistant",
  content: "Hi! I’m RoofRay ☀️ I’ll help you check your rooftop solar feasibility step by step. I’ve started with your location; first, tell me your roof area in sq ft.",
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("roofray_access_token") || "";
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
  const endRef = useRef<HTMLDivElement>(null);

  const currentStep = shading !== null ? 4 : monthlyBill !== null ? 3 : roofArea !== null ? 2 : 1;

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
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
          <header className="border-b border-white/10 bg-[#101827] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-600/15 text-lg shadow-inner shadow-blue-500/10">☀</div>
                  <div>
                    <div className="flex items-center gap-2"><p className="text-sm font-bold tracking-tight">RoofRay AI</p><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">Online</span></div>
                    <p className="text-xs text-slate-400">Your rooftop solar assistant</p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close chat">×</button>
            </div>
            <div className="mt-3 rounded-2xl border border-blue-400/15 bg-[#0D1728] px-3 py-2.5 text-xs">
              {locationStatus === "detecting" || locationLoading ? (
                <p className="text-blue-200">📍 Detecting your rooftop location…</p>
              ) : locationStatus === "ready" ? (
                <p className="text-emerald-300">📍 Rooftop location detected{locationAccuracy !== null ? ` • ±${Math.round(locationAccuracy)} m accuracy` : ""}</p>
              ) : locationStatus === "warning" ? (
                <div className="flex items-center justify-between gap-2 text-amber-200">
                  <p>📍 Location detected, but GPS accuracy is low{locationAccuracy !== null ? ` (±${Math.round(locationAccuracy)} m)` : ""}.</p>
                  <button type="button" onClick={() => void loadLocationAnalysis()} className="shrink-0 rounded-lg border border-amber-300/20 px-2 py-1 hover:bg-amber-400/10">Retry</button>
                </div>
              ) : locationStatus === "denied" ? (
                <div className="flex items-center justify-between gap-2 text-amber-200"><p>📍 Location permission is required for rooftop solar analysis.</p><button type="button" onClick={() => void loadLocationAnalysis()} className="shrink-0 rounded-lg border border-amber-300/20 px-2 py-1 hover:bg-amber-400/10">Retry</button></div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-slate-400"><p>📍 Rooftop location is not available.</p><button type="button" onClick={() => void loadLocationAnalysis()} className="shrink-0 rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Retry</button></div>
              )}
            </div>
          </header>

          <div className="border-b border-white/5 bg-[#0D1422] px-5 py-2.5">
            <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <span>Solar check</span><span>Step {currentStep} of 4</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1 flex-1 rounded-full ${step <= currentStep ? "bg-blue-500" : "bg-white/10"}`} />)}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#0B1220] p-4">
            {messages.map((message) => (
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
            {loading && <div className="ml-9 flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/8 bg-[#111B2B] px-3 py-2.5 text-xs text-slate-400"><span>RoofRay is thinking</span><span className="flex gap-1"><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400" /><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" /><i className="h-1 w-1 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" /></span></div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-white/10 bg-[#0D1422] p-3 sm:p-4">
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