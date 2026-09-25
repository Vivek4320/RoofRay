"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type SolarAnalysis = Record<string, unknown>;

const initialMessage: ChatMessage = { id: "roofray-welcome", role: "assistant", content: "" };

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("roofray_access_token") || "";
}

async function getValidToken() {
  const token = getToken();

  // The chat API already verifies the access token server-side.
  // Avoid an extra Supabase round-trip on every message.
  if (token) return token;

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
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreenPage = pathname === "/chat";
  const [open, setOpen] = useState(isFullScreenPage);
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
    } catch { }
  }

  useEffect(() => {
    if (isFullScreenPage) setOpen(true);
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
  }, [isFullScreenPage]);

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
        } catch { } finally { setLocationLoading(false); }
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
    } catch { }
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
        <section aria-label="RoofRay AI assistant" className={isFullScreenPage
          ? "fixed inset-0 z-[80] flex h-screen w-screen flex-col overflow-hidden bg-[#0B1220] text-white"
          : "fixed bottom-0 right-0 z-[80] flex h-[min(760px,100vh)] w-full flex-col overflow-hidden border border-blue-400/20 bg-[#0B1220] text-white shadow-2xl shadow-black/50 sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100vh-2rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:rounded-3xl lg:bottom-7 lg:right-7"}
          >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#0B1220] px-4">
            {isFullScreenPage && (
              <button
                type="button"
                onClick={() => router.push("/")}
                aria-label="Back to Home"
                title="Back to Home"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-400 transition-all duration-200 hover:border-blue-400/30 hover:bg-white/[0.06] hover:text-white active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>Back to Home</span>
              </button>
            )}

            <div className="flex h-10 items-center gap-1">
              {/* Reset / New chat button */}
              <button
                type="button"
                onClick={() => { setMessages([]); setRoofArea(null); setMonthlyBill(null); setShading(null); setHasStarted(false); }}
                aria-label="Reset RoofRay chat"
                title="New chat"
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-all duration-200 ease-out hover:bg-white/[0.06] hover:text-blue-400 active:scale-90"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[18px] w-[18px] transition-transform duration-500 ease-out group-hover:rotate-360"
                >
                  <path d="M3 12a9 9 0 1 1 3.2 6.9" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => { if (isFullScreenPage) router.push("/"); else setOpen(false); }}
                aria-label="Close RoofRay chat"
                title="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-all duration-200 ease-out hover:bg-white/[0.06] hover:text-white active:scale-90"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[18px] w-[18px]"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#0B1220] p-4">
            {!hasStarted && (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <Image
                  src="/Logo-removebg-preview.png"
                  alt="RoofRay Logo"
                  width={260}
                  height={100}
                  priority
                  className="h-auto w-52 object-contain"
                />
                <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-slate-400">
                  Ask me anything about your rooftop solar potential
                </p>
              </div>
            )}
            {messages.filter((message) => message.content.trim()).map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex items-end gap-2 justify-start"}>
                {message.role === "assistant" && (
                  <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-300/15 bg-blue-500/10">
                    <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={28} height={28} className="h-7 w-7 object-contain" />
                  </div>
                )}
                <div className={message.role === "user" ? "max-w-[86%] rounded-2xl rounded-br-md border border-blue-400/20 bg-blue-600 px-4 py-3 text-sm leading-6 shadow-lg shadow-blue-950/20" : "max-w-[86%] rounded-2xl rounded-bl-md border border-white/8 bg-[#111B2B] px-4 py-3 text-sm leading-6 text-slate-200 shadow-lg shadow-black/10"}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex w-full items-end justify-start gap-2">
                <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-300/15 bg-blue-500/10">
                  <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={28} height={28} className="h-7 w-7 animate-pulse object-contain" />
                </div>
                <div className="flex min-h-12 items-center gap-2 rounded-2xl rounded-bl-md border border-white/8 bg-[#111B2B] px-3.5 py-3 text-xs text-slate-400 shadow-lg shadow-black/10">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
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
