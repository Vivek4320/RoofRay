import type { RoofRayLocation } from "@/lib/location";

export type RoofRayBotpressLocation = RoofRayLocation & {
  source: "browser-geolocation";
};

export type RoofRaySolarAnalysis = {
  provider: "PVGIS";
  apiVersion: string;
  location: {
    latitude: number;
    longitude: number;
    elevationMeters: number | null;
    radiationDatabase: string | null;
    yearMin: number | null;
    yearMax: number | null;
  };
  system: {
    peakPowerKw: number;
    lossesPercent: number;
    technology: string;
    mounting: string;
  };
  optimalOrientation: {
    slopeDeg: number | null;
    azimuthDeg: number | null;
    direction: string | null;
  };
  annual: {
    energyKwh: number | null;
    specificYieldKwhPerKwp: number | null;
    irradiationKwhM2: number | null;
    averageDailyEnergyKwh: number | null;
  };
  monthly: Array<{
    month: number;
    energyKwh: number;
    irradiationKwhM2: number;
    averageDailyEnergyKwh: number;
    averageDailyIrradiationKwhM2: number;
  }>;
  notes: string[];
  sunCycle: {
    current: {
      timestamp: string;
      azimuthDeg: number;
      elevationDeg: number;
      direction: string;
      aboveHorizon: boolean;
    };
    next12Hours: Array<{
      timestamp: string;
      azimuthDeg: number;
      elevationDeg: number;
      direction: string;
      aboveHorizon: boolean;
    }>;
  };
  obstacles: {
    provider: "OpenStreetMap Overpass";
    radiusMeters: number;
    obstacles: Array<{
      id: string;
      type: "building" | "tower" | "mast" | "other";
      name: string | null;
      latitude: number;
      longitude: number;
      distanceMeters: number;
      bearingDeg: number;
      heightMeters: number;
      heightSource: "osm-height" | "osm-levels" | "estimated";
      tags: Record<string, string>;
      shadowRisk: "high" | "medium" | "low" | "unknown";
      estimatedShadowReachMeters: number | null;
    }>;
    likelyShadowDirections: string[];
    caveats: string[];
    attribution: "© OpenStreetMap contributors";
  };
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
export const ROOFRAY_SOLAR_ANALYSIS_EVENT = "roofray_solar_analysis";

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

  if (window.botpress?.on) {
    window.botpress.on("webchat:initialized", () => {
      window.botpress?.open?.();
    });
    return true;
  }

  console.warn("[RoofRay] Botpress Webchat is still loading.");
  return false;
}

export function sendRoofRayLocationToBotpress(location: RoofRayLocation): boolean {
  const client = getBotpressClient();
  if (!client) {
    console.warn("[RoofRay] Botpress Webchat client is unavailable; location was captured but not delivered.");
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

export function sendRoofRaySolarAnalysisToBotpress(
  analysis: RoofRaySolarAnalysis,
): boolean {
  const client = getBotpressClient();

  if (!client) {
    console.warn(
      "[RoofRay] Botpress Webchat client is unavailable; solar analysis is ready but not delivered.",
    );
    return false;
  }

  if (client.sendEvent) {
    void client.sendEvent({
      type: ROOFRAY_SOLAR_ANALYSIS_EVENT,
      payload: analysis,
    });
    return true;
  }

  if (client.sendMessage) {
    const highRisk = analysis.obstacles.obstacles.filter(
      (obstacle) => obstacle.shadowRisk === "high",
    );
    const direction = analysis.optimalOrientation.direction ?? "the optimal direction";
    const annual = analysis.annual.energyKwh;

    void client.sendMessage(
      `☀️ RoofRay analysis ready: ${annual ?? "N/A"} kWh/year for ${analysis.system.peakPowerKw} kWp. Solar-resource optimum: ${direction}. Nearby mapped high-shadow-risk obstacles: ${highRisk.length}.`,
    );
    return true;
  }

  console.warn("[RoofRay] Botpress client has no sendEvent/sendMessage API for solar analysis.");
  return false;
}
