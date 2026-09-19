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
    __roofrayBotpressReady?: boolean;
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
          existing.addEventListener(
            "error",
            () => reject(new Error(`Failed to load ${src}`)),
            { once: true },
          );
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

        script.onerror = () => {
          reject(new Error(`Failed to load ${src}`));
        };

        document.head.appendChild(script);
      });

    const waitForBotpress = async () => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (cancelled) return false;
        if (window.botpress?.on) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }

      return false;
    };

    const initialize = async () => {
      try {
        // Botpress requires inject.js to load before the dashboard config.
        await loadScript(BOTPRESS_INJECT_URL, "roofray-botpress-v37");
        if (cancelled) return;

        // Make absolutely sure the Botpress client exists before loading the
        // config script. This listener must exist BEFORE window.botpress.init().
        const botpressAvailable = await waitForBotpress();

        if (!botpressAvailable) {
          throw new Error("Botpress client was not created by inject.js");
        }

        window.botpress?.on?.("webchat:initialized", () => {
          window.__roofrayBotpressReady = true;
          console.log("[RoofRay] Botpress Webchat initialized");
          window.dispatchEvent(
            new CustomEvent("roofray_botpress_initialized"),
          );
        });

        window.botpress?.on?.("webchat:opened", () => {
          console.log("[RoofRay] Botpress Webchat opened");
        });

        window.botpress?.on?.("error", (error) => {
          console.error("[RoofRay] Botpress Webchat error:", error);
        });

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
