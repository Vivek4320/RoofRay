/**
 * Browser location -> Botpress bridge for RoofRay.
 *
 * Set NEXT_PUBLIC_BOTPRESS_WEBCHAT_ID to the Webchat bot ID from Botpress.
 * The bridge intentionally keeps the browser geolocation API separate from
 * the chatbot implementation so the location capture can also be reused by
 * the solar-data/report flow.
 */

import type { RoofRayLocation } from "@/lib/location";

export type RoofRayBotpressLocation = RoofRayLocation & {
  source: "browser-geolocation";
};

type BotpressClient = {
  open?: () => void;
  close?: () => void;
  sendEvent?: (event: unknown) => void;
  sendMessage?: (message: unknown) => void;
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
  return window.bp ?? window.botpress ?? null;
}

export function openRoofRayBotpress(): boolean {
  const client = getBotpressClient();

  if (!client?.open) {
    console.warn(
      "[RoofRay] Botpress Webchat is not loaded. Add the Botpress Webchat embed before opening the chat.",
    );
    return false;
  }

  client.open();
  return true;
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

  // Botpress Webchat integrations differ slightly by generated client version.
  // Prefer the Webchat event API, then fall back to its message API.
  if (client.sendEvent) {
    client.sendEvent({
      type: ROOFRAY_BOTPRESS_EVENT,
      payload,
    });
    return true;
  }

  if (client.sendMessage) {
    client.sendMessage({
      type: "text",
      text: `📍 My location: Latitude ${location.latitude}, Longitude ${location.longitude}`,
      metadata: {
        roofrayLocation: payload,
      },
    });
    return true;
  }

  console.warn(
    "[RoofRay] Botpress client loaded, but no supported send API was found.",
  );
  return false;
}
