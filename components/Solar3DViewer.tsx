"use client";

import { useEffect, useMemo, useState } from "react";

type Solar3DViewerProps = {
  latitude?: number | null;
  longitude?: number | null;
};

type Building = {
  polygon: Array<{ latitude: number; longitude: number }>;
  heightMeters: number;
  levels: number;
  containsTarget: boolean;
};

type Point = { x: number; y: number };

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
  const halfWidthMeters = 280;
  const halfHeightMeters = 200;
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
        size: "1600,900",
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
    } catch {}
  }

  return null;
}

function projectPoint(
  point: { latitude: number; longitude: number },
  center: { latitude: number; longitude: number },
  width: number,
  height: number,
): Point {
  const metersLat = 111320;
  const metersLon = 111320 * Math.cos((center.latitude * Math.PI) / 180);
  const xMeters = (point.longitude - center.longitude) * metersLon;
  const yMeters = (point.latitude - center.latitude) * metersLat;
  return {
    x: width / 2 + (xMeters / 560) * width,
    y: height / 2 - (yMeters / 400) * height,
  };
}

function polygonCenter(polygon: Array<{ latitude: number; longitude: number }>) {
  if (!polygon.length) return null;
  const latitude = polygon.reduce((sum, p) => sum + p.latitude, 0) / polygon.length;
  const longitude = polygon.reduce((sum, p) => sum + p.longitude, 0) / polygon.length;
  return { latitude, longitude };
}

function polygonAreaSqM(polygon: Array<{ latitude: number; longitude: number }>) {
  if (polygon.length < 3) return 0;
  const center = polygonCenter(polygon);
  if (!center) return 0;
  const metersLat = 111320;
  const metersLon = 111320 * Math.cos((center.latitude * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ax = (a.longitude - center.longitude) * metersLon;
    const ay = (a.latitude - center.latitude) * metersLat;
    const bx = (b.longitude - center.longitude) * metersLon;
    const by = (b.latitude - center.latitude) * metersLat;
    area += ax * by - bx * ay;
  }
  return Math.abs(area) / 2;
}

function fallbackBuilding(
  center: { latitude: number; longitude: number },
  roofAreaSqFt: number,
): Building {
  const area = Math.max(20, roofAreaSqFt * 0.092903);
  const width = Math.max(5, Math.sqrt(area * 1.35));
  const depth = Math.max(4, area / width);
  const metersLat = 111320;
  const metersLon = 111320 * Math.cos((center.latitude * Math.PI) / 180);
  const latHalf = (depth / 2) / metersLat;
  const lonHalf = (width / 2) / Math.max(1, metersLon);

  return {
    polygon: [
      { latitude: center.latitude - latHalf, longitude: center.longitude - lonHalf },
      { latitude: center.latitude - latHalf, longitude: center.longitude + lonHalf },
      { latitude: center.latitude + latHalf, longitude: center.longitude + lonHalf },
      { latitude: center.latitude + latHalf, longitude: center.longitude - lonHalf },
    ],
    heightMeters: 4,
    levels: 1,
    containsTarget: true,
  };
}

function sunPoints(
  analysis: Record<string, unknown> | null,
  center: { x: number; y: number },
  width: number,
  height: number,
) {
  const sun = (analysis?.sunCycle ?? {}) as Record<string, unknown>;
  const samples = Array.isArray(sun.next12Hours)
    ? (sun.next12Hours as Array<Record<string, unknown>>)
    : [];

  const points = samples
    .filter((sample) => Number.isFinite(Number(sample.azimuthDeg)))
    .slice(0, 12)
    .map((sample, index) => {
      const azimuth = (Number(sample.azimuthDeg) * Math.PI) / 180;
      const elevation = Math.max(0, Number(sample.elevationDeg) || 0);
      const radius = Math.min(width, height) * (0.16 + Math.min(1, elevation / 80) * 0.2);
      return {
        x: center.x + Math.sin(azimuth) * radius,
        y: center.y - Math.cos(azimuth) * radius,
        time: String(sample.timestamp ?? "").slice(11, 16),
        elevation,
        index,
      };
    });

  let lastLabelPoint: { x: number; y: number } | null = null;
  return points.map((point) => {
    const farEnough = !lastLabelPoint ||
      Math.hypot(point.x - lastLabelPoint.x, point.y - lastLabelPoint.y) >= 76;
    const showTime = farEnough && Boolean(point.time);
    if (showTime) lastLabelPoint = point;
    return { ...point, showTime };
  });
}

export default function Solar3DViewer({ latitude, longitude }: Solar3DViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [satellite, setSatellite] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [status, setStatus] = useState("Preparing your location-based solar visual...");
  const [error, setError] = useState("");

  const storedLocation = useMemo(() => (mounted ? readStoredLocation() : null), [mounted]);
  const [browserLocation, setBrowserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const location = useMemo(() => {
    if (!mounted) return null;
    const lat = Number.isFinite(Number(latitude))
      ? Number(latitude)
      : storedLocation?.latitude ?? browserLocation?.latitude;
    const lon = Number.isFinite(Number(longitude))
      ? Number(longitude)
      : storedLocation?.longitude ?? browserLocation?.longitude;
    return Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: Number(lat), longitude: Number(lon) }
      : null;
  }, [mounted, latitude, longitude, storedLocation, browserLocation]);

  const analysis = useMemo(() => readStoredAnalysis(), []);
  const planning = (analysis?.planningEstimate ?? {}) as Record<string, unknown>;
  const roofAreaSqFt = Number(planning.roofAreaSqFt);
  const panelCount = Number(planning.panelCount);
  const targetFallback = location
    ? fallbackBuilding(location, Number.isFinite(roofAreaSqFt) ? roofAreaSqFt : 350)
    : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || latitude != null || longitude != null || storedLocation) return;
    if (!navigator.geolocation) {
      setError("Location is unavailable. Complete the RoofRay location analysis first.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setError("Location permission is required. Complete the RoofRay location analysis first.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [mounted, latitude, longitude, storedLocation]);

  useEffect(() => {
    if (!mounted) return;
    if (!location) {
      setError("No location found. Complete RoofRay location analysis first.");
      return;
    }

    let cancelled = false;
    const load = async () => {
      setError("");
      setStatus("Loading satellite reference and mapped buildings...");

      const [satelliteResult, buildingsResult] = await Promise.allSettled([
        fetch(
          `/api/satellite-reference?latitude=${location.latitude}&longitude=${location.longitude}`,
          { cache: "no-store" },
        ).then(async (response) => {
          if (!response.ok) return null;
          const data = await response.json();
          return typeof data?.image === "string" ? data.image : null;
        }),
        fetch(
          `/api/map-buildings?latitude=${location.latitude}&longitude=${location.longitude}&radius=240`,
          { cache: "no-store" },
        ).then((response) => (response.ok ? response.json() : null)),
      ]);

      if (cancelled) return;

      if (satelliteResult.status === "fulfilled" && satelliteResult.value) {
        setSatellite(satelliteResult.value);
      } else {
        setSatellite(null);
      }

      if (
        buildingsResult.status === "fulfilled" &&
        buildingsResult.value?.ok &&
        Array.isArray(buildingsResult.value.buildings)
      ) {
        setBuildings(buildingsResult.value.buildings as Building[]);
      } else {
        setBuildings([]);
      }

      setStatus("RoofRay solar visual ready.");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [mounted, location]);

  if (!location) {
    return (
      <section className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#050912] text-white">
        <div className="rounded-2xl border border-white/10 bg-[#07111c]/90 px-6 py-5 text-center">
          <p className="text-sm font-semibold">RoofRay Solar Visual</p>
          <p className="mt-2 text-xs text-slate-300">Complete the location analysis first.</p>
        </div>
      </section>
    );
  }

  const target =
    buildings.find((building) => building.containsTarget) ??
    buildings[0] ??
    targetFallback;

  const mappedBuildings = target ? [target, ...buildings.filter((b) => b !== target)] : buildings;
  const W = 1600;
  const H = 900;
  const targetPoints = target
    ? target.polygon.map((point) => projectPoint(point, location, W, H))
    : [];
  const targetCenter = targetPoints.length
    ? {
        x: targetPoints.reduce((sum, p) => sum + p.x, 0) / targetPoints.length,
        y: targetPoints.reduce((sum, p) => sum + p.y, 0) / targetPoints.length,
      }
    : { x: W / 2, y: H / 2 };
  const sun = sunPoints(analysis, targetCenter, W, H);
  const sunPath = sun.map((p) => `${p.x},${p.y}`).join(" ");
  const targetArea = target ? polygonAreaSqM(target.polygon) : 0;

  const sunset = String((analysis?.sunCycle as Record<string, unknown> | undefined)?.sunset ?? "--");
  const sunrise = String((analysis?.sunCycle as Record<string, unknown> | undefined)?.sunrise ?? "--");
  const solarNoon = String((analysis?.sunCycle as Record<string, unknown> | undefined)?.solarNoon ?? "--");
  const direction = String(planning.recommendedDirection ?? "--");
  const slope = String(planning.recommendedSlopeDeg ?? "--");

  return (
    <section className="w-full bg-[#050912] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="rounded-2xl border border-white/10 bg-[#07111c]/95 px-4 py-4 shadow-xl sm:px-6 sm:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
            RoofRay Solar Site Analysis
          </p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Your location, roof & sun path</h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            {satellite
              ? "Real satellite imagery centered on your GPS location with deterministic RoofRay overlays. Green is your house, blue is nearby buildings and yellow is the calculated sun path."
              : "Satellite imagery is unavailable right now, so RoofRay is showing a planning visualization. Green is your house, blue is nearby buildings and yellow is the calculated sun path."}
          </p>
        </header>

        <div className="relative isolate h-[clamp(340px,62vh,680px)] min-h-[340px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#12202a] shadow-2xl">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="RoofRay deterministic solar site visual"
      >
        <defs>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.45" />
          </filter>
          <clipPath id="targetRoofClip">
            <polygon points={targetPoints.map((p) => `${p.x},${p.y}`).join(" ")} />
          </clipPath>
          <linearGradient id="panelGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dff8ff" />
            <stop offset="45%" stopColor="#1675a5" />
            <stop offset="100%" stopColor="#071d31" />
          </linearGradient>
          <radialGradient id="vignette">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#02050a" stopOpacity="0.72" />
          </radialGradient>
        </defs>

        {satellite ? (
          <image href={satellite} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect width={W} height={H} fill="#12202a" />
            <path d={`M0 250 L1600 40 M0 650 L1600 430 M-200 900 L900 0 M500 900 L1600 300`} stroke="#28404b" strokeWidth="55" opacity="0.7" />
            <path d={`M0 260 L1600 50 M0 660 L1600 440 M-200 900 L900 0 M500 900 L1600 300`} stroke="#657a80" strokeWidth="7" opacity="0.55" />
            {Array.from({ length: 34 }).map((_, i) => (
              <rect
                key={`fallback-grid-${i}`}
                x={(i * 157) % W}
                y={(i * 71) % H}
                width={90 + (i % 4) * 18}
                height={50 + (i % 3) * 16}
                rx="5"
                fill={i % 2 ? "#344b4d" : "#273d43"}
                opacity="0.7"
              />
            ))}
          </>
        )}

        {mappedBuildings.map((building, index) => {
          const points = building.polygon.map((point) => projectPoint(point, location, W, H));
          if (points.length < 3) return null;
          const isTarget = building === target;
          return (
            <g key={`building-${index}`}>
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={isTarget ? "#18d98b" : "#2787ff"}
                fillOpacity={isTarget ? 0.38 : 0.22}
                stroke={isTarget ? "#29ff9d" : "#55a7ff"}
                strokeWidth={isTarget ? 7 : 4}
                filter={isTarget ? "url(#shadow)" : undefined}
              />
              {isTarget && (
                <g clipPath="url(#targetRoofClip)" opacity="0.94">
                  {Array.from({ length: Math.max(4, Math.min(10, Number.isFinite(panelCount) ? panelCount : 8)) }).map((_, panelIndex) => {
                    const cols = 4;
                    const rows = Math.ceil(Math.max(4, Math.min(10, Number.isFinite(panelCount) ? panelCount : 8)) / cols);
                    const cellW = 34;
                    const cellH = 25;
                    const totalW = cols * cellW + (cols - 1) * 7;
                    const totalH = rows * cellH + (rows - 1) * 7;
                    const px = targetCenter.x - totalW / 2 + (panelIndex % cols) * (cellW + 7);
                    const py = targetCenter.y - totalH / 2 + Math.floor(panelIndex / cols) * (cellH + 7);
                    return (
                      <rect
                        key={`panel-${panelIndex}`}
                        x={px}
                        y={py}
                        width={cellW}
                        height={cellH}
                        rx="2"
                        fill="url(#panelGradient)"
                        stroke="#d8f7ff"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}

        {sun.length >= 2 && (
          <>
            <polyline
              points={sunPath}
              fill="none"
              stroke="#ffd21a"
              strokeWidth="9"
              strokeDasharray="22 15"
              strokeLinecap="round"
              filter="url(#shadow)"
            />
            {sun.map((point) => (
              <g key={`sun-${point.index}`}>
                <circle cx={point.x} cy={point.y} r="13" fill="#ffd21a" stroke="#fff3a3" strokeWidth="4" />
                {point.showTime && point.time && (
                  <text x={point.x + 21} y={point.y - 16} fill="#fff4a3" fontSize="34" fontWeight="700">
                    {point.time}
                  </text>
                )}
              </g>
            ))}
          </>
        )}

        <circle cx={targetCenter.x} cy={targetCenter.y} r="7" fill="#ffffff" stroke="#20ff9a" strokeWidth="5" />
        <rect width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
      </svg>
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-[#07111c]/95 px-3 py-2.5 text-[11px] text-slate-200 shadow-xl backdrop-blur-xl sm:bottom-4 sm:left-4 sm:px-4 sm:py-3 sm:text-xs">
            <div className="font-semibold text-white">RoofRay visual</div>
            <div className="mt-1.5 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-400" />Your House</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" />Nearby Buildings</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Sun Path</div>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-[#050912]/90 text-sm font-semibold text-white shadow-lg sm:bottom-4 sm:right-4 sm:h-10 sm:w-10">
            N
          </div>
        </div>

        <section className="rounded-2xl border border-cyan-300/20 bg-[#07111c]/95 p-4 shadow-xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Live Solar Data</p>
              <p className="mt-1 text-xs text-slate-500">Location-based planning values</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${satellite ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${satellite ? "bg-emerald-400" : "bg-amber-400"}`} />
              {satellite ? "Satellite reference" : "Planning data"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Latitude", location.latitude.toFixed(6)],
              ["Longitude", location.longitude.toFixed(6)],
              ["Roof area", Number.isFinite(roofAreaSqFt) ? `${roofAreaSqFt.toFixed(0)} sq ft` : "--"],
              ["Panels", Number.isFinite(panelCount) ? String(panelCount) : "--"],
              ["Direction", direction],
              ["Tilt", `${slope}°`],
              ["Sunrise", sunrise],
              ["Solar noon", solarNoon],
              ["Sunset", sunset],
              ["Mapped roof", targetArea > 0 ? `${targetArea.toFixed(0)} m²` : "--"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3">
                <p className="text-[11px] text-slate-400">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-100 sm:text-[15px]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-slate-400">{status}</p>
            {error ? <p className="min-w-0 text-amber-200">{error}</p> : null}
            <p className="shrink-0 text-slate-500">GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>
          </div>
        </section>
      </div>
    </section>
  );
}
