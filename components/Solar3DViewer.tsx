"use client";

import { useEffect, useMemo, useState } from "react";

type Solar3DViewerProps = {
  latitude?: number | null;
  longitude?: number | null;
};

function readStoredLocation() {
  if (typeof window === "undefined") return null;
  try {
    const sources = [
      sessionStorage.getItem("roofray_solar_analysis"),
      localStorage.getItem("roofray_solar_analysis"),
      sessionStorage.getItem("roofray_location"),
      localStorage.getItem("roofray_location"),
    ].filter(Boolean);

    for (const raw of sources) {
      const parsed = JSON.parse(raw as string);
      const location =
        parsed?.analysis?.planningEstimate?.location ??
        parsed?.planningEstimate?.location ??
        parsed?.solarContext?.planningEstimate?.location ??
        parsed?.location ??
        parsed;
      const lat = Number(location?.latitude);
      const lon = Number(location?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { latitude: lat, longitude: lon };
      }
    }
  } catch {}
  return null;
}

function readStoredAnalysis() {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem("roofray_solar_analysis") ||
      localStorage.getItem("roofray_solar_analysis");
    return raw ? JSON.parse(raw)?.analysis ?? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchBrowserSatelliteReference(latitude: number, longitude: number) {
  const metersPerDegreeLat = 111320;
  const halfWidthMeters = 170;
  const halfHeightMeters = 120;
  const latDelta = halfHeightMeters / metersPerDegreeLat;
  const lonDelta =
    halfWidthMeters /
    Math.max(1, metersPerDegreeLat * Math.cos((latitude * Math.PI) / 180));

  const bbox = [
    longitude - lonDelta,
    latitude - latDelta,
    longitude + lonDelta,
    latitude + latDelta,
  ].join(",");

  const hosts = [
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  ];

  for (const host of hosts) {
    try {
      const params = new URLSearchParams({
        bbox,
        bboxSR: "4326",
        imageSR: "4326",
        size: "1344,768",
        format: "jpg",
        f: "image",
        transparent: "false",
      });

      const response = await fetch(`${host}?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) continue;

      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size < 5000) continue;

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error ?? new Error("Unable to read satellite image."));
        reader.readAsDataURL(blob);
      });
    } catch {
      // Try the second ArcGIS host. The API route also has a server-side fallback.
    }
  }

  return null;
}

export default function Solar3DViewer({ latitude, longitude }: Solar3DViewerProps) {
  const [image, setImage] = useState("");
  const [status, setStatus] = useState("Generating your AI solar site view...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const location = useMemo(() => {
    const stored = readStoredLocation();
    const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : stored?.latitude;
    const lon = Number.isFinite(Number(longitude)) ? Number(longitude) : stored?.longitude;
    return Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: Number(lat), longitude: Number(lon) }
      : null;
  }, [latitude, longitude]);

  const generateVisual = async () => {
    if (!location) {
      setError("No location found. Complete RoofRay location analysis first.");
      setStatus("");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Reading your location and satellite reference...");

    try {
      const analysis = readStoredAnalysis();
      let satelliteReferenceDataUrl: string | null = null;

      try {
        satelliteReferenceDataUrl = await fetchBrowserSatelliteReference(
          location.latitude,
          location.longitude,
        );
      } catch {
        satelliteReferenceDataUrl = null;
      }

      setStatus(
        satelliteReferenceDataUrl
          ? "Satellite reference loaded. Generating the AI solar view..."
          : "Satellite reference unavailable. Generating the AI solar view from GPS and solar data...",
      );

      const response = await fetch("/api/solar-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          analysis,
          satelliteReferenceDataUrl,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || typeof data.image !== "string") {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The AI solar visual could not be generated.",
        );
      }

      setImage(data.image);
      setStatus("AI solar site view ready.");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate the AI solar site view.",
      );
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void generateVisual();
    // Location changes should create a new visual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  return (
    <section className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden bg-[#050912]">
      {image ? (
        <img
          src={image}
          alt="RoofRay AI-generated solar site view with target house and sun path"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050912]">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#07111c]/90 px-6 py-5 text-center text-white shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-cyan-400/30 ring-4 ring-cyan-400/10" />
            <p className="text-sm font-semibold">RoofRay AI Solar Visual</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {status || "Preparing your location-based solar scene..."}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#07111c]/85 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          RoofRay AI Solar View
        </p>
        <h1 className="mt-1 text-lg font-semibold">Your location, roof & sun path</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          AI visual generated from the live location and satellite reference. Green marks the
          target house, blue marks nearby buildings and yellow shows the calculated sun path.
        </p>
      </div>

      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-2">
        {error && (
          <div className="max-w-sm rounded-xl border border-amber-300/20 bg-[#07111c]/90 px-4 py-3 text-xs text-amber-100 shadow-xl backdrop-blur-xl">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void generateVisual()}
          disabled={loading}
          className="rounded-xl border border-cyan-300/30 bg-[#07111c]/90 px-4 py-3 text-xs font-semibold text-cyan-100 shadow-xl backdrop-blur-xl transition hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Generating..." : "Regenerate AI View"}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-xl border border-white/10 bg-[#07111c]/85 px-4 py-3 text-xs text-slate-200 shadow-xl backdrop-blur-xl">
        <div className="font-semibold text-white">RoofRay visual</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          Your House
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
          Nearby Buildings
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Sun Path
        </div>
      </div>
    </section>
  );
}
