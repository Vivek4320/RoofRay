"use client";

import Image from "next/image";
import MapplsLocationMap from "@/components/MapplsLocationMap";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type DragEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LuArrowDown, LuArrowUp, LuCheck, LuCheckCheck, LuCopy, LuDownload, LuEllipsis, LuEye, LuFile, LuFileSpreadsheet, LuFileText, LuImage, LuMapPin, LuPanelLeft, LuPencil, LuPlus, LuRotateCcw, LuSatellite, LuSquare, LuSun, LuTrash2, LuUserRound, LuX } from "react-icons/lu";
import { safeUUID } from "@/lib/uuid";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  failedInput?: string;
};
type SolarAnalysis = Record<string, unknown>;
type AttachedFile = { id: string; file: File; preview?: string };

const LOGO_SRC = "/Logo-removebg-preview.png";
const COMPOSER_MAX_HEIGHT = 160;
const AUTO_SCROLL_THRESHOLD = 96;
const MAX_ATTACHMENTS = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCS = ["application/pdf", "text/plain", "text/csv"];
const ALLOWED_TYPES = [...ALLOWED_IMAGES, ...ALLOWED_DOCS];

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("roofray_access_token") || "";
}

async function getValidToken() {
  const token = getToken();
  const refreshToken = localStorage.getItem("roofray_refresh_token") || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return "";

  // First verify the cached access token. Supabase access tokens are short-lived,
  // so an existing localStorage token may be expired even while the session is valid.
  if (token) {
    try {
      const response = await fetch(supabaseUrl + "/auth/v1/user", {
        headers: {
          apikey: anonKey,
          Authorization: "Bearer " + token,
        },
        cache: "no-store",
      });
      if (response.ok) return token;
    } catch {
      // Fall through to refresh the session.
    }
  }

  if (!refreshToken) return "";

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
    if (data.user) localStorage.setItem("roofray_user", JSON.stringify(data.user));
    return data.access_token || "";
  } catch {
    return "";
  }
}

function getStoredAnalysis(): SolarAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const value =
      sessionStorage.getItem("roofray_solar_analysis") ||
      localStorage.getItem("roofray_solar_analysis");
    return value ? (JSON.parse(value) as SolarAnalysis) : null;
  } catch { return null; }
}

function readNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

async function prepareRoofPhoto(file: File): Promise<string | null> {
  if (!ALLOWED_IMAGES.includes(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------------- */
/* Lightweight inline + block markdown rendering for assistant messages.   */
/* Supports: paragraphs, bullet lists, numbered lists, **bold**, `code`.   */
/* ----------------------------------------------------------------------- */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code key={`${keyPrefix}-c-${i}`} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-200">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderAssistantContent(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];
  let blockKey = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      const text = paragraphBuffer.join(" ");
      blocks.push(
        <p key={`p-${blockKey}`} className="leading-relaxed">
          {renderInline(text, `p-${blockKey++}`)}
        </p>,
      );
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      const items = currentList.items;
      const isOrdered = currentList.type === "ol";
      blocks.push(
        isOrdered ? (
          <ol key={`l-${blockKey}`} className="list-decimal space-y-1 pl-5 leading-relaxed marker:text-slate-500">
            {items.map((item, idx) => (
              <li key={idx}>{renderInline(item, `li-${blockKey}-${idx}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`l-${blockKey}`} className="list-disc space-y-1 pl-5 leading-relaxed marker:text-slate-500">
            {items.map((item, idx) => (
              <li key={idx}>{renderInline(item, `li-${blockKey}-${idx}`)}</li>
            ))}
          </ul>
        ),
      );
      blockKey += 1;
      currentList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)/);

    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(numberedMatch[1]);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}


type ChatRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

function chatTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim());
  if (!firstUser) return "New chat";
  const clean = firstUser.content.replace(/\s+/g, " ").trim();
  return clean.length > 35 ? clean.slice(0, 35).trimEnd() + "…" : clean;
}

function ChatSidebar({
  chats,
  activeChatId,
  mobileOpen,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onCloseMobile,
  onOpenSidebar,
}: {
  chats: ChatRecord[];
  activeChatId: string;
  mobileOpen: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onCloseMobile: () => void;
  onOpenSidebar: () => void;
}) {
  const router = useRouter();
  const [profileName, setProfileName] = useState("Profile");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("roofray_user") || "{}");
      setProfileName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Profile");
    } catch {
      setProfileName("Profile");
    }
  }, []);

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[100] flex flex-col border-r border-white/[0.06] bg-[#090F1C] text-white shadow-2xl shadow-black/40 transition-[width,transform] duration-200 ease-out
          ${mobileOpen ? "w-[min(300px,85vw)] translate-x-0 md:w-[270px]" : "w-[270px] -translate-x-full md:w-[56px] md:translate-x-0"}`}
        aria-label="RoofRay chat history"
      >
        {!mobileOpen && (
          <div className="flex h-[60px] shrink-0 items-center justify-center border-b border-white/[0.05]">
            <button type="button" onClick={onOpenSidebar} className="rr-icon-btn" aria-label="Open chat history" title="Open sidebar">
              <LuPanelLeft className="h-[19px] w-[19px]" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className={`flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.05] px-4 ${!mobileOpen ? "md:hidden" : ""}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">RoofRay</p>
              <p className="truncate text-[10px] text-slate-500">AI Solar Assistant</p>
            </div>
          </div>
          <button type="button" onClick={onCloseMobile} className="rr-icon-btn" aria-label="Collapse sidebar" title="Collapse sidebar">
            <LuPanelLeft className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
        </div>

        <div className={`p-3 ${!mobileOpen ? "md:hidden" : ""}`}>
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-[13px] font-medium text-slate-200 transition hover:border-blue-400/20 hover:bg-blue-500/[0.08] hover:text-white"
            title="New chat"
          >
            <LuPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            New chat
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto px-2 pb-3 ${!mobileOpen ? "md:hidden" : ""}`}>
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Recent chats</p>
          <div className="space-y-0.5">
            {chats.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-600">No conversations yet</p>
            ) : (
              chats.map((chat) => (
                <div key={chat.id} className={`group flex items-center gap-1 rounded-xl px-2 py-1 transition ${chat.id === activeChatId ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    className="min-w-0 flex-1 truncate px-1.5 py-2 text-left text-[12px] text-slate-300 hover:text-white"
                    title={chat.title}
                  >
                    {chat.title}
                  </button>
                  <div className="relative shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                      aria-label={`Options for ${chat.title}`}
                      title="Chat options"
                      onClick={(event) => {
                        event.stopPropagation();
                        const menu = event.currentTarget.nextElementSibling as HTMLElement | null;
                        document.querySelectorAll("[data-chat-menu]").forEach((item) => {
                          if (item !== menu) item.classList.add("hidden");
                        });
                        menu?.classList.toggle("hidden");
                      }}
                    >
                      <LuEllipsis className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <div data-chat-menu className="absolute right-0 top-9 z-[120] hidden w-32 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111A2B] p-1 shadow-xl shadow-black/40">
                      <button
                        type="button"
                        className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRename(chat.id);
                          (event.currentTarget.parentElement as HTMLElement | null)?.classList.add("hidden");
                        }}
                      >
                        <LuPencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Rename
                      </button>
                      <button
                        type="button"
                        className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(chat.id);
                          (event.currentTarget.parentElement as HTMLElement | null)?.classList.add("hidden");
                        }}
                      >
                        <LuTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`border-t border-white/[0.05] p-3 ${!mobileOpen ? "p-2" : ""}`}>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className={`flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white ${!mobileOpen ? "justify-center" : ""}`}
            title="Profile"
            aria-label="Profile"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/10">
              <LuUserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className={!mobileOpen ? "hidden" : "truncate"}>{profileName}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* ChatHeader                                                              */
/* ----------------------------------------------------------------------- */

function ChatHeader({ onReset, onClose }: { onReset: () => void; onClose: () => void }) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0A1020]/98 px-4 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Image src="/favicon.ico" alt="RoofRay" width={100} height={100} priority className="h-12 w-12 shrink-0 object-contain" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={onReset} aria-label="Start new chat" title="New chat" className="group rr-icon-btn">
          <LuRotateCcw className="h-[17px] w-[17px] transition-transform duration-300 ease-out group-hover:rotate-[200deg]" aria-hidden="true" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close chat" title="Close chat" className="rr-icon-btn">
          <LuX className="h-[17px] w-[17px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-6 py-16 text-center">
      <Image src="/favicon.ico" alt="RoofRay logo" width={110} height={110} priority className="h-12 w-12 object-contain sm:h-48 sm:w-48" />
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rr-msg-in group flex justify-end">
      <div className="relative max-w-[85%]">
        <div className="rr-user-bubble inline-block w-auto max-w-full whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-[14px] leading-5 text-slate-100">
          {message.content}<span className="rr-message-meta"><LuCheckCheck className="h-3 w-3" aria-hidden="true" /></span>
        </div>
        <button
          type="button"
          onClick={copyMessage}
          aria-label={copied ? "Copied" : "Copy message"}
          title={copied ? "Copied" : "Copy message"}
          className="absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:bg-white/[0.06] hover:text-slate-200 md:-bottom-9 md:left-auto md:right-0 md:top-auto md:translate-y-0 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
        >
          {copied ? (
            <LuCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <LuCopy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  onRetry,
  onLocationPermission,
  locationCoords,
  locationAccuracy,
  reportPdfUrl,
  onPreviewPdf,
  onDownloadPdf,
}: {
  message: ChatMessage;
  onRetry: (content: string) => void;
  onLocationPermission?: () => void;
  locationCoords?: { latitude: number; longitude: number } | null;
  locationAccuracy?: number | null;
  reportPdfUrl?: string | null;
  onPreviewPdf?: () => void;
  onDownloadPdf?: () => void;
}) {
  const choiceGroups: Array<{ pattern: RegExp; options: string[] }> = [
    {
      pattern: /what type of roof do you have/i,
      options: ["RCC/Concrete", "Metal Sheet", "Tile", "Other"],
    },
    {
      pattern: /what type of electricity connection do you have/i,
      options: ["Residential", "Commercial", "Other"],
    },
    {
      pattern: /do you own the property, or do you have permission/i,
      options: ["Own", "Permission", "No"],
    },
    {
      pattern: /what is your main goal for installing solar/i,
      options: [
        "Reduce electricity bill",
        "Maximum generation",
        "Cost/subsidy",
        "Just check feasibility",
      ],
    },
  ];

  const [customApplianceMode, setCustomApplianceMode] = useState(false);
  const [customApplianceValue, setCustomApplianceValue] = useState("");

  const applianceChoiceGroup = /how many (tvs|fans|acs|refrigerators|bulbs\/lights|water pumps) do you have/i.test(message.content)
    ? { options: ["0", "1", "2", "3", "4+", "None", "Custom"] }
    : null;
  const choiceGroup = choiceGroups.find(({ pattern }) =>
    pattern.test(message.content),
  );
  const needsLocationPermission = /i need your location permission/i.test(message.content);

  return (
    <div className="rr-assistant-row rr-msg-in flex items-start">
      <div className="rr-avatar-wrap shrink-0">
        <Image
          src="/favicon.ico"
          alt="RoofRay"
          width={100}
          height={100}
          className="h-[44px] w-[44px] object-contain"
        />
      </div>

      <div className="rr-assistant-card min-w-0 max-w-[calc(100%-3.25rem)] break-words px-4 pb-4 pt-3 text-[14px] leading-relaxed text-slate-200 sm:max-w-[85%]">
        {message.isError ? (
          <div>
            <p className="text-slate-400">{message.content}</p>
            {message.failedInput === "__retry_location__" ? (
              <button
                type="button"
                onClick={onLocationPermission}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-[12px] font-medium text-blue-300 hover:border-blue-400/40 hover:bg-blue-500/15"
              >
                <LuRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry solar analysis
              </button>
            ) : message.failedInput ? (
              <button
                type="button"
                onClick={() => onRetry(message.failedInput ?? "")}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:border-blue-400/30 hover:text-blue-300"
              >
                <LuRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {message.content.startsWith("☀️ ROOFRAY SOLAR FEASIBILITY REPORT") ? (
              <div className="mt-1">
                <p className="text-sm font-semibold text-slate-200"><LuSun className="mr-1 inline h-4 w-4" aria-hidden="true" />Solar planning result is ready</p>
                <p className="mt-1 text-xs text-slate-500">Open the PDF for the maximum panel capacity, appliance-load check, and month/day generation chart.</p>
              </div>
            ) : (
              renderAssistantContent(message.content)
            )}

            {message.content.startsWith("☀️ ROOFRAY SOLAR FEASIBILITY REPORT") ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPreviewPdf}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-[12px] font-semibold text-blue-300 hover:bg-blue-500/20"
                >
                  <LuEye className="h-4 w-4" aria-hidden="true" />
                  Preview PDF
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <LuDownload className="h-4 w-4" aria-hidden="true" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign("/solar-3d")}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[12px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                >
                  <LuSatellite className="h-4 w-4" aria-hidden="true" />
                  View My Roof in 3D
                </button>
              </div>
            ) : null}

            {message.content.startsWith("📍 Location detected:") && locationCoords ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
                <MapplsLocationMap
                  latitude={locationCoords.latitude}
                  longitude={locationCoords.longitude}
                  className="h-[240px] w-full"
                />
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  <LuMapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Live location • ±{Math.round(locationAccuracy ?? 0)} m accuracy
                </div>
              </div>
            ) : null}

            {needsLocationPermission ? (
              <button
                type="button"
                onClick={onLocationPermission}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-[13px] font-semibold text-blue-300 transition hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-200"
              >
                <LuMapPin className="h-4 w-4" aria-hidden="true" />
                Allow Location
              </button>
            ) : null}

            {(choiceGroup || applianceChoiceGroup) ? (
              <div className="rr-choice-row mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(choiceGroup || applianceChoiceGroup)!.options.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (applianceChoiceGroup && label === "Custom") {
                        setCustomApplianceMode(true);
                        setCustomApplianceValue("");
                        return;
                      }
                      onRetry(label);
                    }}
                    className="rr-choice-button"
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {applianceChoiceGroup && customApplianceMode ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = customApplianceValue.trim();
                  if (/^\d+$/.test(value)) {
                    onRetry(value);
                    setCustomApplianceMode(false);
                    setCustomApplianceValue("");
                  }
                }}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  autoFocus
                  value={customApplianceValue}
                  onChange={(event) => setCustomApplianceValue(event.target.value)}
                  placeholder="Enter quantity"
                  aria-label="Custom appliance quantity"
                  className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-400/10 sm:text-[13px]"
                />
                <button
                  type="submit"
                  disabled={!/^\d+$/.test(customApplianceValue.trim())}
                  className="rr-choice-button px-4 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="rr-msg-in flex items-center gap-3" role="status" aria-live="polite" aria-label="RoofRay is preparing a response">
      <Image src="/favicon.ico" alt="" width={100} height={100} className="h-[50px] w-[50px] object-contain" aria-hidden="true" />
      <span className="flex items-center gap-[5px] pt-0.5">
        <span className="rr-dot rr-dot-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
        <span className="rr-dot rr-dot-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
        <span className="rr-dot rr-dot-3 h-1.5 w-1.5 rounded-full bg-slate-500" />
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* AttachmentPreview                                                        */
/* ----------------------------------------------------------------------- */

function AttachmentPreview({ attachments, onRemove }: { attachments: AttachedFile[]; onRemove: (id: string) => void }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2 pt-2">
      {attachments.map((att) => {
        const isImage = ALLOWED_IMAGES.includes(att.file.type);
        const sizeKb = Math.round(att.file.size / 1024);
        return (
          <div key={att.id} className="group relative flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-[12px] transition-colors hover:border-white/[0.12]">
            {isImage && att.preview ? (
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.preview} alt={att.file.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center" aria-hidden="true">
                {att.file.type === "application/pdf" ? <LuFileText className="h-5 w-5" /> : att.file.type === "text/csv" ? <LuFileSpreadsheet className="h-5 w-5" /> : <LuFile className="h-5 w-5" />}
              </span>
            )}
            <div className="flex max-w-[120px] flex-col">
              <span className="truncate font-medium text-slate-200">{att.file.name}</span>
              <span className="text-slate-500">{sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`}</span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              aria-label={`Remove ${att.file.name}`}
              className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <LuX className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* AttachmentMenu                                                           */
/* ----------------------------------------------------------------------- */

function AttachmentMenu({ open, onPhoto, onFile, onClose }: { open: boolean; onPhoto: () => void; onFile: () => void; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Attachment options"
      className={`absolute bottom-full left-0 mb-2 w-[220px] max-w-[calc(100vw-2rem)] origin-bottom-left rounded-2xl border border-white/[0.08] bg-[#101A2B]/98 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-150 ${open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-95 opacity-0"
        }`}
    >
      <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Attach</p>

      <button
        type="button"
        role="menuitem"
        onClick={() => { onPhoto(); onClose(); }}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-slate-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-0"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300 transition-colors group-hover:bg-blue-500/15" aria-hidden="true">
          <LuImage className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Upload image</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">JPG, PNG, or WebP</span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => { onFile(); onClose(); }}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-slate-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-0"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 transition-colors group-hover:bg-white/[0.08]" aria-hidden="true">
          <LuFileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Upload file</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">PDF, TXT, or CSV</span>
        </span>
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* ScrollToLatest                                                           */
/* ----------------------------------------------------------------------- */

function ScrollToLatest({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest message"
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#111B2E]/95 px-3.5 py-2 text-[12px] font-medium text-slate-300 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-blue-400/30 hover:text-white ${visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
    >
      <LuArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* DragOverlay                                                              */
/* ----------------------------------------------------------------------- */

function DragOverlay({ visible }: { visible: boolean }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[inherit] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="absolute inset-0 rounded-[inherit] bg-[#0A1020]/90 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-3 px-4 text-center">
        <p className="text-[22px] font-medium text-white sm:text-[30px]">Drop files to attach</p>
        <p className="text-[15px] text-slate-400 sm:text-[20px]">Images, PDF, TXT, or CSV</p>
      </div>
    </div>
  );
}

function ChatComposer({
  input, onInputChange, onSend, onStop, loading, placeholder, attachments, onRemoveAttachment, onAddFiles, fileError, onDismissError,
}: {
  input: string; onInputChange: (v: string) => void; onSend: () => void; onStop: () => void; loading: boolean; placeholder: string;
  attachments: AttachedFile[]; onRemoveAttachment: (id: string) => void; onAddFiles: (files: FileList | File[]) => void;
  fileError: string | null; onDismissError: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const canSend = !loading && (input.trim().length > 0 || attachments.length > 0);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [input]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (canSend) onSend(); }
  }

  return (
    <div className="shrink-0 border-t border-white/[0.05] bg-[#0A1020] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      <input ref={photoInputRef} type="file" accept={ALLOWED_IMAGES.join(",")} multiple className="sr-only" aria-label="Upload photo"
        onChange={(e) => { if (e.target.files) onAddFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileInputRef} type="file" accept={ALLOWED_DOCS.join(",")} multiple className="sr-only" aria-label="Upload file"
        onChange={(e) => { if (e.target.files) onAddFiles(e.target.files); e.target.value = ""; }} />

      {fileError && (
        <div className="mx-0 mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[12px] text-red-400">
          <span>{fileError}</span>
          <button type="button" onClick={onDismissError} aria-label="Dismiss error" className="shrink-0 text-red-400/60 hover:text-red-400"><LuX className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (canSend) onSend(); }} className="mx-auto max-w-[900px]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F1929] !outline-none focus-within:!outline-none focus-within:!ring-0 focus-within:!border-white/[0.08]">
          <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
          <div className="flex items-end gap-1 px-2 pb-2 pt-2">
            {/* + button */}
            <div className="relative shrink-0 self-end mb-0.5">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Attach file or photo"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`group flex h-9 w-9 items-center justify-center rounded-xl border text-slate-400 transition-colors duration-200 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:scale-100 ${menuOpen ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-white/[0.07] bg-white/[0.03] hover:border-blue-400/20 hover:bg-blue-500/[0.06] hover:text-slate-200"
                  }`}
              >
                <LuPlus className={`h-4 w-4 transition-transform duration-200 ease-out ${menuOpen ? "rotate-45" : "group-hover:scale-105"}`} aria-hidden="true" />
              </button>
              <AttachmentMenu open={menuOpen} onPhoto={() => photoInputRef.current?.click()} onFile={() => fileInputRef.current?.click()} onClose={() => setMenuOpen(false)} />
            </div>

            <label htmlFor="rr-composer-input" className="sr-only">Message RoofRay</label>
            <textarea
              id="rr-composer-input"
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
              className="min-h-[36px] min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base leading-6 text-white !outline-none focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus:!border-0 focus-visible:!border-0 placeholder:text-slate-500 disabled:opacity-50 sm:text-[14px]"
              style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
            />

            <button
              type={loading ? "button" : "submit"}
              onClick={loading ? onStop : undefined}
              disabled={!loading && !canSend}
              aria-label={loading ? "Stop generating" : "Send message"}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white outline-none transition-colors duration-200 hover:bg-blue-500 focus:outline-none focus:ring-0 active:scale-100 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-slate-600"
            >
              {loading ? (
                <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
                  <span className="absolute inset-0 animate-spin rounded-full border border-white/30 border-t-white" />
                  <LuSquare className="relative h-2.5 w-2.5" />
                </span>
              ) : (
                <LuArrowUp className="h-[16px] w-[16px]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Main component                                                           */
/* ----------------------------------------------------------------------- */

export default function RoofRayChat() {
  const [locationError, setLocationError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreenPage = pathname === "/chat";
  const [open, setOpen] = useState(isFullScreenPage);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const generationControllerRef = useRef<AbortController | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "detecting" | "ready" | "warning" | "denied" | "unavailable">("idle");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const locationMessageShownRef = useRef(false);
  const [solarContext, setSolarContext] = useState<SolarAnalysis | null>(null);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [reportPdfPreviewOpen, setReportPdfPreviewOpen] = useState(false);
  const [reportPdfGenerating, setReportPdfGenerating] = useState(false);
  const [reportPdfError, setReportPdfError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [roofArea, setRoofArea] = useState<number | null>(null);
  const [roofType, setRoofType] = useState<string | null>(null);
  const [monthlyBill, setMonthlyBill] = useState<number | null>(null);
  const [applianceDetails, setApplianceDetails] = useState<string | null>(null);
  const [applianceStep, setApplianceStep] = useState(0);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [roofPhotoDataUrl, setRoofPhotoDataUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [pendingDeleteChat, setPendingDeleteChat] = useState<ChatRecord | null>(null);
  const [pendingRenameChat, setPendingRenameChat] = useState<ChatRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    return () => {
      if (reportPdfUrl) URL.revokeObjectURL(reportPdfUrl);
    };
  }, [reportPdfUrl]);

  useEffect(() => {
    const handleReportUpdate = () => {
      setReportPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setReportPdfError(null);
    };
    window.addEventListener("roofray_report_ready", handleReportUpdate);
    return () => window.removeEventListener("roofray_report_ready", handleReportUpdate);
  }, []);

  // Sidebar starts closed on phones; on desktop it restores the saved state.
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) { setSidebarOpen(false); return; }
    const saved = localStorage.getItem("roofray_sidebar_open");
    setSidebarOpen(saved === null ? true : saved === "true");
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) return;
    localStorage.setItem("roofray_sidebar_open", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  void locationLoading;
  void locationStatus;
  void locationAccuracy;
  void locationLabel;

  function stopGeneration() {
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setLoading(false);
    setLocationLoading(false);
  }

  function finishGeneration(controller: AbortController) {
    if (generationControllerRef.current !== controller) return;
    generationControllerRef.current = null;
    setLoading(false);
  }

  async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const response = await fetch('/api/reverse-geocode?lat=' + encodeURIComponent(latitude) + '&lon=' + encodeURIComponent(longitude), { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      return response.ok && typeof data.displayName === 'string' ? data.displayName : null;
    } catch {
      return null;
    }
  }

  function hydrateStoredLocation() {
    try {
      const stored = sessionStorage.getItem("roofray_location");
      if (!stored) return;
      const value = JSON.parse(stored) as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
      const latitude = readNumber(value.latitude);
      const longitude = readNumber(value.longitude);
      const accuracy = readNumber(value.accuracy);
      if (latitude !== null && longitude !== null) {
        setLocationCoords({ latitude, longitude });
        void reverseGeocode(latitude, longitude).then((label) => { if (label) setLocationLabel(label); });
      }
      if (accuracy !== null) setLocationAccuracy(accuracy);
      if (latitude !== null && longitude !== null) setLocationStatus(accuracy !== null && accuracy > 100 ? "warning" : "ready");
    } catch { }
  }

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const newAtts: AttachedFile[] = [];
    let error: string | null = null;
    for (const file of list) {
      if (attachments.length + newAtts.length >= MAX_ATTACHMENTS) { error = `Maximum ${MAX_ATTACHMENTS} files allowed.`; break; }
      if (!ALLOWED_TYPES.includes(file.type)) { error = "File type not supported."; continue; }
      if (file.size > MAX_FILE_BYTES) { error = "File is larger than 10 MB."; continue; }
      const id = safeUUID();
      const preview = ALLOWED_IMAGES.includes(file.type) ? URL.createObjectURL(file) : undefined;
      newAtts.push({ id, file, preview });
    }
    if (error) setFileError(error);
    if (newAtts.length > 0) {
      setAttachments((prev) => [...prev, ...newAtts]);
      const firstImage = newAtts.find((att) => ALLOWED_IMAGES.includes(att.file.type));
      if (firstImage) {
        void prepareRoofPhoto(firstImage.file).then((dataUrl) => {
          if (dataUrl) setRoofPhotoDataUrl(dataUrl);
        });
      }
    }
  }, [attachments.length]);

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  function handleDragEnter(e: DragEvent<HTMLElement>) { e.preventDefault(); dragCounterRef.current += 1; if (dragCounterRef.current === 1) setDragOver(true); }
  function handleDragLeave(e: DragEvent<HTMLElement>) { e.preventDefault(); dragCounterRef.current -= 1; if (dragCounterRef.current === 0) setDragOver(false); }
  function handleDragOver(e: DragEvent<HTMLElement>) { e.preventDefault(); }
  function handleDrop(e: DragEvent<HTMLElement>) { e.preventDefault(); dragCounterRef.current = 0; setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }

  useEffect(() => {
    setOpen(isFullScreenPage);
    setSolarContext(getStoredAnalysis());
    hydrateStoredLocation();
    const handleOpen = () => { setOpen(true); };
    window.addEventListener("roofray:open-chat", handleOpen);
    if (sessionStorage.getItem("roofray_pending_chat") === "true") {
      sessionStorage.removeItem("roofray_pending_chat");
      setOpen(true);
    }
    return () => window.removeEventListener("roofray:open-chat", handleOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreenPage]);


  useEffect(() => {
    try {
      const stored = localStorage.getItem("roofray_chats");
      if (stored) {
        const parsed = JSON.parse(stored) as ChatRecord[];
        if (Array.isArray(parsed)) {
          const savedActiveChatId = localStorage.getItem("roofray_active_chat");
          const activeChat = parsed.find((chat) => chat.id === savedActiveChatId)
            ?? [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setChats(parsed);
          if (activeChat) {
            setActiveChatId(activeChat.id);
            setMessages(activeChat.messages || []);
            setHasStarted((activeChat.messages || []).length > 0);
          }
        }
      }
    } catch { /* ignore malformed local history */ }
  }, []);

  useEffect(() => {
    if (activeChatId) localStorage.setItem("roofray_active_chat", activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    setChats((current) => {
      const now = Date.now();
      const existing = current.find((chat) => chat.id === activeChatId);
      const nextChat: ChatRecord = {
        id: activeChatId,
        title: chatTitle(messages),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages,
      };
      const next = existing
        ? current.map((chat) => chat.id === activeChatId ? nextChat : chat)
        : [nextChat, ...current];
      localStorage.setItem("roofray_chats", JSON.stringify(next));
      return next;
    });
  }, [activeChatId, messages]);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, autoScroll]);

  function handleMessagesScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setAutoScroll(distanceFromBottom < AUTO_SCROLL_THRESHOLD);
  }

  async function getBestLocationPosition(signal?: AbortSignal): Promise<GeolocationPosition> {
    if (signal?.aborted) throw new DOMException("Location request stopped.", "AbortError");
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    return new Promise((resolve, reject) => {
      let best: GeolocationPosition | null = null;
      let settled = false;
      let timer = 0;

      const finish = (position?: GeolocationPosition, error?: GeolocationPositionError | Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        signal?.removeEventListener("abort", abort);
        if (position) resolve(position);
        else reject(error ?? new Error("Unable to determine your location."));
      };

      let watchId: number | null = null;
      const abort = () => finish(undefined, new DOMException("Location request stopped.", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!best || position.coords.accuracy < best.coords.accuracy) {
            best = position;
            setLocationAccuracy(position.coords.accuracy);
          }

          // Stop early once browser GPS reports a genuinely useful fix.
          if (position.coords.accuracy <= 25) finish(position);
        },
        (error) => {
          if (!best) finish(undefined, error);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0,
        },
      );

      // Desktop Chrome may only expose Wi-Fi/IP positioning. In that case use
      // the best fix received instead of waiting forever.
      timer = window.setTimeout(() => {
        if (best) finish(best);
        else {
          navigator.geolocation.getCurrentPosition(
            (position) => finish(position),
            (error) => finish(undefined, error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          );
        }
      }, 12000);
    });
  }

  async function loadLocationAnalysis(roofAreaSqFt?: number | null, signal?: AbortSignal): Promise<SolarAnalysis | null> {
    if (signal?.aborted) return null;
    setLocationError(null);
    if (!window.isSecureContext) {
      setLocationStatus("unavailable");
      setLocationLoading(false);
      setLocationError("Location access requires HTTPS. Open RoofRay using its secure HTTPS address, then try again.");
      return null;
    }
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationLoading(false);
      setLocationError("This browser does not provide location access. Check your browser and device location settings.");
      return null;
    }
    // Check the browser permission state first. If it is still "prompt",
    // getCurrentPosition below will open the native location permission dialog.
    // If it is "denied", browsers will not show the dialog again until the
    // user re-enables Location for this site in browser settings.
    // Do not gate the request behind the Permissions API. Calling
    // getCurrentPosition() directly is the browser-native way to trigger the
    // permission prompt when the current state is "ask/prompt".
    setLocationLoading(true);
    setLocationStatus("detecting");

    return new Promise<SolarAnalysis | null>((resolve) => {
      void getBestLocationPosition(signal)
        .then(async (position) => {
          if (signal?.aborted) {
            setLocationLoading(false);
            resolve(null);
            return;
          }
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          setLocationCoords({ latitude, longitude });
          setLocationAccuracy(accuracy);
          setLocationStatus(accuracy > 100 ? "warning" : "ready");
          sessionStorage.setItem(
            "roofray_location",
            JSON.stringify({ latitude, longitude, accuracy, timestamp: Date.now() }),
          );
          localStorage.setItem(
            "roofray_location",
            JSON.stringify({ latitude, longitude, accuracy, timestamp: Date.now() }),
          );
          const resolvedLocation = await reverseGeocode(latitude, longitude);
          if (signal?.aborted) {
            setLocationLoading(false);
            resolve(null);
            return;
          }
          if (resolvedLocation) setLocationLabel(resolvedLocation);
          if (!locationMessageShownRef.current) {
            locationMessageShownRef.current = true;
            setMessages((current) => [...current, { id: safeUUID(), role: "assistant", content: resolvedLocation ? "📍 Location detected: " + resolvedLocation : "📍 Location detected: " + latitude.toFixed(5) + ", " + longitude.toFixed(5) }]);
            setHasStarted(true);
          }
          let lastError = "Live solar analysis could not be completed.";
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              const response = await fetch("/api/solar-analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal,
                body: JSON.stringify({
                  latitude,
                  longitude,
                  peakPowerKw: 1,
                  ...(roofAreaSqFt !== null && roofAreaSqFt !== undefined
                    ? { roofAreaM2: roofAreaSqFt * 0.092903 }
                    : {}),
                  obstacleRadiusMeters: 500,
                }),
              });
              const data = await response.json().catch(() => ({}));
              if (signal?.aborted) {
                setLocationLoading(false);
                resolve(null);
                return;
              }
              if (response.ok && data.ok && data.analysis) {
                sessionStorage.setItem("roofray_solar_analysis", JSON.stringify(data.analysis));
                setSolarContext(data.analysis);
                setLocationLoading(false);
                resolve(data.analysis as SolarAnalysis);
                return;
              }
              lastError =
                typeof data.error === "string"
                  ? data.error
                  : `Solar analysis failed (HTTP ${response.status}).`;
              console.warn("[RoofRay] Solar analysis attempt failed:", {
                attempt,
                status: response.status,
                error: lastError,
              });
            } catch (error) {
              if (signal?.aborted) {
                setLocationLoading(false);
                resolve(null);
                return;
              }
              lastError = error instanceof Error ? error.message : lastError;
              console.warn("[RoofRay] Solar analysis request failed:", error);
            }
            if (attempt === 1) {
              await new Promise((retryResolve) => window.setTimeout(retryResolve, 1000));
              if (signal?.aborted) {
                setLocationLoading(false);
                resolve(null);
                return;
              }
            }
          }

          setLocationLoading(false);
          setLocationStatus("unavailable");
          setMessages((current) => [
            ...current,
            {
              id: safeUUID(),
              role: "assistant",
              content: `⚠️ Live solar analysis failed: ${lastError}`,
              isError: true,
              failedInput: "__retry_location__",
            },
          ]);
          resolve(null);
        })
        .catch((error) => {
          setLocationLoading(false);
          if (signal?.aborted) {
            resolve(null);
            return;
          }
          console.warn("[RoofRay] Geolocation failed:", {
            code: error?.code,
            message: error?.message,
          });
          if (error?.code === 1) {
            setLocationStatus("denied");
            setLocationError("Location permission was denied. Allow location for RoofRay in your browser settings, then try again.");
          } else if (error?.code === 3) {
            setLocationStatus("unavailable");
            setLocationError("Getting your location timed out. Check that device location is on and try again.");
          } else {
            setLocationStatus("unavailable");
            setLocationError("Your location could not be detected. Turn on device location and try again.");
          }
          resolve(null);
        });
    });
  }

  async function refreshAnalysisWithRoofArea(areaSqFt: number, signal?: AbortSignal): Promise<SolarAnalysis | null> {
    const analysisLocation = solarContext?.location as Record<string, unknown> | undefined;
    const latitude = readNumber(analysisLocation?.latitude) ?? locationCoords?.latitude ?? null;
    const longitude = readNumber(analysisLocation?.longitude) ?? locationCoords?.longitude ?? null;
    if (latitude === null || longitude === null) return null;

    try {
      const response = await fetch("/api/solar-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
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
        const serializedAnalysis = JSON.stringify(data.analysis);
        sessionStorage.setItem("roofray_solar_analysis", serializedAnalysis);
        localStorage.setItem("roofray_solar_analysis", serializedAnalysis);
        setSolarContext(data.analysis);
        return data.analysis as SolarAnalysis;
      }
    } catch { }
    return null;
  }

  function extractReportMetrics(report: string) {
    const matchNumber = (pattern: RegExp) => {
      const match = report.match(pattern);
      return match ? Number(match[1].replace(/,/g, "")) : null;
    };

    return {
      systemSizeKw: matchNumber(/Recommended capacity:\s*~?([\d,.]+)\s*kW/i),
      panelCount: matchNumber(/Panels:\s*([\d,.]+)\s*[×x]/i),
      monthlyGenerationKwh: matchNumber(/Expected generation:\s*~?([\d,.]+)\s*kWh\/month/i),
      annualGenerationKwh: matchNumber(/\|\s*~?([\d,.]+)\s*kWh\/year/i),
      shadingPercent: matchNumber(/Estimated shading:\s*~?([\d,.]+)%/i),
      billInr: matchNumber(/Current electricity bill:\s*₹?([\d,.]+)\/month/i),
      roofAreaSqFt: matchNumber(/Roof area:\s*~?([\d,.]+)\s*sq ft/i),
      householdLoadKw: matchNumber(/Estimated connected load:\s*~?([\d,.]+)\s*kW/i),
    };
  }

  async function persistReportAndDownloadPdf(
    report: string,
    analysis: SolarAnalysis,
    inputs: Record<string, unknown>,
  ) {
    // Never send a stale 0,0 location to the PDF renderer. Prefer the fresh
    // browser location when the analysis payload has an invalid/missing one.
    const analysisLocation = analysis.location as Record<string, unknown> | undefined;
    const analysisLat = readNumber(analysisLocation?.latitude);
    const analysisLon = readNumber(analysisLocation?.longitude);
    const fallbackLat = locationCoords?.latitude ?? null;
    const fallbackLon = locationCoords?.longitude ?? null;
    const hasAnalysisLocation =
      analysisLat !== null &&
      analysisLon !== null &&
      !(analysisLat === 0 && analysisLon === 0);
    const hasFallbackLocation =
      fallbackLat !== null &&
      fallbackLon !== null &&
      !(fallbackLat === 0 && fallbackLon === 0);

    if (!hasAnalysisLocation && !hasFallbackLocation) {
      setReportPdfError("Real location is not available. Please run Location Analysis again before generating the PDF.");
      return;
    }

    const finalAnalysis = hasAnalysisLocation
      ? analysis
      : ({
        ...analysis,
        location: {
          ...(analysisLocation ?? {}),
          latitude: fallbackLat,
          longitude: fallbackLon,
        },
        planningEstimate: {
          ...((analysis.planningEstimate ?? {}) as Record<string, unknown>),
          location: {
            latitude: fallbackLat,
            longitude: fallbackLon,
          },
        },
      } as SolarAnalysis);

    const payload = {
      report,
      solarContext: finalAnalysis,
      userInputs: {
        ...inputs,
        roofPhotoDataUrl: (inputs.roofPhotoDataUrl as string | undefined) || roofPhotoDataUrl || undefined,
      },
      roofPhotoDataUrl: (inputs.roofPhotoDataUrl as string | undefined) || roofPhotoDataUrl || undefined,
      reportMetrics: extractReportMetrics(report),
      generatedAt: Date.now(),
    };
    try {
      const serialized = JSON.stringify(payload);
      sessionStorage.setItem("roofray_report_data", serialized);
      // Keep a persistent copy because the chat history itself is stored in
      // localStorage and can outlive the current browser session.
      localStorage.setItem("roofray_report_data", serialized);
      window.dispatchEvent(new Event("roofray_report_ready"));
    } catch { }
    setReportPdfGenerating(true);
    setReportPdfError(null);
    try {
      const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          typeof errorData.error === "string"
            ? errorData.error
            : `PDF generation failed (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const blob = await response.blob();
      if (blob.type && blob.type !== "application/pdf") {
        throw new Error("The PDF server returned an invalid file.");
      }
      const url = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      setReportPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate PDF.";
      console.warn("[RoofRay] PDF generation failed:", error);
      setReportPdfError(message);
      return;
    } finally {
      setReportPdfGenerating(false);
    }
  }

  async function ensureReportPdf(reportOverride?: string) {
    if (reportPdfUrl) return reportPdfUrl;
    try {
      let raw =
        sessionStorage.getItem("roofray_report_data") ||
        localStorage.getItem("roofray_report_data");

      // Prefer the newest in-memory/stored solar analysis over a stale
      // report payload. This prevents old 0,0 coordinates from being reused
      // after a real location analysis or manual house selection.
      try {
        const latestAnalysis = solarContext || getStoredAnalysis();
        const latestLocation = latestAnalysis?.location as Record<string, unknown> | undefined;
        const latestLatitude = readNumber(latestLocation?.latitude);
        const latestLongitude = readNumber(latestLocation?.longitude);
        const hasRealLocation =
          latestLatitude !== null &&
          latestLongitude !== null &&
          latestLatitude >= -90 &&
          latestLatitude <= 90 &&
          latestLongitude >= -180 &&
          latestLongitude <= 180 &&
          !(latestLatitude === 0 && latestLongitude === 0);

        if (hasRealLocation && raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          parsed.solarContext = latestAnalysis;
          parsed.generatedAt = Date.now();
          raw = JSON.stringify(parsed);
          sessionStorage.setItem("roofray_report_data", raw);
          localStorage.setItem("roofray_report_data", raw);
        }
      } catch { }

      // Older chat records may contain the report message but not the PDF
      // payload. Rebuild the payload from the saved chat + saved analysis.
      if (!raw && reportOverride) {
        let savedAnalysis = solarContext || getStoredAnalysis();
        let savedLocation: { latitude: number; longitude: number } | null = null;
        try {
          const locationRaw =
            sessionStorage.getItem("roofray_location") ||
            localStorage.getItem("roofray_location");
          if (locationRaw) {
            const parsed = JSON.parse(locationRaw) as Record<string, unknown>;
            const latitude = readNumber(parsed.latitude);
            const longitude = readNumber(parsed.longitude);
            if (latitude !== null && longitude !== null) {
              savedLocation = { latitude, longitude };
            }
          }
        } catch { }

        if (!savedAnalysis && savedLocation) {
          savedAnalysis = {
            location: savedLocation,
          };
        }

        const fallbackPayload = {
          report: reportOverride,
          solarContext: savedAnalysis || {},
          userInputs: {
            name,
            roofAreaSqFt: roofArea,
            roofType,
            monthlyBillInr: monthlyBill,
            applianceDetails,
            connectionType,
            ownership,
            goal,
            roofPhotoDataUrl: roofPhotoDataUrl || undefined,
          },
          roofPhotoDataUrl: roofPhotoDataUrl || undefined,
          reportMetrics: extractReportMetrics(reportOverride),
          generatedAt: Date.now(),
        };
        raw = JSON.stringify(fallbackPayload);
        try {
          sessionStorage.setItem("roofray_report_data", raw);
          localStorage.setItem("roofray_report_data", raw);
        } catch { }
      }

      if (!raw) {
        setReportPdfError("No report data found. Please generate the solar report again.");
        return null;
      }
      setReportPdfGenerating(true);
      setReportPdfError(null);
      const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          typeof errorData.error === "string"
            ? errorData.error
            : `PDF generation failed (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const blob = await response.blob();
      if (blob.type && blob.type !== "application/pdf") {
        throw new Error("The PDF server returned an invalid file.");
      }
      const url = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      setReportPdfUrl(url);
      return url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate PDF.";
      console.warn("[RoofRay] PDF generation failed:", error);
      setReportPdfError(message);
      return null;
    } finally {
      setReportPdfGenerating(false);
    }
  }

  async function previewReportPdf(reportOverride?: string) {
    const url = await ensureReportPdf(reportOverride);
    if (!url) return;
    setReportPdfPreviewOpen(true);
  }

  async function openReportPdfInNewTab(reportOverride?: string) {
    const url = await ensureReportPdf(reportOverride);
    if (!url) return;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blockers may prevent a new tab; the in-app preview remains available.
      setReportPdfPreviewOpen(true);
    }
  }

  async function downloadReportPdf(reportOverride?: string) {
    const url = await ensureReportPdf(reportOverride);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "RoofRay-Solar-Report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function generateFinalReport(analysis: SolarAnalysis, roofPhotoOverride?: string | null, goalOverride?: string | null, signal?: AbortSignal) {
    const reportGoal = goalOverride ?? goal;
    if (reportGoal === null) return;
    const controller = signal ? null : new AbortController();
    const requestSignal = signal ?? controller!.signal;
    if (controller) generationControllerRef.current = controller;
    setLoading(true);

    try {
      const validToken = await getValidToken();
      if (requestSignal.aborted) return;
      if (!validToken) {
        throw new Error("Your login session is not available. Please log in again, then try your message.");
      }

      const requestBody = {
        messages: messages.map(({ role, content: mc }) => ({
          role,
          content: mc,
        })),
        solarContext: {
          ...(analysis || {}),
          userInputs: {
            name,
            roofAreaSqFt: roofArea,
            roofType,
            monthlyBillInr: monthlyBill,
            applianceDetails,
            connectionType,
            ownership,
            goal: reportGoal,
            roofPhotoDataUrl: roofPhotoOverride || roofPhotoDataUrl || undefined,
          },
        },
      };

      const sendChatRequest = (token: string) =>
        fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(requestBody),
          signal: requestSignal,
        });

      let response = await sendChatRequest(validToken);
      if (response.status === 401) {
        const refreshedToken = await getValidToken();
        if (requestSignal.aborted) return;
        if (refreshedToken && refreshedToken !== validToken) {
          response = await sendChatRequest(refreshedToken);
        }
      }

      const data = await response.json().catch(() => ({}));
      if (requestSignal.aborted) return;
      if (!response.ok || !data.ok || typeof data.message !== "string" || !data.message.trim()) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to generate the solar report.");
      }

      setMessages((current) => [
        ...current,
        { id: safeUUID(), role: "assistant", content: data.message },
      ]);
      const activeController = generationControllerRef.current;
      if (activeController?.signal === requestSignal) finishGeneration(activeController);
      await persistReportAndDownloadPdf(data.message, analysis, {
        name,
        roofAreaSqFt: roofArea,
        roofType,
        monthlyBillInr: monthlyBill,
        applianceDetails,
        connectionType,
        ownership,
        goal,
        roofPhotoDataUrl: roofPhotoOverride || roofPhotoDataUrl || undefined,
      });
    } catch (error) {
      if (requestSignal.aborted) return;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[RoofRay] Final report error:", error);
      setMessages((current) => [
        ...current,
        { id: safeUUID(), role: "assistant", content: "RoofRay couldn't generate the report. " + errorMessage, isError: true },
      ]);
    } finally {
      if (controller) finishGeneration(controller);
    }
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (loading) return;

    const imageAttachment = attachments.find((att) => ALLOWED_IMAGES.includes(att.file.type));
    const userMessage: ChatMessage = {
      id: safeUUID(),
      role: "user",
      content: content || (imageAttachment ? "📸 Roof photo uploaded" : `[${attachments.length} file(s) attached]`),
    };
    const nextMessages = [...messages, userMessage];
    const controller = new AbortController();
    const signal = controller.signal;
    generationControllerRef.current = controller;
    setHasStarted(true);
    setAutoScroll(true);
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setLoading(true);

    const number = readNumber(content.replace(/[^0-9.]/g, ""));
    let nextName = name;
    let nextRoofArea = roofArea;
    let nextRoofType = roofType;
    let nextMonthlyBill = monthlyBill;
    let nextApplianceDetails = applianceDetails;
    let nextApplianceStep = applianceStep;
    let nextConnectionType = connectionType;
    let nextOwnership = ownership;
    let nextGoal = goal;
    let currentSolarContext = solarContext;
    let nextRoofPhotoDataUrl = roofPhotoDataUrl;

    if (imageAttachment && !nextRoofPhotoDataUrl) {
      const preparedPhoto = await prepareRoofPhoto(imageAttachment.file);
      if (signal.aborted) {
        finishGeneration(controller);
        return;
      }
      if (preparedPhoto) {
        nextRoofPhotoDataUrl = preparedPhoto;
        setRoofPhotoDataUrl(preparedPhoto);
      }
    }

    const normalized = content.toLowerCase();

    const isGreeting = /^(hi+|hello+|hey+|good morning|good afternoon|good evening)[!.\s]*$/i.test(content.trim());

    if (name === null) {
      if (!isGreeting) {
        nextName = content.replace(/\s+/g, " ").trim().slice(0, 80);
        if (nextName) setName(nextName);
      }
    } else if (roofArea === null && number !== null && number > 0) {
      nextRoofArea = number;
      setRoofArea(number);
      const refreshedAnalysis = await refreshAnalysisWithRoofArea(number, signal);
      if (signal.aborted) {
        finishGeneration(controller);
        return;
      }
      if (refreshedAnalysis) currentSolarContext = refreshedAnalysis;
    } else if (roofArea !== null && roofType === null) {
      if (normalized.includes("rcc") || normalized.includes("concrete")) nextRoofType = "RCC/Concrete";
      else if (normalized.includes("metal") || normalized.includes("sheet")) nextRoofType = "Metal Sheet";
      else if (normalized.includes("tile")) nextRoofType = "Tile";
      else if (normalized.includes("other")) nextRoofType = "Other";
      if (nextRoofType) setRoofType(nextRoofType);
    } else if (roofArea !== null && roofType !== null && monthlyBill === null && number !== null && number > 0) {
      nextMonthlyBill = number;
      setMonthlyBill(number);
    } else if (roofArea !== null && roofType !== null && monthlyBill !== null && applianceStep < 6) {
      const applianceNames = ["TV", "Fan", "AC", "Refrigerator", "Bulb", "Water Pump"];
      const selectedAppliance = applianceNames[applianceStep];
      const selectedQuantity = content.trim();
      if (/^(0|1|2|3|4\+|none|\d+)$/i.test(selectedQuantity)) {
        const entry = `${selectedAppliance}: ${selectedQuantity.toLowerCase() === "none" ? "0" : selectedQuantity}`;
        nextApplianceDetails = [applianceDetails, entry].filter(Boolean).join(", ");
        nextApplianceStep = applianceStep + 1;
        setApplianceDetails(nextApplianceDetails);
        setApplianceStep(nextApplianceStep);
      }
    } else if (roofArea !== null && roofType !== null && monthlyBill !== null && applianceStep >= 6 && connectionType === null) {
      if (normalized.includes("residential")) nextConnectionType = "Residential";
      else if (normalized.includes("commercial")) nextConnectionType = "Commercial";
      else if (normalized.includes("other")) nextConnectionType = "Other";
      if (nextConnectionType) setConnectionType(nextConnectionType);
    } else if (roofArea !== null && roofType !== null && monthlyBill !== null && connectionType !== null && ownership === null) {
      if (normalized.includes("own")) nextOwnership = "Own";
      else if (normalized.includes("permission")) nextOwnership = "Permission";
      else if (normalized.includes("no")) nextOwnership = "No";
      if (nextOwnership) setOwnership(nextOwnership);
    } else if (roofArea !== null && roofType !== null && monthlyBill !== null && connectionType !== null && ownership !== null && goal === null) {
      if (normalized.includes("reduce")) nextGoal = "Reduce electricity bill";
      else if (normalized.includes("maximum")) nextGoal = "Maximum generation";
      else if (normalized.includes("cost") || normalized.includes("subsidy")) nextGoal = "Cost/subsidy";
      else if (normalized.includes("feasibility")) nextGoal = "Just check feasibility";
      if (nextGoal) {
        setGoal(nextGoal);
        // Location analysis and report generation start immediately after the goal is selected.
      }
    }

    // The final goal answer now immediately starts live location analysis and PDF generation.
    // A roof photo is no longer required: the report uses the detected building footprint
    // and mapped 3D building data for the site model.
    if (nextGoal !== null && goal === null) {
      const liveAnalysis = await loadLocationAnalysis(nextRoofArea, signal);
      if (signal.aborted) {
        finishGeneration(controller);
        return;
      }
      if (liveAnalysis) {
        currentSolarContext = liveAnalysis;
        await generateFinalReport(liveAnalysis, nextRoofPhotoDataUrl, nextGoal, signal);
      }
      finishGeneration(controller);
      return;
    }

    const validToken = await getValidToken();
    if (signal.aborted) {
      finishGeneration(controller);
      return;
    }
    if (!validToken) {
      setMessages((current) => [...current, { id: safeUUID(), role: "assistant", content: "Your login session is not available. Please log in again, then try your message." }]);
      finishGeneration(controller);
      return;
    }

    try {
      const requestBody = {
        messages: nextMessages.map(({ role, content: mc }) => ({
          role,
          content: mc,
        })),
        solarContext: {
          ...(currentSolarContext || {}),
          userInputs: {
            name: nextName,
            roofAreaSqFt: nextRoofArea,
            roofType: nextRoofType,
            monthlyBillInr: nextMonthlyBill,
            applianceDetails: nextApplianceDetails,
            connectionType: nextConnectionType,
            ownership: nextOwnership,
            goal: nextGoal,
          },
        },
      };

      const sendChatRequest = (token: string) =>
        fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

      let response = await sendChatRequest(validToken);

      // Recover once from a stale access token without changing the chat UI.
      if (response.status === 401) {
        const refreshedToken = await getValidToken();
        if (signal.aborted) return;
        if (refreshedToken && refreshedToken !== validToken) {
          response = await sendChatRequest(refreshedToken);
        }
      }

      const data = await response.json().catch(() => ({}));
      if (signal.aborted) return;
      if (!response.ok || !data.ok) {
        console.error("[RoofRay] Chat request failed:", response.status, data);
        throw new Error(typeof data.error === "string" ? data.error : "Unable to get a response.");
      }
      if (typeof data.message !== "string" || !data.message.trim()) {
        throw new Error("RoofRay returned an empty response.");
      }

      // Keep the intake order fixed on the client as well, so an older
      // deployed API response cannot bring back the previous question flow.
      const applianceQuestions = [
        "How many TVs do you have?",
        "How many fans do you have?",
        "How many ACs do you have?",
        "How many refrigerators do you have?",
        "How many bulbs/lights do you have?",
        "How many water pumps do you have?",
      ];
      const fixedNextQuestion =
        nextName === null
          ? "What is your name?"
          : nextRoofArea === null
            ? "What is the area of your roof in square feet?"
            : nextRoofType === null
              ? "What type of roof do you have? (RCC/Concrete, Metal Sheet, Tile, or Other)"
              : nextMonthlyBill === null
                ? "What is your average monthly electricity bill in ₹?"
                : nextApplianceStep < applianceQuestions.length
                  ? applianceQuestions[nextApplianceStep]
                  : nextConnectionType === null
                    ? "What type of electricity connection do you have? (Residential, Commercial, or Other)"
                    : nextOwnership === null
                      ? "Do you own the property, or do you have permission to install solar there? (Own, Permission, or No)"
                      : nextGoal === null
                        ? "What is your main goal for installing solar? (Reduce electricity bill, Maximum generation, Cost/subsidy, or Just check feasibility)"
                        : data.message;

      setMessages((current) => [
        ...current,
        { id: safeUUID(), role: "assistant", content: fixedNextQuestion },
      ]);

    } catch (error) {
      if (signal.aborted) return;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[RoofRay] Chat UI error:", error);
      setMessages((current) => [
        ...current,
        { id: safeUUID(), role: "assistant", content: "RoofRay couldn't complete that request. " + errorMessage, isError: true, failedInput: content },
      ]);
    } finally { finishGeneration(controller); }
  }

  function openChat() {
    if (!getToken()) {
      sessionStorage.setItem("roofray_pending_chat", "true");
      window.location.href = "/login?redirect=/";
      return;
    }
    setOpen(true);
  }
  void openChat;

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }

  function startNewChat() {
    setMessages([]);
    setName(null);
    setRoofArea(null);
    setRoofType(null);
    setMonthlyBill(null);
    setApplianceDetails(null);
    setApplianceStep(0);
    setConnectionType(null);
    setOwnership(null);
    setGoal(null);
    setLocationLabel(null);
    locationMessageShownRef.current = false;
    setHasStarted(false);
    setAutoScroll(true);
    setAttachments([]);
    setFileError(null);
    setActiveChatId(safeUUID());
  }

  function resetChat() {
    startNewChat();
  }
  void resetChat;

  function selectChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    setActiveChatId(id);
    setMessages(chat.messages || []);
    setHasStarted((chat.messages || []).length > 0);
    setName(null);
    setRoofArea(null);
    setRoofType(null);
    setMonthlyBill(null);
    setApplianceDetails(null);
    setApplianceStep(0);
    setConnectionType(null);
    setOwnership(null);
    setGoal(null);
    setLocationLabel(null);
    locationMessageShownRef.current = false;
    setAttachments([]);
    setFileError(null);
    setAutoScroll(true);
  }

  function renameChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    setPendingRenameChat(chat);
    setRenameValue(chat.title);
  }

  function confirmRenameChat() {
    if (!pendingRenameChat || !renameValue.trim()) return;
    const title = renameValue.trim().slice(0, 50);
    setChats((current) => current.map((item) => item.id === pendingRenameChat.id ? { ...item, title, updatedAt: Date.now() } : item));
    setPendingRenameChat(null);
    setRenameValue("");
  }

  function deleteChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    setPendingDeleteChat(chat);
  }

  function confirmDeleteChat() {
    if (!pendingDeleteChat) return;
    const id = pendingDeleteChat.id;
    const remaining = chats.filter((item) => item.id !== id);
    setChats(remaining);
    localStorage.setItem("roofray_chats", JSON.stringify(remaining));
    setPendingDeleteChat(null);
    if (id === activeChatId) {
      const next = remaining[0];
      if (next) selectChat(next.id);
      else startNewChat();
    }
  }

  function closeChat() {
    if (isFullScreenPage) router.push("/");
    else setOpen(false);
  }

  const visibleMessages = messages.filter((m) => m.content.trim());
  const composerPlaceholder =
    name === null ? "Enter your name"
      : roofArea === null ? "e.g. 1200 sq ft"
        : roofType === null ? "RCC/Concrete, Metal Sheet, Tile, or Other"
          : monthlyBill === null ? "e.g. ₹2500 per month"
            : connectionType === null ? "Residential, Commercial, or Other"
              : ownership === null ? "Own, Permission, or No"
                : goal === null ? "Reduce bill, Maximum generation, Cost/subsidy, or Feasibility"
                  : "Ask RoofRay anything...";

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes rr-dot { 0%,80%,100%{opacity:.2;transform:scale(.85)} 40%{opacity:1;transform:scale(1)} }
        @keyframes rr-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
                @property --rr-border-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
        @keyframes rr-border-spin { to { --rr-border-angle: 360deg; } }
        .rr-chat-shell { --rr-bg:#080E1C; position:relative; isolation:isolate; background:var(--rr-bg); border:1px solid rgba(74,163,255,.34); }
        .rr-chat-shell::before { content:""; position:absolute; inset:0; z-index:0; pointer-events:none; border-radius:inherit; padding:1px; background:conic-gradient(from var(--rr-border-angle), transparent 0 300deg, rgba(50,145,255,.12) 324deg, #52a9ff 345deg, transparent 360deg); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); mask-composite:exclude; animation:rr-border-spin 7s linear infinite; filter:drop-shadow(0 0 7px rgba(64,158,255,.55)); }
        .rr-chat-shell > .rr-chat-main { position:relative; z-index:1; }
        .rr-grid-surface { background-color:#080E1C; background-image:linear-gradient(rgba(60,130,210,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(60,130,210,.055) 1px,transparent 1px); background-size:26px 26px; }
        .rr-grid-overlay { position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 50% 45%, transparent 0, rgba(8,14,28,.1) 48%, rgba(8,14,28,.46) 100%); }
        .rr-user-bubble { position:relative; width:auto; min-height:0; height:auto; aspect-ratio:auto; background:linear-gradient(145deg,#173e73,#102b55); border:1px solid rgba(67,151,255,.58); box-shadow:0 8px 26px rgba(0,0,0,.18); }
        .rr-message-meta { display:inline-block; margin-left:7px; font-size:10px; line-height:1; color:rgba(125,190,255,.75); vertical-align:middle; }
        .rr-avatar-wrap { display:flex; align-items:center; justify-content:center; width:44px; height:44px; margin-right:8px; border:1px solid rgba(58,147,255,.34); border-radius:50%; background:rgba(7,17,32,.82); box-shadow:0 0 0 4px rgba(25,102,181,.05),0 0 16px rgba(48,140,255,.1); }
        .rr-assistant-card { position:relative; border:1px solid rgba(56,137,231,.45); border-radius:14px; background:linear-gradient(145deg,rgba(13,29,50,.92),rgba(8,20,37,.9)); box-shadow:0 10px 28px rgba(0,0,0,.15); }
        .rr-assistant-card::before { content:""; position:absolute; left:-1px; top:-1px; width:8px; height:8px; border-left:2px solid #48a0ff; border-top:2px solid #48a0ff; box-shadow:-2px -2px 9px rgba(55,157,255,.8); }
        .rr-assistant-card::after { content:""; position:absolute; right:-1px; bottom:-1px; width:8px; height:8px; border-right:2px solid #48a0ff; border-bottom:2px solid #48a0ff; box-shadow:2px 2px 9px rgba(55,157,255,.75); }
        .rr-choice-button { min-height:48px; display:flex; align-items:center; justify-content:center; gap:7px; border:1px solid rgba(66,128,194,.34); border-radius:12px; background:rgba(12,29,50,.62); color:#cbd5e1; font-size:13px; font-weight:500; transition:all .18s ease; }
        .rr-choice-button:hover { border-color:rgba(71,163,255,.85); background:rgba(28,73,126,.35); color:#fff; box-shadow:0 0 18px rgba(46,144,255,.12); transform:translateY(-1px); }
        .rr-choice-icon { color:#74b9ff; font-size:19px; line-height:1; }
        .rr-dot { animation: rr-dot 1.1s ease-in-out infinite; }
        .rr-dot-2 { animation-delay: 160ms; }
        .rr-dot-3 { animation-delay: 320ms; }
        .rr-msg-in { animation: rr-msg-in 220ms cubic-bezier(.16,1,.3,1) both; }
        .rr-scroll { scroll-behavior: smooth; }
        .rr-scroll::-webkit-scrollbar { width: 5px; }
        .rr-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 9999px; }
        .rr-scroll::-webkit-scrollbar-track { background: transparent; }
        .rr-icon-btn { display:flex;align-items:center;justify-content:center;height:44px;width:44px;border-radius:10px;color:rgb(100 116 139);outline:none;transition:background-color .15s ease,color .15s ease,transform .1s ease; }
        .rr-icon-btn:hover { background-color:rgba(255,255,255,.05);color:rgb(203 213 225); }
        .rr-icon-btn:focus-visible { outline:2px solid rgba(96,165,250,.5);outline-offset:2px; }
        .rr-icon-btn:active { transform:none; }
      `}</style>

      <section
        aria-label="RoofRay AI assistant"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={
          isFullScreenPage
            ? "rr-chat-shell fixed inset-0 z-[80] flex h-[100dvh] w-full flex-col overflow-hidden overflow-x-hidden text-white"
            : "rr-chat-shell fixed bottom-0 right-0 z-[80] flex h-[min(760px,100dvh)] w-full flex-col overflow-hidden text-white shadow-2xl shadow-black/60 sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100dvh-2rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:rounded-2xl lg:bottom-7 lg:right-7"
        }
      >
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          mobileOpen={sidebarOpen}
          onNewChat={() => { startNewChat(); closeSidebarOnMobile(); }}
          onSelect={(id) => { selectChat(id); closeSidebarOnMobile(); }}
          onRename={renameChat}
          onDelete={deleteChat}
          onCloseMobile={() => setSidebarOpen(false)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div className={`rr-chat-main flex min-h-0 h-full flex-col transition-[margin,width] duration-200 ${sidebarOpen ? "w-full md:ml-[270px] md:w-[calc(100%-270px)]" : "ml-0 w-full md:ml-[56px] md:w-[calc(100%-56px)]"}`}>
          <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0A1020]/98 px-4 backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              {/* Phones: menu button opens the sidebar. Desktop uses the compact rail instead. */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rr-icon-btn md:hidden"
                aria-label="Open chat history"
                title="Open sidebar"
              >
                <LuPanelLeft className="h-[19px] w-[19px] lg:hidden" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={closeChat} className="rr-icon-btn" aria-label="Close chat" title="Close chat">
                <LuX className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {pendingRenameChat && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rename-chat-title">
              <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111A2B] p-5 shadow-2xl shadow-black/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                  <LuPencil className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="rename-chat-title" className="text-base font-semibold text-white">Rename chat</h2>
                <p className="mt-1.5 text-sm text-slate-400">Choose a new name for this conversation.</p>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value.slice(0, 50))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmRenameChat();
                    if (event.key === "Escape") { setPendingRenameChat(null); setRenameValue(""); }
                  }}
                  maxLength={50}
                  className="mt-4 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-400/10 sm:text-sm"
                  aria-label="New chat name"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => { setPendingRenameChat(null); setRenameValue(""); }} className="h-10 rounded-lg border border-white/[0.08] px-4 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
                    Cancel
                  </button>
                  <button type="button" disabled={!renameValue.trim()} onClick={confirmRenameChat} className="h-10 rounded-lg bg-blue-500/15 px-4 text-sm font-medium text-blue-300 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingDeleteChat && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title">
              <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111A2B] p-5 shadow-2xl shadow-black/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
                  <LuTrash2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="delete-chat-title" className="text-base font-semibold text-white">Delete chat?</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                  Are you sure you want to delete “{pendingDeleteChat.title}”? This action cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setPendingDeleteChat(null)} className="h-10 rounded-lg border border-white/[0.08] px-4 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
                    Cancel
                  </button>
                  <button type="button" onClick={confirmDeleteChat} className="h-10 rounded-lg bg-red-500/15 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/25">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          <DragOverlay visible={dragOver} />

          <div
            ref={scrollRef}
            onScroll={handleMessagesScroll}
            role="log"
            aria-live="polite"
            aria-label="Conversation with RoofRay"
            className="rr-scroll rr-grid-surface relative flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="rr-grid-overlay" aria-hidden="true" />
            <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
              {!hasStarted ? (
                <EmptyState />
              ) : (
                <div className="space-y-6">
                  {visibleMessages.map((message) =>
                    message.role === "user" ? (
                      <UserMessage key={message.id} message={message} />
                    ) : (
                      <AssistantMessage
                        key={message.id}
                        message={message}
                        onRetry={(t) => void sendMessage(t)}
                        onLocationPermission={async () => {
                          const liveAnalysis = await loadLocationAnalysis(roofArea);
                          if (liveAnalysis) await generateFinalReport(liveAnalysis);
                        }}
                        locationCoords={locationCoords}
                        locationAccuracy={locationAccuracy}
                        reportPdfUrl={reportPdfUrl}
                        onPreviewPdf={() => void previewReportPdf(message.content)}
                        onDownloadPdf={() => void downloadReportPdf(message.content)}
                      />
                    )
                  )}
                  {loading && <ThinkingIndicator />}
                </div>
              )}
              <div ref={endRef} />
            </div>

            <ScrollToLatest
              visible={!autoScroll && hasStarted}
              onClick={() => { setAutoScroll(true); endRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            />
          </div>

          {goal !== null && (locationStatus === "idle" || locationStatus === "detecting" || locationStatus === "denied" || locationStatus === "unavailable") && !locationCoords && (
            <div className="mx-auto flex w-full max-w-[900px] flex-col gap-2 border-t border-blue-400/10 bg-[#0A1020]/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-100"><LuMapPin className="h-3.5 w-3.5" aria-hidden="true" />I need your location permission</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Allow location access so RoofRay can calculate your solar generation, shading, panel count and system size.
                </p>
                {locationError && (
                  <p role="alert" className="mt-1 text-[11px] text-amber-300">
                    {locationError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void loadLocationAnalysis(roofArea)}
                disabled={locationLoading}
                aria-busy={locationLoading}
                className="shrink-0 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-blue-200 disabled:cursor-wait disabled:opacity-60"
              >
                {locationLoading
                ? "Finding location…"
                : locationStatus === "denied"
                  ? "Enable Location"
                  : locationError?.includes("HTTPS")
                    ? "HTTPS Required"
                    : locationStatus === "unavailable"
                      ? "Try Again"
                      : "Allow Location"}
              </button>
            </div>
          )}

          {reportPdfGenerating && (
            <div className="border-t border-blue-400/10 bg-[#0A1020]/95 px-4 py-2 text-[11px] text-blue-300 sm:px-6">
              Preparing your PDF report...
            </div>
          )}
          {reportPdfError && !reportPdfGenerating && (
            <div className="flex items-center justify-between gap-3 border-t border-red-400/10 bg-[#0A1020]/95 px-4 py-2 text-[11px] text-red-300 sm:px-6">
              <span>{reportPdfError}</span>
              <button
                type="button"
                onClick={() => setReportPdfError(null)}
                className="shrink-0 text-slate-500 hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
          )}

          {reportPdfPreviewOpen && reportPdfUrl && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-6">
              <div className="flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">RoofRay Solar Report Preview</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void downloadReportPdf()} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Download PDF</button>
                    <button type="button" onClick={() => setReportPdfPreviewOpen(false)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">Close</button>
                  </div>
                </div>
                <object
                  data={reportPdfUrl}
                  type="application/pdf"
                  aria-label="RoofRay Solar Report PDF preview"
                  className="min-h-0 flex-1 border-0 bg-white"
                >
                  <div className="flex h-full flex-col items-center justify-center gap-4 bg-white p-8 text-center text-slate-700">
                    <p className="text-sm font-semibold">PDF preview is not available in this browser.</p>
                    <button
                      type="button"
                      onClick={() => void openReportPdfInNewTab()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Open PDF in new tab
                    </button>
                  </div>
                </object>
              </div>
            </div>
          )}

          <ChatComposer
            input={input}
            onInputChange={setInput}
            onSend={() => void sendMessage()}
            onStop={stopGeneration}
            loading={loading}
            placeholder={composerPlaceholder}
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onAddFiles={addFiles}
            fileError={fileError}
            onDismissError={() => setFileError(null)}
          />
        </div>
      </section>
    </>
  );
}