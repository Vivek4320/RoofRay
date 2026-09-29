"use client";

import { useEffect, useRef, useState } from "react";

type Solar3DViewerProps = {
  latitude?: number | null;
  longitude?: number | null;
};

type CesiumLike = any;

function getStoredLocation(): { latitude: number; longitude: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const analysis = JSON.parse(
      sessionStorage.getItem("roofray_solar_analysis") || "null",
    );
    const location = analysis?.analysis?.planningEstimate?.location;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }

    const report = JSON.parse(
      sessionStorage.getItem("roofray_report_data") || "null",
    );
    const reportLocation =
      report?.solarContext?.planningEstimate?.location ??
      report?.solarContext?.location;
    const reportLat = Number(reportLocation?.latitude);
    const reportLon = Number(reportLocation?.longitude);
    if (Number.isFinite(reportLat) && Number.isFinite(reportLon)) {
      return { latitude: reportLat, longitude: reportLon };
    }
  } catch {
    // Ignore malformed session data.
  }
  return null;
}

function getStoredPlanningData() {
  if (typeof window === "undefined") return null;
  try {
    const analysis = JSON.parse(
      sessionStorage.getItem("roofray_solar_analysis") || "null",
    );
    return analysis?.analysis ?? null;
  } catch {
    return null;
  }
}

function loadCesium(): Promise<CesiumLike> {
  const win = window as typeof window & { Cesium?: CesiumLike };
  if (win.Cesium) return Promise.resolve(win.Cesium);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-roofray-cesium="true"]',
    ) as HTMLScriptElement | null;

    const finish = () => {
      if (win.Cesium) resolve(win.Cesium);
      else reject(new Error("CesiumJS loaded but the Cesium global is unavailable."));
    };

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("CesiumJS could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cesium.com/downloads/cesiumjs/releases/1.145/Build/Cesium/Cesium.js";
    script.async = true;
    script.dataset.roofrayCesium = "true";
    script.onload = finish;
    script.onerror = () =>
      reject(new Error("CesiumJS could not be loaded from Cesium."));
    document.head.appendChild(script);
  });
}

function ensureCesiumCss() {
  if (document.querySelector('link[data-roofray-cesium-css="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://cesium.com/downloads/cesiumjs/releases/1.145/Build/Cesium/Widgets/widgets.css";
  link.dataset.roofrayCesiumCss = "true";
  document.head.appendChild(link);
}

function addSolarOverlays(
  Cesium: CesiumLike,
  viewer: CesiumLike,
  latitude: number,
  longitude: number,
  analysis: any,
) {
  const planning = analysis?.planningEstimate ?? {};
  const roofAreaM2 = Number(planning.roofAreaM2);
  const panelCount = Math.max(1, Math.round(Number(planning.panelCount) || 1));
  const panelPowerW = Math.round(Number(planning.panelPowerW) || 450);

  const metersPerLat = 111320;
  const metersPerLon = Math.max(1, 111320 * Math.cos(Cesium.Math.toRadians(latitude)));
  const roofArea = Number.isFinite(roofAreaM2) && roofAreaM2 > 0 ? roofAreaM2 : 40;
  const roofWidth = Math.max(4, Math.sqrt(roofArea) * 1.35);
  const roofDepth = Math.max(3, roofArea / roofWidth);

  const halfWidth = roofWidth / 2;
  const halfDepth = roofDepth / 2;

  const offsetPosition = (east: number, north: number, height: number) =>
    Cesium.Cartesian3.fromDegrees(
      longitude + east / metersPerLon,
      latitude + north / metersPerLat,
      height,
    );

  const roofCorners = [
    offsetPosition(-halfWidth, -halfDepth, 8),
    offsetPosition(halfWidth, -halfDepth, 8),
    offsetPosition(halfWidth, halfDepth, 8),
    offsetPosition(-halfWidth, halfDepth, 8),
  ];

  viewer.entities.add({
    name: "RoofRay detected roof area",
    polygon: {
      hierarchy: roofCorners,
      material: Cesium.Color.CYAN.withAlpha(0.18),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      height: 8,
    },
    label: {
      text: "Your roof",
      font: "600 14px sans-serif",
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString("#07111ccc"),
      pixelOffset: new Cesium.Cartesian2(0, -24),
    },
  });

  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(panelCount))));
  const rows = Math.ceil(panelCount / columns);
  const gap = 0.22;
  const panelWidth = Math.max(
    1.25,
    (roofWidth * 0.78 - gap * (columns - 1)) / columns,
  );
  const panelDepth = Math.max(
    0.75,
    (roofDepth * 0.7 - gap * (rows - 1)) / rows,
  );

  for (let index = 0; index < panelCount; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const east =
      -((columns - 1) * (panelWidth + gap)) / 2 +
      col * (panelWidth + gap);
    const north =
      ((rows - 1) * (panelDepth + gap)) / 2 -
      row * (panelDepth + gap);

    const p1 = offsetPosition(
      east - panelWidth / 2,
      north - panelDepth / 2,
      8.35,
    );
    const p2 = offsetPosition(
      east + panelWidth / 2,
      north - panelDepth / 2,
      8.35,
    );
    const p3 = offsetPosition(
      east + panelWidth / 2,
      north + panelDepth / 2,
      8.35,
    );
    const p4 = offsetPosition(
      east - panelWidth / 2,
      north + panelDepth / 2,
      8.35,
    );

    viewer.entities.add({
      name: `Solar panel ${index + 1}`,
      polygon: {
        hierarchy: [p1, p2, p3, p4],
        material: Cesium.Color.fromCssColorString("#123d78").withAlpha(0.95),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#67c7ff"),
        height: 8.35,
      },
      description: `${panelPowerW} W solar panel — RoofRay planning overlay`,
    });
  }

  viewer.entities.add({
    position: offsetPosition(0, 0, 13),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString("#38bdf8"),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: "RoofRay • target location",
      font: "600 13px sans-serif",
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString("#07111cdd"),
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  const sunSamples = Array.isArray(analysis?.sunCycle?.next12Hours)
    ? analysis.sunCycle.next12Hours
    : [];

  const sunPositions: any[] = [];
  for (const sample of sunSamples) {
    const azimuth = Number(sample.azimuthDeg);
    const elevation = Number(sample.elevationDeg);
    if (!Number.isFinite(azimuth) || !Number.isFinite(elevation)) continue;

    const radius = 110;
    const horizontal = Math.max(20, radius * Math.cos(Cesium.Math.toRadians(elevation)));
    const az = Cesium.Math.toRadians(azimuth);
    const east = Math.sin(az) * horizontal;
    const north = Math.cos(az) * horizontal;
    const height = 35 + Math.max(0, elevation) * 5;
    sunPositions.push(offsetPosition(east, north, height));
  }

  if (sunPositions.length >= 2) {
    viewer.entities.add({
      name: "RoofRay sun path",
      polyline: {
        positions: sunPositions,
        width: 4,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString("#fbbf24"),
          dashLength: 14,
        }),
        clampToGround: false,
      },
    });

    const first = sunPositions[0];
    const last = sunPositions[sunPositions.length - 1];
    for (const [position, text] of [
      [first, "Sun path start"],
      [last, "Sun path / later"],
    ] as const) {
      viewer.entities.add({
        position,
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString("#fbbf24"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text,
          font: "600 12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#07111cdd"),
          pixelOffset: new Cesium.Cartesian2(10, -8),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }
}

export default function Solar3DViewer({
  latitude,
  longitude,
}: Solar3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<CesiumLike | null>(null);
  const [status, setStatus] = useState("Loading 3D solar site...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stored = getStoredLocation();
        const lat = Number.isFinite(Number(latitude))
          ? Number(latitude)
          : stored?.latitude;
        const lon = Number.isFinite(Number(longitude))
          ? Number(longitude)
          : stored?.longitude;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error(
            "No analyzed location was found. Complete RoofRay location analysis first.",
          );
        }

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (!token) {
          throw new Error(
            "Cesium ion token is missing. Add NEXT_PUBLIC_CESIUM_ION_TOKEN to your environment.",
          );
        }

        ensureCesiumCss();
        const Cesium = await loadCesium();
        if (cancelled || !containerRef.current) return;

        Cesium.Ion.defaultAccessToken = token;

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrain: Cesium.Terrain.fromWorldTerrain(),
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          baseLayerPicker: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: true,
        });

        viewerRef.current = viewer;

        const imageryProvider = await Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL,
        });
        viewer.imageryLayers.addImageryProvider(imageryProvider);

        const buildings = await Cesium.createOsmBuildingsAsync({
          scene: viewer.scene,
          showOutline: true,
        });
        viewer.scene.primitives.add(buildings);

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 360),
          orientation: {
            heading: Cesium.Math.toRadians(25),
            pitch: Cesium.Math.toRadians(-48),
            roll: 0,
          },
          duration: 2.2,
        });

        const analysis = getStoredPlanningData();
        addSolarOverlays(Cesium, viewer, lat, lon, analysis);

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.sunBloom = true;

        setStatus("3D solar site ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load the 3D site.");
        setStatus("");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current = viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, [latitude, longitude]);

  return (
    <section className="relative h-[calc(100vh-64px)] min-h-[620px] w-full overflow-hidden bg-[#050912]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#07111c]/85 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          RoofRay 3D Solar Site
        </p>
        <h1 className="mt-1 text-lg font-semibold">
          Real aerial imagery + 3D buildings
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          Cesium 3D terrain, OSM building geometry and RoofRay solar overlays.
          The blue panels and yellow sun path are analysis overlays, not source imagery.
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-xl border border-white/10 bg-[#07111c]/85 px-4 py-3 text-xs text-slate-200 backdrop-blur-xl">
        {status || error}
      </div>

      <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-2xl border border-white/10 bg-[#07111c]/85 px-4 py-4 text-xs text-slate-200 backdrop-blur-xl">
        <div className="font-semibold text-white">Solar overlay</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
          Target roof
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          PV panels
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Sun path
        </div>
      </div>
    </section>
  );
}
