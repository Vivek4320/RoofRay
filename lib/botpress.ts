import type { RoofRayLocation } from "@/lib/location";

export type RoofRayBotpressLocation = RoofRayLocation & {
  source: "browser-geolocation";
};

type BotpressClient = {
  open?: () => void;
  close?: () => void;
  sendEvent?: (event: unknown) => void | Promise<void>;
  sendMessage?: (message: string) => void | Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => (() => void) | void;
};

declare global {
  interface Window {
    bp?: BotpressClient;
    botpress?: BotpressClient;
    RoofRayLocation?: RoofRayLocation;
  }
}

export const ROOFRAY_BOTPRESS_EVENT = "roofray_location";

export function getBotpressClient(): BotpressClient | null {
  if (typeof window === "undefined") return null;
  return window.botpress ?? window.bp ?? null;
}

export function openRoofRayBotpress(): boolean {
  if (typeof window === "undefined") return false;

  const client = getBotpressClient();

  if (client?.open) {
    client.open();
    return true;
  }

  // The Botpress config script may still be initializing. Wait for the
  // official initialization event instead of trying to open too early.
  if (window.botpress?.on) {
    window.botpress.on("webchat:initialized", () => {
      window.botpress?.open?.();
    });
    return true;
  }

  console.warn("[RoofRay] Botpress Webchat is still loading.");
  return false;
}

export function sendRoofRayLocationToBotpress(
  location: RoofRayLocation,
): boolean {
  const client = getBotpressClient();
  if (!client) {
    console.warn(
      "[RoofRay] Botpress Webchat client is unavailable; location was captured but not delivered.",
    );
    return false;
  }

  const payload: RoofRayBotpressLocation = {
    ...location,
    source: "browser-geolocation",
  };

  if (client.sendEvent) {
    void client.sendEvent({
      type: ROOFRAY_BOTPRESS_EVENT,
      payload,
    });
    return true;
  }

  if (client.sendMessage) {
    void client.sendMessage(
      `📍 My location: Latitude ${location.latitude}, Longitude ${location.longitude}`,
    );
    return true;
  }

  console.warn("[RoofRay] Botpress client has no sendEvent/sendMessage API.");
  return false;
}
