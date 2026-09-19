'use client';

import { useEffect } from "react";

const BOTPRESS_INJECT_URL =
  "https://cdn.botpress.cloud/webchat/v3.7/inject.js";
const BOTPRESS_CONFIG_URL =
  "https://files.bpcontent.cloud/2026/07/12/16/20260712163416-V9EJYWEN.js";

declare global {
  interface Window {
    botpress?: {
      open?: () => void;
      close?: () => void;
      sendEvent?: (event: unknown) => void;
      sendMessage?: (message: string) => void;
      on?: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => (() => void) | void;
    };
  }
}

export default function BotpressProvider() {
  useEffect(() => {
    let cancelled = false;

    const loadScript = (src: string, id: string) =>
      new Promise<void>((resolve, reject) => {
        const existing = document.getElementById(id) as HTMLScriptElement | null;

        if (existing) {
          if (existing.dataset.loaded === "true") {
            resolve();
            return;
          }
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
            once: true,
          });
          return;
        }

        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = () => {
          script.dataset.loaded = "true";
          resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });

    const initialize = async () => {
      try {
        // 1. Load the Botpress loader.
        await loadScript(BOTPRESS_INJECT_URL, "roofray-botpress-v37");
        if (cancelled) return;

        // 2. IMPORTANT: register the initialization listener BEFORE the
        // config script calls window.botpress.init().
        const botpress = window.botpress;
        botpress?.on?.("webchat:initialized", () => {
          window.dispatchEvent(new CustomEvent("roofray_botpress_initialized"));
        });

        // 3. Now load the dashboard-generated config/init script.
        await loadScript(BOTPRESS_CONFIG_URL, "roofray-botpress-config");
        if (cancelled) return;

        window.dispatchEvent(new CustomEvent("roofray_botpress_ready"));
      } catch (error) {
        console.error("[RoofRay] Failed to load Botpress Webchat:", error);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
