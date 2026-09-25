"use client";

import Image from "next/image";
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
    const value = sessionStorage.getItem("roofray_solar_analysis");
    return value ? (JSON.parse(value) as SolarAnalysis) : null;
  } catch { return null; }
}

function readNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
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
  collapsed,
  mobileOpen,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onToggleCollapse,
  onCloseMobile,
}: {
  chats: ChatRecord[];
  activeChatId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[100] flex flex-col border-r border-white/[0.06] bg-[#090F1C] text-white shadow-2xl shadow-black/40 transition-all duration-200 ease-out
          ${collapsed ? "w-[72px]" : "w-[270px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        aria-label="RoofRay chat history"
      >
        <div className={`flex h-[60px] shrink-0 items-center border-b border-white/[0.05] ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <Image src={LOGO_SRC} alt="RoofRay" width={42} height={42} className="h-9 w-9 object-contain" priority />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">RoofRay</p>
                <p className="truncate text-[10px] text-slate-500">AI Solar Assistant</p>
              </div>
            </div>
          ) : (
            <Image src={LOGO_SRC} alt="RoofRay" width={36} height={36} className="h-9 w-9 object-contain" priority />
          )}
          <button type="button" onClick={onToggleCollapse} className="rr-icon-btn hidden md:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onNewChat}
            className={`flex h-10 w-full items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[13px] font-medium text-slate-200 transition hover:border-blue-400/20 hover:bg-blue-500/[0.08] hover:text-white ${collapsed ? "justify-center px-0" : "gap-2.5 px-3"}`}
            title="New chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {!collapsed && "New chat"}
          </button>
        </div>

        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
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
                    <div className="relative shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                          <circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" />
                        </svg>
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
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
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
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                            <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="border-t border-white/[0.05] p-3">
          <button type="button" onClick={onCloseMobile} className={`flex h-9 w-full items-center rounded-lg text-xs text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300 md:hidden ${collapsed ? "justify-center" : "gap-2 px-2"}`} aria-label="Close sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
            {!collapsed && "Close"}
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
        <Image src="/Logo-removebg-preview.png" alt="RoofRay" width={100} height={100} priority className="h-28 w-28 shrink-0 object-contain" />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onReset}
          aria-label="Start new chat"
          title="New chat"
          className="group rr-icon-btn"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[17px] w-[17px] transition-transform duration-300 ease-out group-hover:rotate-[200deg]"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 1 3.2 6.9" />
            <path d="M3 4v5h5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          title="Close chat"
          className="rr-icon-btn"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[17px] w-[17px]"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-6 py-16 text-center">
        <Image src="/Logo-removebg-preview.png" alt="RoofRay logo" width={110} height={110} priority className="h-50 w-50 " />
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="rr-msg-in flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-br-[6px] bg-[#1A3A6B] px-4 py-3 text-[14px] leading-relaxed text-slate-100 ring-1 ring-white/[0.06]">
        {message.content}
      </div>
    </div>
  );
}

function AssistantMessage({ message, onRetry }: { message: ChatMessage; onRetry: (content: string) => void }) {
  return (
    <div className="rr-msg-in flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-white/[0.07]">
        <Image src={LOGO_SRC} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" aria-hidden="true" />
      </div>
      <div className="min-w-0 max-w-[85%] pt-0.5 text-[14px] leading-relaxed text-slate-200">
        {message.isError ? (
          <div>
            <p className="text-slate-400">{message.content}</p>
            {message.failedInput && (
              <button
                type="button"
                onClick={() => onRetry(message.failedInput as string)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-slate-400 transition-all duration-200 hover:border-blue-400/30 hover:text-blue-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M3 12a9 9 0 1 1 3.2 6.9" /><path d="M3 4v5h5" /></svg>
                Try again
              </button>
            )}
          </div>
        ) : (
          renderAssistantContent(message.content)
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="rr-msg-in flex items-center gap-3" role="status" aria-live="polite" aria-label="RoofRay is preparing a response">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-white/[0.07]">
        <Image src={LOGO_SRC} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" aria-hidden="true" />
      </div>
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
              <span className="text-[18px]" aria-hidden="true">
                {att.file.type === "application/pdf" ? "📄" : att.file.type === "text/csv" ? "📊" : "📝"}
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
    function handleKey(e: globalThis.KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Attachment options"
      className={`absolute bottom-full left-0 mb-2 min-w-[180px] origin-bottom-left rounded-2xl border border-white/[0.07] bg-[#111B2E] py-1.5 shadow-2xl shadow-black/50 transition-all duration-200 ${
        open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
      }`}
    >
      <button type="button" role="menuitem" onClick={() => { onPhoto(); onClose(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white">
        <span aria-hidden="true" className="text-base">📷</span> Upload Photo
      </button>
      <button type="button" role="menuitem" onClick={() => { onFile(); onClose(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white">
        <span aria-hidden="true" className="text-base">📄</span> Upload File
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
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#111B2E]/95 px-3.5 py-2 text-[12px] font-medium text-slate-300 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-blue-400/30 hover:text-white ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
      Latest
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
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-blue-400" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        </div>
        <p className="text-[15px] font-medium text-white">Drop files to attach</p>
        <p className="text-[12px] text-slate-400">Images, PDF, TXT, or CSV</p>
      </div>
    </div>
  );
}

function ChatComposer({
  input, onInputChange, onSend, loading, placeholder, attachments, onRemoveAttachment, onAddFiles, fileError, onDismissError,
}: {
  input: string; onInputChange: (v: string) => void; onSend: () => void; loading: boolean; placeholder: string;
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
          <button type="button" onClick={onDismissError} aria-label="Dismiss error" className="shrink-0 text-red-400/60 hover:text-red-400">×</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (canSend) onSend(); }} className="mx-auto max-w-[900px]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F1929] transition-colors duration-200 focus-within:border-blue-500/30">
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
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-slate-400 transition-all duration-200 ${
                  menuOpen ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-slate-200"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform duration-200 ${menuOpen ? "rotate-45" : ""}`} aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
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
              className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-6 text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
              style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
            />

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all duration-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[16px] w-[16px]" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
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
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreenPage = pathname === "/chat";
  const [open, setOpen] = useState(isFullScreenPage);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  void locationLoading;
  void locationStatus;
  void locationAccuracy;

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

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const newAtts: AttachedFile[] = [];
    let error: string | null = null;
    for (const file of list) {
      if (attachments.length + newAtts.length >= MAX_ATTACHMENTS) { error = `Maximum ${MAX_ATTACHMENTS} files allowed.`; break; }
      if (!ALLOWED_TYPES.includes(file.type)) { error = "File type not supported."; continue; }
      if (file.size > MAX_FILE_BYTES) { error = "File is larger than 10 MB."; continue; }
      const id = crypto.randomUUID();
      const preview = ALLOWED_IMAGES.includes(file.type) ? URL.createObjectURL(file) : undefined;
      newAtts.push({ id, file, preview });
    }
    if (error) setFileError(error);
    if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
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
    const handleOpen = () => { setOpen(true); if (!getStoredAnalysis()) void loadLocationAnalysis(); };
    window.addEventListener("roofray:open-chat", handleOpen);
    if (sessionStorage.getItem("roofray_pending_chat") === "true") {
      sessionStorage.removeItem("roofray_pending_chat");
      setOpen(true);
      void loadLocationAnalysis();
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
          setChats(parsed);
          if (parsed.length > 0) {
            const latest = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)[0];
            setActiveChatId(latest.id);
            setMessages(latest.messages || []);
            setHasStarted((latest.messages || []).length > 0);
          }
        }
      }
    } catch { /* ignore malformed local history */ }
  }, []);

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

  async function refreshAnalysisWithRoofArea(areaSqFt: number): Promise<SolarAnalysis | null> {
    const analysisLocation = solarContext?.location as Record<string, unknown> | undefined;
    const latitude = readNumber(analysisLocation?.latitude) ?? locationCoords?.latitude ?? null;
    const longitude = readNumber(analysisLocation?.longitude) ?? locationCoords?.longitude ?? null;
    if (latitude === null || longitude === null) return null;

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
        return data.analysis as SolarAnalysis;
      }
    } catch { }
    return null;
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (loading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: content || `[${attachments.length} file(s) attached]` };
    const nextMessages = [...messages, userMessage];
    setHasStarted(true);
    setAutoScroll(true);
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setLoading(true);

    const number = readNumber(content.replace(/[^0-9.]/g, ""));
    let nextRoofArea = roofArea;
    let nextMonthlyBill = monthlyBill;
    let nextShading = shading;
    let currentSolarContext = solarContext;

    if (roofArea === null && number !== null && number > 0) {
      nextRoofArea = number;
      setRoofArea(number);
      const refreshedAnalysis = await refreshAnalysisWithRoofArea(number);
      if (refreshedAnalysis) currentSolarContext = refreshedAnalysis;
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
          messages: nextMessages.map(({ role, content: mc }) => ({ role, content: mc })),
          solarContext: {
            ...(currentSolarContext || {}),
            userInputs: { roofAreaSqFt: nextRoofArea, monthlyBillInr: nextMonthlyBill, shading: nextShading },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to get a response.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: data.message }]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: "RoofRay couldn't complete that request. Please try again.", isError: true, failedInput: content },
      ]);
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
  void openChat;

  function startNewChat() {
    setMessages([]);
    setRoofArea(null);
    setMonthlyBill(null);
    setShading(null);
    setHasStarted(false);
    setAutoScroll(true);
    setAttachments([]);
    setFileError(null);
    setActiveChatId(crypto.randomUUID());
    setSidebarOpen(false);
  }

  function resetChat() {
    startNewChat();
  }

  function selectChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    setActiveChatId(id);
    setMessages(chat.messages || []);
    setHasStarted((chat.messages || []).length > 0);
    setRoofArea(null);
    setMonthlyBill(null);
    setShading(null);
    setAttachments([]);
    setFileError(null);
    setAutoScroll(true);
    setSidebarOpen(false);
  }

  function renameChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    const title = window.prompt("Rename chat", chat.title);
    if (!title?.trim()) return;
    setChats((current) => current.map((item) => item.id === id ? { ...item, title: title.trim().slice(0, 50), updatedAt: Date.now() } : item));
  }

  function deleteChat(id: string) {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;
    const remaining = chats.filter((item) => item.id !== id);
    setChats(remaining);
    localStorage.setItem("roofray_chats", JSON.stringify(remaining));
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
    roofArea === null ? "e.g. 1200 sq ft"
    : monthlyBill === null ? "e.g. ₹2500 per month"
    : shading === null ? "No, Partial, or Heavy"
    : "Ask RoofRay anything...";

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes rr-dot { 0%,80%,100%{opacity:.2;transform:scale(.85)} 40%{opacity:1;transform:scale(1)} }
        @keyframes rr-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
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
        .rr-icon-btn:active { transform:scale(.93); }
      `}</style>

      <section
        aria-label="RoofRay AI assistant"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={
          isFullScreenPage
            ? "fixed inset-0 z-[80] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#080E1C] text-white"
            : "fixed bottom-0 right-0 z-[80] flex h-[min(760px,100dvh)] w-full flex-col overflow-hidden border border-white/[0.07] bg-[#080E1C] text-white shadow-2xl shadow-black/60 sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100dvh-2rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:rounded-2xl lg:bottom-7 lg:right-7"
        }
      >
        <div className="fixed left-0 top-0 z-[110] flex h-[60px] items-center px-2 md:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rr-icon-btn bg-[#0A1020]/90 backdrop-blur" aria-label="Open chat history" title="Chat history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>

        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          collapsed={sidebarCollapsed}
          mobileOpen={sidebarOpen}
          onNewChat={startNewChat}
          onSelect={selectChat}
          onRename={renameChat}
          onDelete={deleteChat}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        <div className={`flex min-h-0 h-full w-full flex-col transition-[margin] duration-200 ${sidebarCollapsed ? "md:ml-[72px] md:w-[calc(100%-72px)]" : "md:ml-[270px] md:w-[calc(100%-270px)]"}`}>
          <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0A1020]/98 px-4 backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => setSidebarOpen(true)} className="rr-icon-btn hidden md:flex" aria-label="Open chat history" title="Chat history">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-slate-200">{chatTitle(messages)}</p>
                <p className="text-[10px] text-slate-600">RoofRay AI Solar Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={resetChat} className="rr-icon-btn" aria-label="Start new chat" title="New chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 12a9 9 0 1 1 3.2 6.9"/><path d="M3 4v5h5"/></svg>
              </button>
              <button type="button" onClick={closeChat} className="rr-icon-btn" aria-label="Close chat" title="Close chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </header>

        <DragOverlay visible={dragOver} />

        <div
          ref={scrollRef}
          onScroll={handleMessagesScroll}
          role="log"
          aria-live="polite"
          aria-label="Conversation with RoofRay"
          className="rr-scroll relative flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
            {!hasStarted ? (
              <EmptyState />
            ) : (
              <div className="space-y-6">
                {visibleMessages.map((message) =>
                  message.role === "user" ? (
                    <UserMessage key={message.id} message={message} />
                  ) : (
                    <AssistantMessage key={message.id} message={message} onRetry={(t) => void sendMessage(t)} />
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

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSend={() => void sendMessage()}
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