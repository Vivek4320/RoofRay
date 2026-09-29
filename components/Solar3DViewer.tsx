"use client";

import { useEffect, useRef, useState } from "react";

type Solar3DViewerProps = {
  latitude?: number | null;
  longitude?: number | null;
};

type CesiumLike = any;

type RoofPoint = {
  latitude: number;
  longitude: number;
};

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

function getRoofPoints(analysis: any): RoofPoint[] {
  const points = analysis?.roof?.polygon;
  if (!Array.isArray(points)) return [];

  return points
    .map((point: any) => ({
      latitude: Number(point?.latitude),
      longitude: Number(point?.longitude),
    }))
    .filter(
      (point: RoofPoint) =>
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
    );
}

function toLocal(
  point: RoofPoint,
  centerLat: number,
  centerLon: number,
) {
  const metersPerLat = 111320;
  const metersPerLon = Math.max(
    1,
    111320 * Math.cos((centerLat * Math.PI) / 180),
  );
  return {
    east: (point.longitude - centerLon) * metersPerLon,
    north: (point.latitude - centerLat) * metersPerLat,
  };
}

function pointInsidePolygon(
  point: { east: number; north: number },
  polygon: Array<{ east: number; north: number }>,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].east;
    const yi = polygon[i].north;
    const xj = polygon[j].east;
    const yj = polygon[j].north;
    const intersects =
      yi > point.north !== yj > point.north &&
      point.east < ((xj - xi) * (point.north - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function addSolarOverlays(
  Cesium: CesiumLike,
  viewer: CesiumLike,
  latitude: number,
  longitude: number,
  analysis: any,
) {
  const planning = analysis?.planningEstimate ?? {};
  const roofPoints = getRoofPoints(analysis);
  const roofLocal = roofPoints.map((point) => toLocal(point, latitude, longitude));
  const panelCount = Math.max(1, Math.round(Number(planning.panelCount) || 1));
  const panelPowerW = Math.round(Number(planning.panelPowerW) || 450);
  const heightReference =
    Cesium.HeightReference?.CLAMP_TO_3D_TILE ??
    Cesium.HeightReference?.CLAMP_TO_GROUND;

  const targetPoint = Cesium.Cartesian3.fromDegrees(longitude, latitude, 1);

  if (roofPoints.length >= 3) {
    const roofHierarchy = roofPoints.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 0.5),
    );

    viewer.entities.add({
      name: "RoofRay mapped building footprint",
      polygon: {
        hierarchy: roofHierarchy,
        material: Cesium.Color.CYAN.withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        height: 0,
        heightReference,
      },
      label: {
        text: "Mapped building",
        font: "600 13px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#07111ccc"),
        pixelOffset: new Cesium.Cartesian2(0, -22),
        heightReference,
      },
    });

    const xs = roofLocal.map((point) => point.east);
    const ys = roofLocal.map((point) => point.north);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(3, maxX - minX);
    const depth = Math.max(3, maxY - minY);

    const columns = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(panelCount))));
    const rows = Math.max(1, Math.ceil(panelCount / columns));
    const gap = Math.max(0.18, Math.min(0.55, Math.min(width, depth) * 0.025));
    const panelWidth = Math.max(
      0.7,
      Math.min(2.4, (width * 0.72 - gap * (columns - 1)) / columns),
    );
    const panelDepth = Math.max(
      0.55,
      Math.min(2.0, (depth * 0.62 - gap * (rows - 1)) / rows),
    );

    let placed = 0;
    for (let row = 0; row < rows && placed < panelCount; row += 1) {
      for (let col = 0; col < columns && placed < panelCount; col += 1) {
        const east =
          minX +
          width * 0.14 +
          panelWidth / 2 +
          col * (panelWidth + gap);
        const north =
          maxY -
          depth * 0.19 -
          panelDepth / 2 -
          row * (panelDepth + gap);

        const corners = [
          { east: east - panelWidth / 2, north: north - panelDepth / 2 },
          { east: east + panelWidth / 2, north: north - panelDepth / 2 },
          { east: east + panelWidth / 2, north: north + panelDepth / 2 },
          { east: east - panelWidth / 2, north: north + panelDepth / 2 },
        ];

        if (!corners.every((corner) => pointInsidePolygon(corner, roofLocal))) {
          continue;
        }

        const panelPoints = corners.map((corner) =>
          Cesium.Cartesian3.fromDegrees(
            longitude +
              corner.east /
                Math.max(1, 111320 * Math.cos((latitude * Math.PI) / 180)),
            latitude + corner.north / 111320,
            0.45,
          ),
        );

        viewer.entities.add({
          name: `Solar panel ${placed + 1}`,
          polygon: {
            hierarchy: panelPoints,
            material: Cesium.Color.fromCssColorString("#123d78").withAlpha(0.94),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#67c7ff"),
            height: 0.45,
            heightReference,
          },
          description: `${panelPowerW} W solar panel — placed inside the mapped building footprint`,
        });

        placed += 1;
      }
    }

    viewer.entities.add({
      position: targetPoint,
      point: {
        pixelSize: 9,
        color: Cesium.Color.fromCssColorString("#38bdf8"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: "Your location",
        font: "600 13px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#07111cdd"),
        pixelOffset: new Cesium.Cartesian2(10, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  } else {
    viewer.entities.add({
      position: targetPoint,
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString("#38bdf8"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: "Building footprint not mapped — exact roof overlay unavailable",
        font: "600 12px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#07111cdd"),
        pixelOffset: new Cesium.Cartesian2(10, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  const sunSamples = Array.isArray(analysis?.sunCycle?.next12Hours)
    ? analysis.sunCycle.next12Hours
    : [];

  const sunPositions: any[] = [];
  for (const sample of sunSamples) {
    const azimuth = Number(sample.azimuthDeg);
    const elevation = Number(sample.elevationDeg);
    if (!Number.isFinite(azimuth) || !Number.isFinite(elevation)) continue;

    const radius = 85;
    const horizontal = Math.max(
      18,
      radius * Math.cos(Cesium.Math.toRadians(elevation)),
    );
    const az = Cesium.Math.toRadians(azimuth);
    const east = Math.sin(az) * horizontal;
    const north = Math.cos(az) * horizontal;
    const height = 25 + Math.max(0, elevation) * 4;
    sunPositions.push(
      Cesium.Cartesian3.fromDegrees(
        longitude +
          east /
            Math.max(1, 111320 * Math.cos((latitude * Math.PI) / 180)),
        latitude + north / 111320,
        height,
      ),
    );
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
      [last, "Sun path later"],
    ] as const) {
      viewer.entities.add({
        position,
        point: {
          pixelSize: 13,
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
  const [status, setStatus] = useState("Loading real satellite + 3D buildings...");
  const [error, setError] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [pinStatus, setPinStatus] = useState("");

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

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim();

        ensureCesiumCss();
        const Cesium = await loadCesium();
        if (cancelled || !containerRef.current) return;

        if (token) Cesium.Ion.defaultAccessToken = token;

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,
          terrain: token
            ? await Cesium.Terrain.fromWorldTerrain()
            : new Cesium.EllipsoidTerrainProvider(),
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

        // Use Cesium ion imagery when available, but keep the map working
        // without a token by falling back to Esri World Imagery.
        try {
          if (token) {
            const imageryProvider = await Cesium.createWorldImageryAsync({
              style: Cesium.IonWorldImageryStyle.AERIAL,
            });
            viewer.imageryLayers.addImageryProvider(imageryProvider);
          } else {
            viewer.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                credit: "Esri World Imagery",
                maximumLevel: 19,
              }),
            );
          }
        } catch (imageryError) {
          console.warn("[RoofRay] Cesium imagery failed, using Esri fallback:", imageryError);
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              credit: "Esri World Imagery",
              maximumLevel: 19,
            }),
          );
        }

        // OSM Buildings are an ion asset. If the token is absent/invalid,
        // keep the aerial map usable instead of failing the whole 3D viewer.
        if (token) {
          try {
            const buildings = await Cesium.createOsmBuildingsAsync({
              scene: viewer.scene,
              showOutline: true,
            });
            viewer.scene.primitives.add(buildings);
          } catch (buildingError) {
            console.warn("[RoofRay] OSM 3D buildings unavailable:", buildingError);
          }
        }

        const analysis = getStoredPlanningData();
        const roofPoints = getRoofPoints(analysis);
        const focusLat =
          roofPoints.length >= 3
            ? roofPoints.reduce((sum, point) => sum + point.latitude, 0) /
              roofPoints.length
            : lat;
        const focusLon =
          roofPoints.length >= 3
            ? roofPoints.reduce((sum, point) => sum + point.longitude, 0) /
              roofPoints.length
            : lon;

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(focusLon, focusLat, 180),
          orientation: {
            heading: Cesium.Math.toRadians(15),
            pitch: Cesium.Math.toRadians(-52),
            roll: 0,
          },
          duration: 2.2,
        });

        addSolarOverlays(Cesium, viewer, lat, lon, analysis);

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.sunBloom = true;

        const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction(async (movement: any) => {
          if (!pinMode) return;

          let cartesian = viewer.scene.pickPositionSupported
            ? viewer.scene.pickPosition(movement.position)
            : null;
          if (!cartesian) {
            cartesian = viewer.camera.pickEllipsoid(
              movement.position,
              viewer.scene.globe.ellipsoid,
            );
          }
          if (!cartesian) {
            setPinStatus("Tap directly on the roof/map again.");
            return;
          }

          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const pickedLat = Cesium.Math.toDegrees(cartographic.latitude);
          const pickedLon = Cesium.Math.toDegrees(cartographic.longitude);
          setPinStatus(
            "Pinned " + pickedLat.toFixed(6) + ", " + pickedLon.toFixed(6) + " — analyzing roof...",
          );

          try {
            const roofAreaSqFt = Number(analysis?.planningEstimate?.roofAreaSqFt);
            const response = await fetch("/api/solar-analysis", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: pickedLat,
                longitude: pickedLon,
                peakPowerKw: 1,
                ...(Number.isFinite(roofAreaSqFt) ? { roofAreaM2: roofAreaSqFt * 0.092903 } : {}),
                obstacleRadiusMeters: 500,
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok || !data.analysis) {
              throw new Error(
                typeof data.error === "string"
                  ? data.error
                  : "Solar analysis failed for the pinned location.",
              );
            }

            const serialized = JSON.stringify(data.analysis);
            sessionStorage.setItem("roofray_solar_analysis", serialized);
            localStorage.setItem("roofray_solar_analysis", serialized);
            viewer.entities.removeAll();
            addSolarOverlays(Cesium, viewer, pickedLat, pickedLon, data.analysis);
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(pickedLon, pickedLat, 120),
              orientation: {
                heading: Cesium.Math.toRadians(15),
                pitch: Cesium.Math.toRadians(-55),
                roll: 0,
              },
              duration: 1.4,
            });
            setPinMode(false);
            setPinStatus("Exact house point saved. Roof analysis updated.");
            setError("");
          } catch (pinError) {
            setPinStatus(
              pinError instanceof Error ? pinError.message : "Unable to analyze pinned location.",
            );
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        setStatus(
          roofPoints.length >= 3
            ? "Your mapped building is centered — zoom, drag, tilt and rotate the map."
            : token
              ? "Location centered — exact building footprint is not mapped here."
              : "Aerial map loaded. Add a Cesium ion token for 3D OSM buildings.",
        );

        if (!token) {
          setError("Cesium ion token not configured: aerial map works, but 3D OSM buildings are unavailable.");
        }

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

  const zoomIn = () => viewerRef.current?.camera.zoomIn(35);
  const zoomOut = () => viewerRef.current?.camera.zoomOut(35);
  const resetView = () => {
    const stored = getStoredLocation();
    if (!stored || !viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: (window as any).Cesium.Cartesian3.fromDegrees(
        stored.longitude,
        stored.latitude,
        180,
      ),
      orientation: {
        heading: (window as any).Cesium.Math.toRadians(15),
        pitch: (window as any).Cesium.Math.toRadians(-52),
        roll: 0,
      },
      duration: 1.2,
    });
  };

  return (
    <section className="relative h-[calc(100vh-64px)] min-h-[620px] w-full overflow-hidden bg-[#050912]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#07111c]/85 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          RoofRay 3D Roof View
        </p>
        <h1 className="mt-1 text-lg font-semibold">
          See your real location like a map
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          Real aerial imagery with 3D OpenStreetMap buildings. RoofRay only
          overlays the mapped building footprint, panels and sun path.
        </p>
      </div>

      <div className="absolute right-5 top-5 z-10 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#07111c]/90 shadow-xl backdrop-blur-xl">
        <button
          type="button"
          onClick={zoomIn}
          className="h-11 w-11 text-lg font-semibold text-white hover:bg-white/10"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="h-11 w-11 border-t border-white/10 text-lg font-semibold text-white hover:bg-white/10"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="border-t border-white/10 px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-white/10"
        >
          My roof
        </button>
        <button
          type="button"
          onClick={() => {
            setPinMode((value) => !value);
            setPinStatus("");
          }}
          className={"border-t border-white/10 px-3 py-2 text-[10px] font-semibold " +
            (pinMode ? "bg-cyan-400/20 text-cyan-100" : "text-slate-200 hover:bg-white/10")}
        >
          {pinMode ? "Click house" : "Set house"}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 max-w-md rounded-xl border border-white/10 bg-[#07111c]/85 px-4 py-3 text-xs text-slate-200 backdrop-blur-xl">
        <div>{pinStatus || status || error}</div>
        {error && (
          <div className="mt-1 text-[10px] text-amber-200">
            Tip: use “Set house” and click directly on your roof if desktop GPS is inaccurate.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-2xl border border-white/10 bg-[#07111c]/85 px-4 py-4 text-xs text-slate-200 backdrop-blur-xl">
        <div className="font-semibold text-white">RoofRay overlay</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
          Mapped building
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Solar panels
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Sun path
        </div>
      </div>
    </section>
  );
}
