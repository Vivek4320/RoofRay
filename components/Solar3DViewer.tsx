"use client";

import { useEffect, useRef, useState } from "react";

type Solar3DViewerProps = {
  latitude?: number | null;
  longitude?: number | null;
};

type MapLibreLike = any;

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

function loadMapLibre(): Promise<MapLibreLike> {
  const win = window as typeof window & { maplibregl?: MapLibreLike };
  if (win.maplibregl) return Promise.resolve(win.maplibregl);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-roofray-maplibre="true"]',
    ) as HTMLScriptElement | null;

    const finish = () => {
      if (win.maplibregl) resolve(win.maplibregl);
      else reject(new Error("MapLibre loaded but the map engine is unavailable."));
    };

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("MapLibre could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.7.0/dist/maplibre-gl.js";
    script.async = true;
    script.dataset.roofrayMaplibre = "true";
    script.onload = finish;
    script.onerror = () => reject(new Error("MapLibre could not be loaded."));
    document.head.appendChild(script);
  });
}

function ensureMapLibreCss() {
  if (document.querySelector('link[data-roofray-maplibre-css="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@5.7.0/dist/maplibre-gl.css";
  link.dataset.roofrayMaplibreCss = "true";
  document.head.appendChild(link);
}

async function getBuildings(latitude: number, longitude: number) {
  const response = await fetch(
    "/api/map-buildings?latitude=" +
      encodeURIComponent(latitude) +
      "&longitude=" +
      encodeURIComponent(longitude) +
      "&radius=180",
    { cache: "no-store" },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !Array.isArray(data.buildings)) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Building map data could not be loaded.",
    );
  }

  return {
    type: "FeatureCollection",
    features: data.buildings.map((building: any, index: number) => ({
      type: "Feature",
      id: index,
      properties: {
        height: Math.max(3, Number(building.heightMeters) || 3),
        target: building.containsTarget === true,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          building.polygon.map((point: any) => [
            Number(point.longitude),
            Number(point.latitude),
          ]),
        ],
      },
    })),
  };
}

function addSolarOverlays(map: MapLibreLike, latitude: number, longitude: number, analysis: any) {
  const planning = analysis?.planningEstimate ?? {};
  const roof = analysis?.roof?.polygon;
  const roofCoordinates =
    Array.isArray(roof) && roof.length >= 3
      ? roof.map((point: any) => [Number(point.longitude), Number(point.latitude)])
      : [];

  if (map.getSource("roofray-roof")) {
    map.removeLayer("roofray-roof-fill");
    map.removeLayer("roofray-roof-line");
    map.removeSource("roofray-roof");
  }

  if (roofCoordinates.length >= 3) {
    const closed = [...roofCoordinates, roofCoordinates[0]];
    map.addSource("roofray-roof", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [closed] },
      },
    });
    map.addLayer({
      id: "roofray-roof-fill",
      type: "fill",
      source: "roofray-roof",
      paint: { "fill-color": "#22d3ee", "fill-opacity": 0.18 },
    });
    map.addLayer({
      id: "roofray-roof-line",
      type: "line",
      source: "roofray-roof",
      paint: { "line-color": "#22d3ee", "line-width": 4 },
    });
  }

  if (map.getSource("roofray-sun")) {
    map.removeLayer("roofray-sun-line");
    map.removeLayer("roofray-sun-points");
    map.removeSource("roofray-sun");
  }

  const samples = Array.isArray(analysis?.sunCycle?.next12Hours)
    ? analysis.sunCycle.next12Hours
    : [];
  const sunCoordinates = samples
    .filter(
      (sample: any) =>
        Number.isFinite(Number(sample.azimuthDeg)) &&
        Number.isFinite(Number(sample.elevationDeg)),
    )
    .slice(0, 10)
    .map((sample: any) => {
      const az = (Number(sample.azimuthDeg) * Math.PI) / 180;
      const elevation = Math.max(20, Number(sample.elevationDeg) || 20);
      const radius = 0.0008 * Math.max(0.45, Math.cos((elevation * Math.PI) / 180));
      const east = Math.sin(az) * radius;
      const north = Math.cos(az) * radius;
      return [longitude + east, latitude + north];
    });

  if (sunCoordinates.length >= 2) {
    map.addSource("roofray-sun", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: sunCoordinates },
          },
        ],
      },
    });
    map.addLayer({
      id: "roofray-sun-line",
      type: "line",
      source: "roofray-sun",
      paint: {
        "line-color": "#fbbf24",
        "line-width": 4,
        "line-dasharray": [2, 2],
      },
    });
    map.addLayer({
      id: "roofray-sun-points",
      type: "circle",
      source: "roofray-sun",
      paint: {
        "circle-radius": 7,
        "circle-color": "#fbbf24",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  const panelCount = Math.max(0, Math.min(40, Math.round(Number(planning.panelCount) || 0)));
  if (panelCount > 0 && roofCoordinates.length >= 3) {
    if (map.getSource("roofray-panels")) {
      if (map.getLayer("roofray-panels-fill")) map.removeLayer("roofray-panels-fill");
      if (map.getLayer("roofray-panels-line")) map.removeLayer("roofray-panels-line");
      map.removeSource("roofray-panels");
    }

    const lons = roofCoordinates.map((p: number[]) => p[0]);
    const lats = roofCoordinates.map((p: number[]) => p[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(panelCount))));
    const rows = Math.ceil(panelCount / cols);
    const cellLon = (maxLon - minLon) * 0.68 / cols;
    const cellLat = (maxLat - minLat) * 0.68 / rows;
    const gapLon = cellLon * 0.08;
    const gapLat = cellLat * 0.08;
    const features: any[] = [];

    for (let i = 0; i < panelCount; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const centerLon = minLon + (maxLon - minLon) * 0.16 + col * cellLon;
      const centerLat = maxLat - (maxLat - minLat) * 0.16 - row * cellLat;
      const w = Math.max(0.00001, cellLon - gapLon);
      const h = Math.max(0.00001, cellLat - gapLat);
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[
            [centerLon, centerLat],
            [centerLon + w, centerLat],
            [centerLon + w, centerLat - h],
            [centerLon, centerLat - h],
            [centerLon, centerLat],
          ]],
        },
      });
    }

    map.addSource("roofray-panels", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });
    map.addLayer({
      id: "roofray-panels-fill",
      type: "fill",
      source: "roofray-panels",
      paint: { "fill-color": "#164e9a", "fill-opacity": 0.92 },
    });
    map.addLayer({
      id: "roofray-panels-line",
      type: "line",
      source: "roofray-panels",
      paint: { "line-color": "#7dd3fc", "line-width": 1.5 },
    });
  }
}

export default function Solar3DViewer({ latitude, longitude }: Solar3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreLike | null>(null);
  const pinModeRef = useRef(false);
  const [status, setStatus] = useState("Loading satellite map...");
  const [error, setError] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [pinStatus, setPinStatus] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    pinModeRef.current = pinMode;
  }, [pinMode]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stored = readStoredLocation();
        const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : stored?.latitude;
        const lon = Number.isFinite(Number(longitude)) ? Number(longitude) : stored?.longitude;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error("No location found. Return to RoofRay and complete location analysis first.");
        }

        ensureMapLibreCss();
        const maplibregl = await loadMapLibre();
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              satellite: {
                type: "raster",
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution: "Esri World Imagery",
              },
            },
            layers: [
              {
                id: "satellite",
                type: "raster",
                source: "satellite",
              },
            ],
          },
          center: [lon, lat],
          zoom: 19,
          pitch: 52,
          bearing: 15,
          maxZoom: 21,
          attributionControl: true,
        });

        mapRef.current = map;

        map.on("error", (event: any) => {
          console.warn("[RoofRay] MapLibre error:", event?.error || event);
          setError(
            event?.error?.message
              ? "Satellite map error: " + event.error.message
              : "Satellite imagery could not be loaded.",
          );
        });

        map.on("load", async () => {
          if (cancelled) return;

          try {
            const buildings = await getBuildings(lat, lon);
            if (!map.getSource("buildings")) {
              map.addSource("buildings", { type: "geojson", data: buildings });
              map.addLayer({
                id: "buildings-3d",
                type: "fill-extrusion",
                source: "buildings",
                paint: {
                  "fill-extrusion-color": [
                    "case",
                    ["get", "target"],
                    "#22d3ee",
                    "#64748b",
                  ],
                  "fill-extrusion-height": ["get", "height"],
                  "fill-extrusion-base": 0,
                  "fill-extrusion-opacity": 0.62,
                },
              });
            }

            const analysis = readStoredAnalysis();
            addSolarOverlays(map, lat, lon, analysis);

            new maplibregl.Marker({ color: "#22d3ee" })
              .setLngLat([lon, lat])
              .setPopup(
                new maplibregl.Popup({ offset: 20 }).setHTML(
                  "<strong>RoofRay location</strong><br/>" +
                    lat.toFixed(6) +
                    ", " +
                    lon.toFixed(6),
                ),
              )
              .addTo(map);

            setStatus("Real satellite imagery loaded. Drag, zoom, rotate and tilt.");
          } catch (buildingError) {
            console.warn("[RoofRay] Building/overlay load failed:", buildingError);
            setStatus("Satellite map loaded. Building data is unavailable at this location.");
          }
        });

        map.on("click", async (event: any) => {
          if (!pinModeRef.current) return;

          const pickedLon = Number(event.lngLat.lng);
          const pickedLat = Number(event.lngLat.lat);
          setPinStatus(
            "Pinned " +
              pickedLat.toFixed(6) +
              ", " +
              pickedLon.toFixed(6) +
              " — checking this house...",
          );

          try {
            const analysis = readStoredAnalysis();
            const roofAreaSqFt = Number(analysis?.planningEstimate?.roofAreaSqFt);
            const response = await fetch("/api/solar-analysis", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: pickedLat,
                longitude: pickedLon,
                peakPowerKw: 1,
                ...(Number.isFinite(roofAreaSqFt)
                  ? { roofAreaM2: roofAreaSqFt * 0.092903 }
                  : {}),
                obstacleRadiusMeters: 500,
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok || !data.analysis) {
              throw new Error(
                typeof data.error === "string"
                  ? data.error
                  : "Solar analysis failed for the selected house.",
              );
            }

            const serialized = JSON.stringify(data.analysis);
            sessionStorage.setItem("roofray_solar_analysis", serialized);
            localStorage.setItem("roofray_solar_analysis", serialized);

            try {
              const raw =
                sessionStorage.getItem("roofray_report_data") ||
                localStorage.getItem("roofray_report_data");
              if (raw) {
                const report = JSON.parse(raw);
                report.solarContext = data.analysis;
                report.generatedAt = Date.now();
                const next = JSON.stringify(report);
                sessionStorage.setItem("roofray_report_data", next);
                localStorage.setItem("roofray_report_data", next);
                window.dispatchEvent(new Event("roofray_report_ready"));
              }
            } catch {}

            map.flyTo({
              center: [pickedLon, pickedLat],
              zoom: 19,
              pitch: 58,
              bearing: 20,
              duration: 1200,
            });

            // Reload mapped buildings and all solar overlays at the selected point.
            if (map.getLayer("buildings-3d")) map.removeLayer("buildings-3d");
            if (map.getSource("buildings")) map.removeSource("buildings");
            const buildings = await getBuildings(pickedLat, pickedLon);
            map.addSource("buildings", { type: "geojson", data: buildings });
            map.addLayer({
              id: "buildings-3d",
              type: "fill-extrusion",
              source: "buildings",
              paint: {
                "fill-extrusion-color": [
                  "case",
                  ["get", "target"],
                  "#22d3ee",
                  "#64748b",
                ],
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-opacity": 0.62,
              },
            });

            addSolarOverlays(map, pickedLat, pickedLon, data.analysis);
            setPinMode(false);
            pinModeRef.current = false;
            setPinStatus("House selected. Solar analysis updated.");
            setError("");
          } catch (pinError) {
            setPinStatus(
              pinError instanceof Error
                ? pinError.message
                : "Unable to analyze the selected house.",
            );
          }
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load the map.");
        setStatus("");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => {
    const stored = readStoredLocation();
    if (!stored || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [stored.longitude, stored.latitude],
      zoom: 18,
      pitch: 52,
      bearing: 15,
      duration: 900,
    });
  };

  return (
    <section className="relative h-[calc(100vh-64px)] min-h-[620px] w-full overflow-hidden bg-[#050912]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#07111c]/90 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          RoofRay 3D Roof View
        </p>
        <h1 className="mt-1 text-lg font-semibold">See your actual house on satellite</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          Real aerial imagery with mapped OpenStreetMap buildings. Click “Set house”
          and select your exact roof if browser location is inaccurate.
        </p>
      </div>

      <div className="absolute right-5 top-5 z-10 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#07111c]/90 shadow-xl backdrop-blur-xl">
        <button type="button" onClick={zoomIn} className="h-11 w-11 text-lg font-semibold text-white hover:bg-white/10">+</button>
        <button type="button" onClick={zoomOut} className="h-11 w-11 border-t border-white/10 text-lg font-semibold text-white hover:bg-white/10">−</button>
        <button type="button" onClick={resetView} className="border-t border-white/10 px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-white/10">My roof</button>
        <button
          type="button"
          onClick={() => {
            setPinMode((value) => !value);
            setPinStatus("");
          }}
          className={
            "border-t border-white/10 px-3 py-2 text-[10px] font-semibold " +
            (pinMode ? "bg-cyan-400/20 text-cyan-100" : "text-slate-200 hover:bg-white/10")
          }
        >
          {pinMode ? "Click your roof" : "Set house"}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 max-w-lg rounded-xl border border-white/10 bg-[#07111c]/90 px-4 py-3 text-xs text-slate-200 backdrop-blur-xl">
        <div>{pinStatus || status || error}</div>
        {error && (
          <div className="mt-1 text-[10px] text-amber-200">
            If browser location is inaccurate, enable Precise Location or use “Set house”.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-2xl border border-white/10 bg-[#07111c]/90 px-4 py-4 text-xs text-slate-200 backdrop-blur-xl">
        <div className="font-semibold text-white">RoofRay overlay</div>
        <div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />Mapped building</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Solar panels</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Sun path</div>
      </div>
    </section>
  );
}
