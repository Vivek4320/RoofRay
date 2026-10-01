import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import { join } from "node:path";

type PdfBody = {
  report?: unknown;
  solarContext?: Record<string, unknown> | null;
  userInputs?: Record<string, unknown> | null;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[^ -~]/g, "")
    .replace(/[()\\]/g, (char) => "\\" + char);
}

function wrap(value: unknown, width = 88): string[] {
  const source = text(value).replace(/\s+/g, " ").trim();
  if (!source) return [];
  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validCoordinate(value: unknown, min: number, max: number): number | null {
  const n = numberValue(value);
  return n !== null && n >= min && n <= max ? n : null;
}

function resolveReportLocation(
  context: Record<string, unknown>,
  planning: Record<string, unknown>,
): { latitude: number; longitude: number } | null {
  const candidates: Array<Record<string, unknown> | null | undefined> = [
    planning.location as Record<string, unknown> | undefined,
    context.location as Record<string, unknown> | undefined,
    context.roof as Record<string, unknown> | undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const latitude = validCoordinate(candidate.latitude, -90, 90);
    const longitude = validCoordinate(candidate.longitude, -180, 180);
    if (latitude === null || longitude === null) continue;
    if (latitude === 0 && longitude === 0) continue;
    return { latitude, longitude };
  }

  return null;
}

function reportNumber(report: string, pattern: RegExp): number | null {
  const match = report.match(pattern);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

type MappedBuilding = {
  polygon: Array<{ latitude: number; longitude: number }>;
  areaM2: number;
  containsTarget: boolean;
  distanceMeters: number;
  heightMeters: number;
  levels: number;
  source?: "osm" | "planning";
};

type SatelliteTile = {
  name: string;
  bytes: Uint8Array;
  x: number;
  y: number;
  w: number;
  h: number;
};

type RoofPhoto = {
  bytes: Uint8Array;
  width: number;
  height: number;
};


type LogoImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

function decodeRoofRayLogo(buffer: Uint8Array): LogoImage | null {
  try {
    if (buffer.length < 33) return null;
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < signature.length; i += 1) {
      if (buffer[i] !== signature[i]) return null;
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idat: Uint8Array[] = [];

    while (offset + 8 <= buffer.length) {
      const length =
        buffer[offset] * 0x1000000 +
        buffer[offset + 1] * 0x10000 +
        buffer[offset + 2] * 0x100 +
        buffer[offset + 3];
      const type = String.fromCharCode(
        buffer[offset + 4],
        buffer[offset + 5],
        buffer[offset + 6],
        buffer[offset + 7],
      );
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > buffer.length) return null;
      const data = buffer.subarray(dataStart, dataEnd);

      if (type === "IHDR" && length >= 13) {
        width = data[0] * 0x1000000 + data[1] * 0x10000 + data[2] * 0x100 + data[3];
        height = data[4] * 0x1000000 + data[5] * 0x10000 + data[6] * 0x100 + data[7];
        bitDepth = data[8];
        colorType = data[9];
      } else if (type === "IDAT") {
        idat.push(data);
      } else if (type === "IEND") {
        break;
      }
      offset = dataEnd + 4;
    }

    if (!width || !height || bitDepth !== 8 || !idat.length) return null;
    const channels =
      colorType === 6 ? 4 :
      colorType === 2 ? 3 :
      colorType === 4 ? 2 :
      colorType === 0 ? 1 : 0;
    if (!channels) return null;

    const filtered = inflateSync(Buffer.concat(idat.map((part) => Buffer.from(part))));
    const rowBytes = width * channels;
    if (filtered.length < (rowBytes + 1) * height) return null;
    const raw = new Uint8Array(rowBytes * height);

    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };

    for (let y = 0; y < height; y += 1) {
      const filter = filtered[y * (rowBytes + 1)];
      const srcStart = y * (rowBytes + 1) + 1;
      const dstStart = y * rowBytes;
      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= channels ? raw[dstStart + x - channels] : 0;
        const up = y > 0 ? raw[dstStart - rowBytes + x] : 0;
        const upLeft = y > 0 && x >= channels ? raw[dstStart - rowBytes + x - channels] : 0;
        const value = filtered[srcStart + x];
        raw[dstStart + x] =
          filter === 0 ? value :
          filter === 1 ? (value + left) & 255 :
          filter === 2 ? (value + up) & 255 :
          filter === 3 ? (value + Math.floor((left + up) / 2)) & 255 :
          filter === 4 ? (value + paeth(left, up, upLeft)) & 255 :
          value;
      }
    }

    const rgb = Buffer.alloc(width * height * 3);
    const bg = [4, 21, 43];
    let out = 0;
    for (let i = 0; i < width * height; i += 1) {
      const src = i * channels;
      let r = 0, g = 0, b = 0, a = 255;
      if (colorType === 6) {
        r = raw[src]; g = raw[src + 1]; b = raw[src + 2]; a = raw[src + 3];
      } else if (colorType === 2) {
        r = raw[src]; g = raw[src + 1]; b = raw[src + 2];
      } else if (colorType === 4) {
        r = g = b = raw[src]; a = raw[src + 1];
      } else {
        r = g = b = raw[src];
      }
      const alpha = a / 255;
      rgb[out++] = Math.round(r * alpha + bg[0] * (1 - alpha));
      rgb[out++] = Math.round(g * alpha + bg[1] * (1 - alpha));
      rgb[out++] = Math.round(b * alpha + bg[2] * (1 - alpha));
    }

    return { bytes: new Uint8Array(deflateSync(rgb)), width, height };
  } catch {
    return null;
  }
}

function decodeJpegDataUrl(dataUrl: unknown): RoofPhoto | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/jpeg;base64,")) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64"));
    if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof && segmentLength >= 7) {
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        if (width > 0 && height > 0) return { bytes, width, height };
      }
      offset += segmentLength;
    }
  } catch {}
  return null;
}

function webMercatorPixel(latitude: number, longitude: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const x = ((longitude + 180) / 360) * size;
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const y =
    (0.5 -
      Math.log((1 + sinLat) / Math.max(1e-12, 1 - sinLat)) /
        (4 * Math.PI)) *
    size;
  return { x, y, size };
}

function inverseWebMercatorPixel(x: number, y: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const longitude = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

async function fetchSatelliteTiles(
  latitude: number,
  longitude: number,
  zoom = 19,
): Promise<SatelliteTile[]> {
  // Fetch one complete World Imagery export. This is more reliable in PDFs
  // than embedding many cached tile JPEGs.
  const center = webMercatorPixel(latitude, longitude, zoom);
  const startX = Math.floor(center.x / 256) - 2;
  const startY = Math.floor(center.y / 256) - 1;
  const endX = startX + 4;
  const endY = startY + 3;
  const nw = inverseWebMercatorPixel(startX * 256, startY * 256, zoom);
  const se = inverseWebMercatorPixel(endX * 256, endY * 256, zoom);
  const bbox = [nw.longitude, se.latitude, se.longitude, nw.latitude].join(",");

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
        size: "1024,768",
        format: "jpg",
        f: "image",
        transparent: "false",
      });
      const response = await fetch(host + "?" + params.toString(), {
        cache: "no-store",
        headers: { Accept: "image/jpeg,image/*" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 5000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) continue;
      return [{ name: "ImSatSite", bytes, x: 0, y: 0, w: 1024, h: 768 }];
    } catch {
      // Try the next ArcGIS host.
    }
  }
  return [];
}
function pointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function planningBuildingFromRoofArea(
  roofAreaSqFt: number | null,
  latitude: number,
  longitude: number,
): MappedBuilding | null {
  if (roofAreaSqFt === null || roofAreaSqFt <= 0) return null;

  // Planning-only footprint used when OSM has no building polygon. It is
  // anchored to the real GPS coordinate and is never marked as "YOUR HOUSE".
  const areaM2 = roofAreaSqFt * 0.092903;
  const widthM = Math.max(6, Math.min(30, Math.sqrt(areaM2 / 1.45)));
  const lengthM = Math.max(8, Math.min(45, areaM2 / widthM));
  const mLat = 111320;
  const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
  const halfW = widthM / 2;
  const halfL = lengthM / 2;
  const points = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ];

  return {
    polygon: points.map((point) => ({
      latitude: latitude + point.y / mLat,
      longitude: longitude + point.x / mLon,
    })),
    areaM2,
    containsTarget: false,
    distanceMeters: 0,
    heightMeters: 4,
    levels: 1,
  };
}

function mappedBuildingFromRoofContext(
  roof: Record<string, unknown> | null,
  latitude: number,
  longitude: number,
): MappedBuilding | null {
  const polygon = Array.isArray(roof?.polygon)
    ? (roof.polygon as Array<Record<string, unknown>>)
        .map((point) => ({
          latitude: numberValue(point.latitude),
          longitude: numberValue(point.longitude),
        }))
        .filter(
          (point): point is { latitude: number; longitude: number } =>
            point.latitude !== null && point.longitude !== null,
        )
    : [];

  if (polygon.length < 3) return null;

  const mLat = 111320;
  const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
  const projected = polygon.map((point) => ({
    x: (point.longitude - longitude) * mLon,
    y: (point.latitude - latitude) * mLat,
  }));
  let areaM2 = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const next = projected[(i + 1) % projected.length];
    areaM2 += projected[i].x * next.y - next.x * projected[i].y;
  }
  areaM2 = Math.abs(areaM2) / 2;
  if (areaM2 < 12 || areaM2 > 100000) return null;

  const levels = Math.max(1, numberValue(roof?.levels) ?? numberValue(roof?.["building:levels"]) ?? 1);
  const height = Math.max(3, numberValue(roof?.heightMeters) ?? levels * 3);

  return {
    polygon,
    source: "planning",
    areaM2,
    containsTarget: true,
    distanceMeters: 0,
    heightMeters: height,
    levels,
  };
}

async function fetchMappedBuildings(
  latitude: number,
  longitude: number,
  radiusMeters = 450,
): Promise<MappedBuilding[]> {
  // GPS on desktop can easily be off by 50-150m. Keep a wider search area so
  // a nearby mapped building can still be used for the site model.
  const safeRadius = Math.min(Math.max(radiusMeters, 120), 700);
  const query = `[out:json][timeout:25];
way["building"](around:${safeRadius},${latitude},${longitude});
out geom tags qt;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];

  let data: {
    elements?: Array<{
      geometry?: Array<{ lat: number; lon: number }>;
      tags?: Record<string, string>;
    }>;
  } | null = null;

  for (const endpoint of endpoints) {
    // Try POST first, then GET. Some deployed runtimes/proxies reject one
    // request method even though the Overpass endpoint itself is reachable.
    for (const method of ["POST", "GET"] as const) {
      try {
        const response =
          method === "POST"
            ? await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept: "application/json",
                },
                body: "data=" + encodeURIComponent(query),
                cache: "no-store",
                signal: AbortSignal.timeout(18000),
              })
            : await fetch(
                endpoint + "?data=" + encodeURIComponent(query),
                {
                  method: "GET",
                  headers: { Accept: "application/json" },
                  cache: "no-store",
                  signal: AbortSignal.timeout(18000),
                },
              );

        if (!response.ok) continue;
        const candidate = (await response.json()) as {
          elements?: Array<{
            geometry?: Array<{ lat: number; lon: number }>;
            tags?: Record<string, string>;
          }>;
        };
        if (Array.isArray(candidate.elements)) {
          data = candidate;
          if (candidate.elements.length > 0) break;
        }
      } catch {
        // Try the other request method or the next public Overpass endpoint.
      }
    }
    if (data?.elements?.length) break;
  }

  // If Overpass is unavailable in the deployed runtime, use Nominatim's
  // reverse OSM lookup as a second building-footprint source. This only accepts
  // a polygon that Nominatim itself identifies as a building/house.
  if (!data?.elements?.length) {
    try {
      const nominatimUrl =
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
        encodeURIComponent(String(latitude)) +
        "&lon=" +
        encodeURIComponent(String(longitude)) +
        "&zoom=18&addressdetails=1&polygon_geojson=1";
      const response = await fetch(nominatimUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "RoofRay solar feasibility report",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const reverse = (await response.json()) as {
          category?: string;
          type?: string;
          geometry?: { type?: string; coordinates?: unknown };
        };
        const isBuilding =
          reverse.category === "building" ||
          ["house", "residential", "apartments", "detached", "terrace"].includes(
            String(reverse.type ?? "").toLowerCase(),
          );
        const coordinates = reverse.geometry?.coordinates;
        const ring =
          reverse.geometry?.type === "Polygon" &&
          Array.isArray(coordinates) &&
          Array.isArray(coordinates[0])
            ? coordinates[0]
            : null;

        if (isBuilding && ring && ring.length >= 3) {
          const polygon = ring
            .map((point) =>
              Array.isArray(point) && point.length >= 2
                ? {
                    latitude: Number(point[1]),
                    longitude: Number(point[0]),
                  }
                : null,
            )
            .filter(
              (point): point is { latitude: number; longitude: number } =>
                point !== null &&
                Number.isFinite(point.latitude) &&
                Number.isFinite(point.longitude),
            );

          if (polygon.length >= 3) {
            const mLat = 111320;
            const mLon =
              111320 * Math.cos((latitude * Math.PI) / 180);
            const projected = polygon.map((point) => ({
              x: (point.longitude - longitude) * mLon,
              y: (point.latitude - latitude) * mLat,
            }));
            let areaM2 = 0;
            for (let i = 0; i < projected.length; i += 1) {
              const next = projected[(i + 1) % projected.length];
              areaM2 +=
                projected[i].x * next.y - next.x * projected[i].y;
            }
            areaM2 = Math.abs(areaM2) / 2;
            if (areaM2 >= 12 && areaM2 <= 100000) {
              return [
                {
                  polygon,
                  areaM2,
                  containsTarget: pointInPolygon(
                    { x: 0, y: 0 },
                    projected,
                  ),
                  distanceMeters: 0,
                  heightMeters: 3,
                  levels: 1,
                },
              ];
            }
          }
        }
      }
    } catch {
      // Keep the existing roof-context fallback if Nominatim is unavailable.
    }
  }

  if (!data) return [];

  const mLat = 111320;
  const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
  const area = (points: Array<{ x: number; y: number }>) => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const n = points[(i + 1) % points.length];
      sum += points[i].x * n.y - n.x * points[i].y;
    }
    return Math.abs(sum) / 2;
  };

  return (data.elements ?? [])
    .map((element) => {
      const geo = element.geometry ?? [];
      const projected = geo.map((p) => ({
        x: (p.lon - longitude) * mLon,
        y: (p.lat - latitude) * mLat,
      }));
      const tags = element.tags ?? {};
      const levels = Math.max(1, Number(tags["building:levels"]) || 1);
      const taggedHeight = Number.parseFloat(
        String(tags.height ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "",
      );
      const heightMeters = Number.isFinite(taggedHeight)
        ? Math.max(3, taggedHeight)
        : levels * 3;
      const containsTarget =
        projected.length >= 3 && pointInPolygon({ x: 0, y: 0 }, projected);
      const centroid =
        projected.length > 0
          ? projected.reduce(
              (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
              { x: 0, y: 0 },
            )
          : { x: 0, y: 0 };
      if (projected.length > 0) {
        centroid.x /= projected.length;
        centroid.y /= projected.length;
      }
      return {
        polygon: geo.map((p) => ({ latitude: p.lat, longitude: p.lon })),
        areaM2: area(projected),
        containsTarget,
        distanceMeters: Math.hypot(centroid.x, centroid.y),
        heightMeters,
        levels,
      };
    })
    .filter(
      (item) =>
        item.polygon.length >= 3 &&
        item.areaM2 >= 12 &&
        item.areaM2 <= 100000,
    )
    .sort((a, b) => {
      if (a.containsTarget !== b.containsTarget) {
        return a.containsTarget ? -1 : 1;
      }
      return (
        (a.distanceMeters - b.distanceMeters) ||
        (b.heightMeters - a.heightMeters) ||
        (a.areaM2 - b.areaM2)
      );
    })
    .slice(0, 40);
}


function roofVisualCommands({
  roofAreaSqFt,
  roofType,
  panelCount,
  panelPowerW,
  direction,
  slopeDeg,
  roofFootprint,
  obstacles,
  sunCycle,
  mappedBuildings,
  satelliteTiles,
  roofPhoto,
  logoImage,
}: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
  roofFootprint: Record<string, unknown> | null;
  obstacles: Array<Record<string, unknown>>;
  sunCycle: Record<string, unknown> | null;
  mappedBuildings: MappedBuilding[];
  satelliteTiles: SatelliteTile[];
  roofPhoto: RoofPhoto | null;
  logoImage: LogoImage | null;
}): string[] {
  const safePanels = Math.max(0, Math.min(40, Math.round(panelCount ?? 0)));
  const roofPolygon = Array.isArray(roofFootprint?.polygon)
    ? roofFootprint.polygon as Array<Record<string, unknown>>
    : [];
  const exactTarget = mappedBuildings.find((building) => building.containsTarget) ?? null;
  // When browser GPS lands on a road/parking area, the point may be just
  // outside the mapped footprint. In that case use the nearest mapped
  // building rather than producing an empty roof panel card.
  const mappedTarget =
    exactTarget ??
    mappedBuildings.find((building) => building.distanceMeters <= 450) ??
    null;
  const actualRoofPolygon =
    roofPolygon.length >= 3 ? roofPolygon : (mappedTarget?.polygon ?? []);

  const roofLat = numberValue(roofFootprint?.latitude);
  const roofLon = numberValue(roofFootprint?.longitude);
  const centerLat =
    roofLat ?? numberValue((actualRoofPolygon[0] ?? {}).latitude) ?? 0;
  const centerLon =
    roofLon ?? numberValue((actualRoofPolygon[0] ?? {}).longitude) ?? 0;

  // Landscape visual page, deliberately arranged like a professional solar
  // site-assessment sheet: dark information rail, large real aerial map and
  // three analysis cards underneath.
  const pageW = 842;
  const pageH = 595;
  const sideX = 18;
  const sideY = 18;
  const sideW = 164;
  const sideH = 559;
  const mapX = 190;
  const mapY = 215;
  const mapW = 634;
  const mapH = 295;

  const satelliteZoom = 19;
  const centerPixel = webMercatorPixel(centerLat, centerLon, satelliteZoom);
  const startTileX = Math.floor(centerPixel.x / 256) - 1;
  const startTileY = Math.floor(centerPixel.y / 256) - 1;

  const project = (lat: number, lon: number) => {
    const pixel = webMercatorPixel(lat, lon, satelliteZoom);
    const relativeX = pixel.x - startTileX * 256;
    const relativeY = pixel.y - startTileY * 256;
    return {
      x: mapX + (relativeX / 1024) * mapW,
      y: mapY + mapH - (relativeY / 768) * mapH,
    };
  };

  const roofPoints = actualRoofPolygon
    .map((point) => {
      const lat = numberValue(point.latitude);
      const lon = numberValue(point.longitude);
      return lat !== null && lon !== null ? project(lat, lon) : null;
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));

  const commands: string[] = [
    "0.025 0.055 0.085 rg",
    sideX + " " + sideY + " " + sideW + " " + sideH + " re f",
    "0.035 0.075 0.115 rg",
    mapX + " " + mapY + " " + mapW + " " + mapH + " re f",
  ];

  if (roofPhoto) {
    const photoW = mapW - 28;
    const photoH = Math.min(mapH - 28, photoW * (roofPhoto.height / Math.max(1, roofPhoto.width)));
    const photoX = mapX + 14;
    const photoY = mapY + (mapH - photoH) / 2;
    commands.push(
      "q",
      photoW.toFixed(2) + " 0 0 " + photoH.toFixed(2) + " " +
        (photoX + 8).toFixed(2) + " " + (photoY - 8).toFixed(2) + " cm",
      "/RoofPhoto Do",
      "Q",
      "q",
      photoW.toFixed(2) + " 0 0 " + photoH.toFixed(2) + " " +
        photoX.toFixed(2) + " " + photoY.toFixed(2) + " cm",
      "/RoofPhoto Do",
      "Q",
      "0.20 0.85 1.00 RG",
      "1.8 w",
      photoX.toFixed(2) + " " + photoY.toFixed(2) + " " + photoW.toFixed(2) + " " + photoH.toFixed(2) + " re S",
      "BT /F2 8 Tf 0.98 0.98 0.98 rg " +
        (photoX + 10).toFixed(1) + " " + (photoY + photoH - 18).toFixed(1) +
        " Td (PHOTO-BASED ROOF 3D MODEL) Tj ET",
    );
  } else if (satelliteTiles.length) {
    commands.push(
      "q",
      mapX + " " + mapY + " " + mapW + " " + mapH + " re W n",
    );
    // The fetched tiles are 4 columns x 3 rows (1024 x 768 source pixels).
    // Scale that complete mosaic into the actual map frame. Previously the
    // raw 256px tiles were drawn at 1:1, so most of the imagery landed outside
    // the 634 x 310pt map viewport and the report looked like an empty grey map.
    const tileW = mapW / 4;
    const tileH = mapH / 3;
    for (const tile of satelliteTiles) {
      if (tile.w === 1024 && tile.h === 768) {
        commands.push(
          "q",
          mapW.toFixed(2) + " 0 0 " + mapH.toFixed(2) + " " +
            mapX.toFixed(2) + " " + mapY.toFixed(2) + " cm",
          "/" + tile.name + " Do",
          "Q",
        );
      } else {
        commands.push(
          "q",
          tileW.toFixed(2) + " 0 0 " + tileH.toFixed(2) + " " +
            (mapX + (tile.x / 256) * tileW).toFixed(2) + " " +
            (mapY + (tile.y / 256) * tileH).toFixed(2) + " cm",
          "/" + tile.name + " Do",
          "Q",
        );
      }
    }
    commands.push("Q");
  }

  commands.push(
    "0.20 0.85 1.00 RG",
    "1.5 w",
    mapX + " " + mapY + " " + mapW + " " + mapH + " re S",
  );

  if (!satelliteTiles.length && !roofPhoto) {
    commands.push(
      "0.02 0.04 0.07 rg",
      (mapX + 18).toFixed(1) + " " + (mapY + mapH - 34).toFixed(1) + " 250 22 re f",
      "BT /F2 6.5 Tf 0.98 0.98 0.98 rg " +
        (mapX + 26).toFixed(1) + " " + (mapY + mapH - 27).toFixed(1) +
        " Td (Satellite imagery unavailable - mapped buildings remain visible) Tj ET",
    );
  }

  // Real-location 3D site model: every mapped OSM building is extruded from
  // its actual footprint. Height comes from OSM height/building:levels, with
  // 3m per level as the documented fallback. This is a map-based 3D
  // visualization, not a photogrammetric claim.
  // Always render mapped buildings. A user roof photo is an additional visual,
  // not a reason to remove the real OSM building geometry from the 3D map.
  const siteBuildings3d = mappedBuildings
    .filter((building) => building.polygon.length >= 3)
    .sort((a, b) => {
      if (a.containsTarget !== b.containsTarget) return a.containsTarget ? -1 : 1;
      return b.heightMeters - a.heightMeters;
    })
    .slice(0, 32);

  const projectGround = (point: { latitude: number; longitude: number }) =>
    project(point.latitude, point.longitude);

  for (const building of siteBuildings3d) {
    const ground = building.polygon
      .map(projectGround)
      .filter((p): p is { x: number; y: number } => Boolean(p));
    if (ground.length < 3) continue;

    const height = Math.max(3, Math.min(30, building.heightMeters || 3));
    const liftX = -height * 1.15;
    const liftY = height * 0.72;
    const roof = ground.map((p) => ({ x: p.x + liftX, y: p.y - liftY }));

    // Building side faces, ordered around the footprint.
    for (let i = 0; i < ground.length; i += 1) {
      const j = (i + 1) % ground.length;
      const face = [
        ground[i],
        ground[j],
        roof[j],
        roof[i],
      ];
      commands.push(
        building.containsTarget ? "0.02 0.45 0.78 rg" : "0.12 0.38 0.70 rg",
        face[0].x.toFixed(1) + " " + face[0].y.toFixed(1) + " m",
        face[1].x.toFixed(1) + " " + face[1].y.toFixed(1) + " l",
        face[2].x.toFixed(1) + " " + face[2].y.toFixed(1) + " l",
        face[3].x.toFixed(1) + " " + face[3].y.toFixed(1) + " l h f",
      );
    }

    // Roof surface follows the real mapped polygon.
    commands.push(
      building.containsTarget ? "0.04 0.62 0.95 rg" : "0.20 0.52 0.86 rg",
      building.containsTarget ? "0.45 0.90 1.00 RG" : "0.45 0.82 1.00 RG",
      "1 w",
      roof[0].x.toFixed(1) + " " + roof[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < roof.length; i += 1) {
      commands.push(roof[i].x.toFixed(1) + " " + roof[i].y.toFixed(1) + " l");
    }
    commands.push("h f S");

    if (building === mappedTarget) {
      const cx = roof.reduce((sum, p) => sum + p.x, 0) / roof.length;
      const cy = roof.reduce((sum, p) => sum + p.y, 0) / roof.length;
      const label = building.source === "planning" ? "PLANNING ROOF AREA" : building.containsTarget ? "YOUR HOUSE" : "NEAREST MAPPED BUILDING";
      commands.push(
        "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
          (cx - 25).toFixed(1) + " " + (cy + 5).toFixed(1) +
          " Td (" + label + ") Tj ET",
        "BT /F1 5.5 Tf 0.80 0.92 0.98 rg " +
          (cx - 20).toFixed(1) + " " + (cy - 5).toFixed(1) +
          " Td (" + height.toFixed(0) + "m / " + String(building.levels) + " levels) Tj ET",
      );
    }
  }

  // If the exact GPS point is not inside an OSM building, show the
  // real location marker instead of drawing a fake house footprint.
  if (!mappedTarget) {
    const target = project(centerLat, centerLon);
    commands.push(
      "0.10 0.75 1.00 rg",
      (target.x - 6).toFixed(1) + " " + (target.y - 6).toFixed(1) + " 12 12 re f",
      "0.05 0.12 0.20 rg",
      (target.x + 8).toFixed(1) + " " + (target.y + 6).toFixed(1) + " 72 14 re f",
      "BT /F2 6.5 Tf 0.98 0.98 0.98 rg " +
        (target.x + 11).toFixed(1) + " " + (target.y + 10).toFixed(1) +
        " Td (LOCATION - NO MAPPED BUILDING WITHIN 450M) Tj ET",
    );
  }

  // Actual mapped target roof outline + clipped panel placement.
  if (roofPoints.length >= 3) {
    commands.push(
      "0.20 0.90 1.00 RG",
      "2.8 w",
      roofPoints[0].x.toFixed(1) + " " + roofPoints[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < roofPoints.length; i += 1) {
      commands.push(
        roofPoints[i].x.toFixed(1) + " " + roofPoints[i].y.toFixed(1) + " l",
      );
    }
    commands.push("h S");

    if (safePanels > 0) {
      const minX = Math.min(...roofPoints.map((p) => p.x));
      const maxX = Math.max(...roofPoints.map((p) => p.x));
      const minY = Math.min(...roofPoints.map((p) => p.y));
      const maxY = Math.max(...roofPoints.map((p) => p.y));
      const roofW = Math.max(24, maxX - minX);
      const roofH = Math.max(24, maxY - minY);
      const cols = Math.max(
        1,
        Math.min(8, Math.ceil(Math.sqrt(safePanels * roofW / Math.max(roofH, 1)))),
      );
      const rows = Math.max(1, Math.ceil(safePanels / cols));
      const gap = Math.max(1.5, Math.min(4, Math.min(roofW, roofH) * 0.025));
      const cellW = Math.max(5, (roofW * 0.76 - gap * (cols - 1)) / cols);
      const cellH = Math.max(5, (roofH * 0.70 - gap * (rows - 1)) / rows);

      commands.push("q");
      commands.push(
        roofPoints[0].x.toFixed(1) + " " + roofPoints[0].y.toFixed(1) + " m",
      );
      for (let i = 1; i < roofPoints.length; i += 1) {
        commands.push(
          roofPoints[i].x.toFixed(1) + " " + roofPoints[i].y.toFixed(1) + " l",
        );
      }
      commands.push("h W n");

      for (let i = 0; i < safePanels; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = minX + roofW * 0.12 + col * (cellW + gap);
        const y = maxY - roofH * 0.15 - (row + 1) * cellH - row * gap;
        commands.push(
          "0.025 0.15 0.32 rg",
          x.toFixed(1) + " " + y.toFixed(1) + " " +
            cellW.toFixed(1) + " " + cellH.toFixed(1) + " re f",
          "0.35 0.75 1.00 RG",
          "0.55 w",
          x.toFixed(1) + " " + y.toFixed(1) + " " +
            cellW.toFixed(1) + " " + cellH.toFixed(1) + " re S",
        );
      }
      commands.push("Q");
    }

    const houseCenter = {
      x: roofPoints.reduce((sum, p) => sum + p.x, 0) / roofPoints.length,
      y: roofPoints.reduce((sum, p) => sum + p.y, 0) / roofPoints.length,
    };
    commands.push(
      "0.10 0.55 1.00 rg",
      (houseCenter.x - 5).toFixed(1) + " " + (houseCenter.y - 5).toFixed(1) + " 10 10 re f",
      "0.05 0.12 0.20 rg",
      (houseCenter.x + 5).toFixed(1) + " " + (houseCenter.y + 4).toFixed(1) + " 56 16 re f",
      "BT /F2 8 Tf 0.98 0.98 0.98 rg " +
        (houseCenter.x + 9).toFixed(1) + " " + (houseCenter.y + 8).toFixed(1) +
        " Td (Your mapped roof) Tj ET",
    );
  }

  // Nearby mapped/analysis obstacles are marked around the real target.
  const sortedObstacles = [...obstacles]
    .filter((item) => numberValue(item.distanceMeters) !== null)
    .sort(
      (a, b) =>
        (numberValue(a.distanceMeters) ?? 9999) -
        (numberValue(b.distanceMeters) ?? 9999),
    )
    .slice(0, 5);

  sortedObstacles.forEach((obstacle, index) => {
    const lat = numberValue(obstacle.latitude);
    const lon = numberValue(obstacle.longitude);
    if (lat === null || lon === null) return;
    const p = project(lat, lon);
    if (
      p.x < mapX + 8 || p.x > mapX + mapW - 8 ||
      p.y < mapY + 8 || p.y > mapY + mapH - 8
    ) return;
    const h = numberValue(obstacle.heightMeters) ?? 6;
    commands.push(
      "0.04 0.07 0.10 rg",
      (p.x - 10).toFixed(1) + " " + (p.y - 10).toFixed(1) + " 20 20 re f",
      "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
        (p.x - 2).toFixed(1) + " " + (p.y - 2).toFixed(1) +
        " Td (" + (index + 1) + ") Tj ET",
    );
    commands.push(
      "BT /F1 6 Tf 0.98 0.98 0.98 rg " +
        (p.x + 12).toFixed(1) + " " + (p.y + 2).toFixed(1) +
        " Td (" + text(String(obstacle.type ?? "building")).slice(0, 16) +
        " ~" + h.toFixed(0) + "m) Tj ET",
    );
  });

  // Sun arc around the real mapped roof.
  const baseSunCycle = Array.isArray((sunCycle ?? {}).next12Hours)
    ? (sunCycle as { next12Hours: Array<Record<string, unknown>> }).next12Hours
    : [];
  const houseCenter = roofPoints.length
    ? {
        x: roofPoints.reduce((a, p) => a + p.x, 0) / roofPoints.length,
        y: roofPoints.reduce((a, p) => a + p.y, 0) / roofPoints.length,
      }
    : { x: mapX + mapW / 2, y: mapY + mapH / 2 };

  const edgeSpace = Math.min(
    houseCenter.x - mapX,
    mapX + mapW - houseCenter.x,
    houseCenter.y - mapY,
    mapY + mapH - houseCenter.y,
  );
  const sunRadius = Math.max(35, Math.min(105, edgeSpace - 14));
  const sunPoints = baseSunCycle
    .filter(
      (sample) =>
        sample.aboveHorizon !== false &&
        numberValue(sample.azimuthDeg) !== null,
    )
    .slice(0, 8)
    .map((sample) => {
      const az = ((numberValue(sample.azimuthDeg) ?? 0) * Math.PI) / 180;
      const el = Math.max(
        0.38,
        Math.min(1, (numberValue(sample.elevationDeg) ?? 10) / 90),
      );
      return {
        x: houseCenter.x + Math.sin(az) * sunRadius,
        y: houseCenter.y + Math.cos(az) * sunRadius * el,
      };
    });

  if (roofPhoto) {
    const modelX = mapX + 80;
    const modelY = mapY + 54;
    const modelW = mapW - 160;
    const modelH = Math.min(145, mapH - 108);
    const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(safePanels || 1))));
    const rows = Math.max(1, Math.ceil((safePanels || 1) / cols));
    const pw = Math.max(16, (modelW * 0.78) / cols);
    const ph = Math.max(9, (modelH * 0.55) / rows);
    commands.push(
      "0.02 0.15 0.30 rg",
      modelX.toFixed(1) + " " + modelY.toFixed(1) + " m",
      (modelX + modelW).toFixed(1) + " " + (modelY + 10).toFixed(1) + " l",
      (modelX + modelW - 24).toFixed(1) + " " + (modelY + modelH + 28).toFixed(1) + " l",
      (modelX + 18).toFixed(1) + " " + (modelY + modelH + 18).toFixed(1) + " l h f",
    );
    for (let i = 0; i < (safePanels || 0); i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = modelX + 24 + col * (pw + 4);
      const y = modelY + 22 + row * (ph + 4);
      commands.push(
        "0.02 0.15 0.30 rg",
        x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re f",
        "0.35 0.82 1.00 RG",
        "0.65 w",
        x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re S",
      );
    }
    commands.push(
      "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
        (modelX + 8).toFixed(1) + " " + (modelY + modelH + 38).toFixed(1) +
        " Td (PLANNED PANEL ARRAY) Tj ET",
    );
  }

  // Building shadow footprints: each mapped building casts a shadow
  // according to its own OSM height and the actual sun elevation/azimuth.
  // This makes taller buildings produce longer shadow zones on the roof map.
  const shadowSamples = baseSunCycle
    .filter(
      (sample) =>
        sample.aboveHorizon !== false &&
        numberValue(sample.azimuthDeg) !== null &&
        numberValue(sample.elevationDeg) !== null &&
        (numberValue(sample.elevationDeg) ?? 0) > 8,
    )
    .filter(
      (_, index, arr) =>
        index === 0 ||
        index === Math.floor(arr.length / 2) ||
        index === arr.length - 1,
    )
    .slice(0, 3);

  for (const sample of shadowSamples) {
    const sunAzimuth = numberValue(sample.azimuthDeg) ?? 0;
    const sunElevation = numberValue(sample.elevationDeg) ?? 20;
    const shadowBearing = ((sunAzimuth + 180) * Math.PI) / 180;

    for (const building of siteBuildings3d) {
      if (building.containsTarget) continue;
      const base = building.polygon
        .map(projectGround)
        .filter((p): p is { x: number; y: number } => Boolean(p));
      if (base.length < 3) continue;

      const heightMeters = Math.max(3, building.heightMeters || 3);
      const shadowMeters = Math.min(
        140,
        Math.max(8, heightMeters / Math.tan((sunElevation * Math.PI) / 180)),
      );
      const metersPerPixel = 156543.03392 / 2 ** satelliteZoom;
      const pixelsPerMeterX = mapW / (1024 * metersPerPixel);
      const pixelsPerMeterY = mapH / (768 * metersPerPixel);
      const dxPixels =
        Math.sin(shadowBearing) * shadowMeters * pixelsPerMeterX;
      const dyPixels =
        -Math.cos(shadowBearing) * shadowMeters * pixelsPerMeterY;

      commands.push(
        "0.65 0.08 0.08 rg",
        base[0].x.toFixed(1) + " " + base[0].y.toFixed(1) + " m",
      );
      for (let i = 1; i < base.length; i += 1) {
        commands.push(base[i].x.toFixed(1) + " " + base[i].y.toFixed(1) + " l");
      }
      for (let i = base.length - 1; i >= 0; i -= 1) {
        commands.push(
          (base[i].x + dxPixels).toFixed(1) +
            " " +
            (base[i].y + dyPixels).toFixed(1) +
            " l",
        );
      }
      commands.push("h f");

      if (heightMeters >= 9) {
        const center = base.reduce(
          (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
          { x: 0, y: 0 },
        );
        center.x /= base.length;
        center.y /= base.length;
        commands.push(
          "BT /F2 5.5 Tf 1.00 0.86 0.86 rg " +
            (center.x + 4).toFixed(1) +
            " " +
            (center.y + 3).toFixed(1) +
            " Td (" +
            heightMeters.toFixed(0) +
            "m building) Tj ET",
        );
      }
    }
  }

  if (sunPoints.length >= 2) {
    commands.push(
      "1.00 0.57 0.00 RG",
      "2.2 w",
      sunPoints[0].x.toFixed(1) + " " + sunPoints[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < sunPoints.length; i += 1) {
      commands.push(
        sunPoints[i].x.toFixed(1) + " " + sunPoints[i].y.toFixed(1) + " l",
      );
    }
    commands.push("S");
    for (const point of sunPoints) {
      commands.push(
        "1.00 0.64 0.02 rg",
        (point.x - 6).toFixed(1) + " " + (point.y - 6).toFixed(1) + " 12 12 re f",
      );
    }
  }

  // North compass.
  const compassX = mapX + mapW - 34;
  const compassY = mapY + mapH - 28;
  commands.push(
    "0.03 0.06 0.10 rg",
    (compassX - 25).toFixed(1) + " " + (compassY - 25).toFixed(1) + " 50 50 re f",
    "BT /F2 9 Tf 0.98 0.98 0.98 rg " +
      (compassX - 3).toFixed(1) + " " + (compassY + 12).toFixed(1) + " Td (N) Tj ET",
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
      (compassX + 29).toFixed(1) + " " + (compassY - 3).toFixed(1) + " Td (E) Tj ET",
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
      (compassX - 4).toFixed(1) + " " + (compassY - 27).toFixed(1) + " Td (S) Tj ET",
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
      (compassX - 32).toFixed(1) + " " + (compassY - 3).toFixed(1) + " Td (W) Tj ET",
  );

  // Bottom analysis cards.
  const cardY = 18;
  const cardH = 180;
  const cardGap = 10;
  const cardW = (mapW - cardGap * 2) / 3;
  const cardXs = [mapX, mapX + cardW + cardGap, mapX + (cardW + cardGap) * 2];

  for (const x of cardXs) {
    commands.push(
      "0.035 0.075 0.115 rg",
      x.toFixed(1) + " " + cardY + " " + cardW.toFixed(1) + " " + cardH + " re f",
      "0.15 0.25 0.32 RG",
      "0.8 w",
      x.toFixed(1) + " " + cardY + " " + cardW.toFixed(1) + " " + cardH + " re S",
    );
  }

  commands.push(
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (cardXs[0] + 10).toFixed(1) + " " + (cardY + cardH - 16) + " Td (Sun Path & Shading Analysis) Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (cardXs[1] + 10).toFixed(1) + " " + (cardY + cardH - 16) + " Td (Roof Layout - Top View) Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (cardXs[2] + 10).toFixed(1) + " " + (cardY + cardH - 16) + " Td (Suggested Installation) Tj ET",
  );

  // Card 1: a measured site-geometry diagram. This deliberately does not
  // invent a 3D house. Every nearby obstacle uses its calculated distance,
  // bearing and height, while the orange sun path uses the calculated solar
  // azimuth/elevation samples.
  const c1x = cardXs[0] + 12;
  const c1y = cardY + 30;
  const c1w = cardW - 24;
  const c1h = cardH - 55;
  const c1cx = c1x + c1w / 2;
  const c1cy = c1y + 70;
  const diagramRadius = Math.min(70, c1w * 0.34);

  commands.push(
    "0.02 0.05 0.08 rg",
    c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c1w.toFixed(1) + " " + c1h.toFixed(1) + " re f",
    "0.20 0.24 0.28 RG",
    "0.6 w",
    (c1cx - diagramRadius).toFixed(1) + " " + (c1cy - diagramRadius).toFixed(1) +
      " " + (diagramRadius * 2).toFixed(1) + " " + (diagramRadius * 2).toFixed(1) + " re S",
    "0.30 0.35 0.40 RG",
    "0.5 w",
    (c1cx - diagramRadius * 0.55).toFixed(1) + " " + (c1cy - diagramRadius * 0.55).toFixed(1) +
      " " + (diagramRadius * 1.1).toFixed(1) + " " + (diagramRadius * 1.1).toFixed(1) + " re S",
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " + (c1cx - 3).toFixed(1) + " " + (c1cy + diagramRadius + 8).toFixed(1) + " Td (N) Tj ET",
    "BT /F1 6 Tf 0.72 0.78 0.84 rg " + (c1cx + diagramRadius + 6).toFixed(1) + " " + (c1cy - 2).toFixed(1) + " Td (E) Tj ET",
    "BT /F1 6 Tf 0.72 0.78 0.84 rg " + (c1cx - 3).toFixed(1) + " " + (c1cy - diagramRadius - 12).toFixed(1) + " Td (S) Tj ET",
    "BT /F1 6 Tf 0.72 0.78 0.84 rg " + (c1cx - diagramRadius - 12).toFixed(1) + " " + (c1cy - 2).toFixed(1) + " Td (W) Tj ET",
  );

  // Target house at the exact center of the geometry diagram.
  commands.push(
    "0.10 0.65 1.00 rg",
    (c1cx - 22).toFixed(1) + " " + (c1cy - 14).toFixed(1) + " 44 28 re f",
    "0.70 0.90 1.00 RG",
    "1 w",
    (c1cx - 22).toFixed(1) + " " + (c1cy - 14).toFixed(1) + " 44 28 re S",
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " + (c1cx - 17).toFixed(1) + " " + (c1cy - 2).toFixed(1) + " Td (YOUR HOUSE) Tj ET",
  );

  // Nearby buildings: distance controls radial position; bearing controls
  // direction; height is shown beside each marker.
  const geometryObstacles = [...obstacles]
    .filter(
      (item) =>
        numberValue(item.distanceMeters) !== null &&
        numberValue(item.bearingDeg) !== null,
    )
    .sort(
      (a, b) =>
        (numberValue(a.distanceMeters) ?? 9999) -
        (numberValue(b.distanceMeters) ?? 9999),
    )
    .slice(0, 6);

  geometryObstacles.forEach((obstacle, index) => {
    const distance = Math.max(1, numberValue(obstacle.distanceMeters) ?? 1);
    const bearing = numberValue(obstacle.bearingDeg) ?? 0;
    const radius = Math.min(
      diagramRadius - 8,
      20 + Math.sqrt(Math.min(distance, 150) / 150) * (diagramRadius - 28),
    );
    const angle = (bearing * Math.PI) / 180;
    const x = c1cx + Math.sin(angle) * radius;
    const y = c1cy + Math.cos(angle) * radius;
    const height = numberValue(obstacle.heightMeters) ?? 6;

    commands.push(
      "0.95 0.58 0.08 rg",
      (x - 7).toFixed(1) + " " + (y - 7).toFixed(1) + " 14 14 re f",
      "0.98 0.98 0.98 RG",
      "0.7 w",
      (x - 7).toFixed(1) + " " + (y - 7).toFixed(1) + " 14 14 re S",
      "BT /F2 6 Tf 0.02 0.05 0.08 rg " + (x - 2).toFixed(1) + " " + (y - 2).toFixed(1) + " Td (" + (index + 1) + ") Tj ET",
      "BT /F1 5.5 Tf 0.82 0.88 0.92 rg " +
        (x + 9).toFixed(1) + " " + (y + 4).toFixed(1) +
        " Td (" + Math.round(distance) + "m / " + height.toFixed(0) + "m) Tj ET",
    );

    // Thin measurement line from house to the obstacle.
    commands.push(
      "0.38 0.48 0.56 RG",
      "0.45 w",
      c1cx.toFixed(1) + " " + c1cy.toFixed(1) + " m",
      x.toFixed(1) + " " + y.toFixed(1) + " l S",
    );
  });

  // Solar movement direction: true azimuths are projected around the house.
  const diagramCycle = Array.isArray((sunCycle ?? {}).next12Hours)
    ? (sunCycle as { next12Hours: Array<Record<string, unknown>> }).next12Hours
    : [];
  const sunSamples = diagramCycle
    .filter(
      (sample) =>
        sample.aboveHorizon !== false &&
        numberValue(sample.azimuthDeg) !== null,
    )
    .slice(0, 10);

  if (sunSamples.length >= 2) {
    const sunPts = sunSamples.map((sample, index) => {
      const az = ((numberValue(sample.azimuthDeg) ?? 0) * Math.PI) / 180;
      const r = diagramRadius + 8 + (index % 2) * 3;
      return {
        x: c1cx + Math.sin(az) * r,
        y: c1cy + Math.cos(az) * r,
        timestamp: String(sample.timestamp ?? ""),
      };
    });

    commands.push(
      "1.00 0.62 0.00 RG",
      "1.6 w",
      sunPts[0].x.toFixed(1) + " " + sunPts[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < sunPts.length; i += 1) {
      commands.push(
        sunPts[i].x.toFixed(1) + " " + sunPts[i].y.toFixed(1) + " l",
      );
    }
    commands.push("S");

    sunPts.forEach((point, index) => {
      commands.push(
        "1.00 0.62 0.00 rg",
        (point.x - 4).toFixed(1) + " " + (point.y - 4).toFixed(1) + " 8 8 re f",
      );
      if (index === 0 || index === Math.floor(sunPts.length / 2) || index === sunPts.length - 1) {
        const rawTime = point.timestamp;
        const timeLabel =
          rawTime.length >= 16 ? rawTime.slice(11, 16) : "sun";
        commands.push(
          "BT /F1 5.5 Tf 1.00 0.78 0.18 rg " +
            (point.x + 5).toFixed(1) + " " + (point.y + 2).toFixed(1) +
            " Td (" + text(timeLabel) + ") Tj ET",
        );
      }
    });
  }

  commands.push(
    "BT /F2 7 Tf 0.98 0.98 0.98 rg " + (c1x + 8).toFixed(1) + " " + (c1y + c1h - 12).toFixed(1) + " Td (SUN + SURROUNDING BUILDING GEOMETRY) Tj ET",
    "BT /F1 5.5 Tf 0.65 0.72 0.78 rg " + (c1x + 8).toFixed(1) + " " + (c1y + 6).toFixed(1) + " Td (Orange = building | label = distance / height | yellow path = calculated sun azimuth) Tj ET",
  );

  // Card 2: true roof footprint top view, not a generic rectangle.
  const c2x = cardXs[1] + 16;
  const c2y = cardY + 36;
  const c2w = cardW - 32;
  const c2h = cardH - 62;
  if (roofPoints.length >= 3) {
    const minX = Math.min(...roofPoints.map((p) => p.x));
    const maxX = Math.max(...roofPoints.map((p) => p.x));
    const minY = Math.min(...roofPoints.map((p) => p.y));
    const maxY = Math.max(...roofPoints.map((p) => p.y));
    const scale = Math.min(
      (c2w - 24) / Math.max(1, maxX - minX),
      (c2h - 24) / Math.max(1, maxY - minY),
    );
    const mapped = roofPoints.map((p) => ({
      x: c2x + 12 + (p.x - minX) * scale,
      y: c2y + 8 + (p.y - minY) * scale,
    }));
    commands.push(
      "0.11 0.16 0.20 rg",
      c2x.toFixed(1) + " " + c2y.toFixed(1) + " " + c2w.toFixed(1) + " " + c2h.toFixed(1) + " re f",
      "0.95 0.70 0.20 RG",
      "1.3 w",
      mapped[0].x.toFixed(1) + " " + mapped[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < mapped.length; i += 1) {
      commands.push(mapped[i].x.toFixed(1) + " " + mapped[i].y.toFixed(1) + " l");
    }
    commands.push("h S");
    const pMinX = Math.min(...mapped.map((p) => p.x));
    const pMaxX = Math.max(...mapped.map((p) => p.x));
    const pMinY = Math.min(...mapped.map((p) => p.y));
    const pMaxY = Math.max(...mapped.map((p) => p.y));
    const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(safePanels || 1))));
    const rows = Math.max(1, Math.ceil((safePanels || 1) / cols));
    const pw = Math.max(5, (pMaxX - pMinX) * 0.72 / cols);
    const ph = Math.max(5, (pMaxY - pMinY) * 0.70 / rows);
    commands.push("q");
    commands.push(mapped[0].x.toFixed(1) + " " + mapped[0].y.toFixed(1) + " m");
    for (let i = 1; i < mapped.length; i += 1) commands.push(mapped[i].x.toFixed(1) + " " + mapped[i].y.toFixed(1) + " l");
    commands.push("h W n");
    for (let i = 0; i < (safePanels || 0); i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = pMinX + (pMaxX - pMinX) * 0.14 + col * (pw + 2);
      const y = pMaxY - (pMaxY - pMinY) * 0.15 - (row + 1) * ph - row * 2;
      commands.push(
        "0.025 0.15 0.32 rg",
        x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re f",
        "0.35 0.75 1.00 RG",
        "0.4 w",
        x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re S",
      );
    }
    commands.push("Q");
    commands.push(
      "BT /F2 7 Tf 0.98 0.98 0.98 rg " + (c2x + c2w - 74).toFixed(1) + " " + (c2y + 7).toFixed(1) +
        " Td (" + (safePanels || 0) + " panels | " + (panelPowerW ?? 450) + " W) Tj ET",
    );
  } else {
    // OSM does not always contain the exact house footprint. Do not label a
    // nearby building as the user's house; use the entered roof area only for
    // a clearly-labelled planning layout.
    const planningAreaM2 = roofAreaSqFt !== null ? roofAreaSqFt * 0.092903 : null;
    const planW = Math.min(c2w - 30, Math.max(44, Math.sqrt(Math.max(1, planningAreaM2 ?? 1)) * 5));
    const planH = Math.min(c2h - 38, Math.max(32, Math.sqrt(Math.max(1, planningAreaM2 ?? 1)) * 3.5));
    const px = c2x + (c2w - planW) / 2;
    const py = c2y + (c2h - planH) / 2;
    commands.push(
      "0.11 0.16 0.20 rg",
      px.toFixed(1) + " " + py.toFixed(1) + " " + planW.toFixed(1) + " " + planH.toFixed(1) + " re f",
      "0.95 0.70 0.20 RG",
      "1.3 w",
      px.toFixed(1) + " " + py.toFixed(1) + " " + planW.toFixed(1) + " " + planH.toFixed(1) + " re S",
    );
    const colsPlan = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(safePanels || 1))));
    const rowsPlan = Math.max(1, Math.ceil((safePanels || 1) / colsPlan));
    const pwPlan = Math.max(6, (planW * 0.78) / colsPlan);
    const phPlan = Math.max(5, (planH * 0.68) / rowsPlan);
    for (let i = 0; i < safePanels; i += 1) {
      const row = Math.floor(i / colsPlan);
      const col = i % colsPlan;
      const x = px + planW * 0.10 + col * pwPlan;
      const y = py + planH * 0.18 + row * phPlan;
      commands.push(
        "0.025 0.15 0.32 rg",
        x.toFixed(1) + " " + y.toFixed(1) + " " + Math.max(4, pwPlan - 2).toFixed(1) + " " + Math.max(4, phPlan - 2).toFixed(1) + " re f",
        "0.35 0.75 1.00 RG",
        "0.4 w",
        x.toFixed(1) + " " + y.toFixed(1) + " " + Math.max(4, pwPlan - 2).toFixed(1) + " " + Math.max(4, phPlan - 2).toFixed(1) + " re S",
      );
    }
    commands.push(
      "BT /F1 6.5 Tf 0.75 0.82 0.88 rg " + (c2x + 8).toFixed(1) + " " + (c2y + 7).toFixed(1) +
        " Td (" + text(planningAreaM2 !== null
          ? "Planning roof layout from entered area - exact OSM footprint unavailable"
          : "Exact OSM roof footprint unavailable at this location") + ") Tj ET",
    );
  }
  // Card 3: 3D-style installation sketch built from the actual mapped roof
  // footprint. It is a visualization, not a claim that the source imagery is
  // photogrammetric 3D.
  const c3x = cardXs[2] + 14;
  const c3y = cardY + 30;
  const c3w = cardW - 28;
  const c3h = cardH - 55;
  const baseX = c3x + 34;
  const baseY = c3y + 35;
  const baseW = c3w * 0.68;
  const baseH = c3h * 0.42;
  commands.push(
    "0.10 0.18 0.22 rg",
    baseX.toFixed(1) + " " + baseY.toFixed(1) + " " + baseW.toFixed(1) + " " + baseH.toFixed(1) + " re f",
    "0.75 0.80 0.84 RG",
    "1 w",
    baseX.toFixed(1) + " " + baseY.toFixed(1) + " m",
    (baseX + baseW).toFixed(1) + " " + (baseY + 12).toFixed(1) + " l",
    (baseX + baseW - 16).toFixed(1) + " " + (baseY + baseH + 30).toFixed(1) + " l",
    (baseX + 12).toFixed(1) + " " + (baseY + baseH + 18).toFixed(1) + " l h S",
  );

  const cols3 = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(safePanels || 1))));
  const rows3 = Math.max(1, Math.ceil((safePanels || 1) / cols3));
  const pw3 = Math.max(6, (baseW * 0.72) / cols3);
  const ph3 = Math.max(5, (baseH * 0.55) / rows3);
  for (let i = 0; i < (safePanels || 0); i += 1) {
    const row = Math.floor(i / cols3);
    const col = i % cols3;
    const x = baseX + 18 + col * (pw3 + 2);
    const y = baseY + baseH * 0.30 + row * (ph3 + 2);
    commands.push(
      "0.025 0.15 0.32 rg",
      x.toFixed(1) + " " + y.toFixed(1) + " " + pw3.toFixed(1) + " " + ph3.toFixed(1) + " re f",
      "0.35 0.75 1.00 RG",
      "0.35 w",
      x.toFixed(1) + " " + y.toFixed(1) + " " + pw3.toFixed(1) + " " + ph3.toFixed(1) + " re S",
    );
  }

  // Left information rail.
  commands.push(
    "BT /F2 19 Tf 0.98 0.98 0.98 rg 32 540 Td (RoofRay) Tj ET",
    "BT /F1 8 Tf 0.55 0.78 0.90 rg 32 525 Td (SOLAR FEASIBILITY REPORT) Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg 30 490 Td (Location Details) Tj ET",
    "BT /F1 8 Tf 0.75 0.82 0.88 rg 30 474 Td (" +
      text(centerLat.toFixed(5) + " N, " + centerLon.toFixed(5) + " E") + ") Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg 30 438 Td (System Overview) Tj ET",
    "BT /F1 8 Tf 0.78 0.84 0.90 rg 30 422 Td (Roof area) Tj ET",
    "BT /F2 11 Tf 0.98 0.98 0.98 rg 30 408 Td (" +
      text(roofAreaSqFt !== null ? "~" + Math.round(roofAreaSqFt) + " sq ft" : "Unavailable") + ") Tj ET",
    "BT /F1 8 Tf 0.78 0.84 0.90 rg 30 387 Td (Recommended capacity) Tj ET",
    "BT /F2 11 Tf 0.98 0.98 0.98 rg 30 373 Td (" +
      text(planningCapacity(panelCount, panelPowerW)) + ") Tj ET",
    "BT /F1 8 Tf 0.78 0.84 0.90 rg 30 352 Td (Panels) Tj ET",
    "BT /F2 11 Tf 0.98 0.98 0.98 rg 30 338 Td (" +
      text(String(safePanels || "Unavailable") + " x " + String(panelPowerW ?? 450) + " W") + ") Tj ET",
    "BT /F1 8 Tf 0.78 0.84 0.90 rg 30 317 Td (Direction / tilt) Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg 30 303 Td (" +
      text(String(direction || "Unavailable") + " / " +
        (slopeDeg !== null ? slopeDeg + " deg" : "Unavailable")) + ") Tj ET",
    "BT /F1 8 Tf 0.78 0.84 0.90 rg 30 282 Td (Roof type) Tj ET",
    "BT /F2 9 Tf 0.98 0.98 0.98 rg 30 268 Td (" + text(roofType || "Unavailable") + ") Tj ET",
    "BT /F2 9 Tf 0.98 0.98 0.98 rg 30 235 Td (Nearby shading) Tj ET",
  );

  sortedObstacles.slice(0, 4).forEach((o, i) => {
    const h = numberValue(o.heightMeters);
    const d = numberValue(o.distanceMeters);
    commands.push(
      "BT /F1 7 Tf 0.76 0.82 0.88 rg 30 " + (219 - i * 18) +
        " Td (" + text(
          (i + 1) + ". " + String(o.type ?? "building").slice(0, 18) +
          " | " + (h !== null ? "~" + h.toFixed(0) + "m" : "height ?") +
          " | " + (d !== null ? "~" + d.toFixed(0) + "m" : "distance ?"),
        ) + ") Tj ET",
    );
  });

  const monthlyText = roofAreaSqFt !== null ? "Input roof area used for planning." : "Mapped roof footprint used when available.";
  commands.push(
    "BT /F1 7 Tf 0.55 0.65 0.72 rg 30 120 Td (" + text(monthlyText) + ") Tj ET",
    "BT /F1 6 Tf 0.45 0.58 0.66 rg 30 102 Td (OSM footprint is not survey-grade; imagery availability varies.) Tj ET",
    "BT /F1 6 Tf 0.45 0.58 0.66 rg 30 88 Td (Satellite: Esri World Imagery | Map: OpenStreetMap.) Tj ET",
  );

  const letterhead = [
    "0.02 0.07 0.14 rg",
    "18 523 806 54 re f",
    "0.10 0.58 0.95 rg",
    "18 521 806 2 re f",
    "BT /F2 16 Tf 0.98 0.98 0.98 rg 150 551 Td (RoofRay Solar Feasibility Report) Tj ET",
    "BT /F1 7 Tf 0.68 0.82 0.95 rg 150 537 Td (LOCATION-BASED ROOFTOP SOLAR SITE ASSESSMENT) Tj ET",
    "BT /F1 6 Tf 0.70 0.78 0.86 rg 676 551 Td (CONFIDENTIAL) Tj ET",
  ];
  if (logoImage) {
    letterhead.push("q", "52 0 0 52 34 525 cm", "/RoofRayLogo Do", "Q");
  } else {
    letterhead.push("BT /F2 15 Tf 0.98 0.98 0.98 rg 34 551 Td (RoofRay) Tj ET");
  }

  return [
    ...commands,
    ...letterhead,
    "BT /F2 17 Tf 0.98 0.98 0.98 rg 190 503 Td (3D Building Map & Nearby Shading Analysis) Tj ET",
    "BT /F1 8 Tf 0.70 0.78 0.84 rg 190 490 Td (Real aerial imagery + 3D mapped buildings + roof panels + calculated sun path) Tj ET",
    "BT /F2 8 Tf 0.98 0.98 0.98 rg 208 470 Td (Blue = nearby mapped buildings | Bright blue = target roof | Yellow = sun path) Tj ET",
  ];
}

function planningCapacity(panelCount: number | null, panelPowerW: number | null) {
  const count = numberValue(panelCount);
  const power = numberValue(panelPowerW);
  if (count === null || power === null) return "Unavailable";
  return "~" + (count * power / 1000).toFixed(2) + " kW";
}

function buildPdf(lines: string[], visual: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
  roofFootprint: Record<string, unknown> | null;
  obstacles: Array<Record<string, unknown>>;
  sunCycle: Record<string, unknown> | null;
  mappedBuildings: MappedBuilding[];
  satelliteTiles: SatelliteTile[];
  roofPhoto: RoofPhoto | null;
  logoImage: LogoImage | null;
}): Uint8Array {
  const pageWidth = 842, pageHeight = 595, margin = 42, lineHeight = 15, linesPerPage = 32;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(["RoofRay Solar Feasibility Report"]);

  const visualPageIndex = pages.length;
  const totalPages = pages.length + 1;
  const logoObject = 5;
  const satelliteObjectStart = 6;
  const roofPhotoObject = satelliteObjectStart + visual.satelliteTiles.length;
  const pageObjectStart = satelliteObjectStart + visual.satelliteTiles.length + (visual.roofPhoto ? 1 : 0);
  const objects: Array<string | Buffer> = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" +
    Array.from({ length: totalPages }, (_, i) => (pageObjectStart + i * 2) + " 0 R").join(" ") +
    "] /Count " + totalPages + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  if (visual.logoImage) {
    const logo = visual.logoImage;
    objects.push(
      Buffer.concat([
        Buffer.from(
          "<< /Type /XObject /Subtype /Image /Width " + logo.width +
          " /Height " + logo.height +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length " +
          logo.bytes.length + " >>\\nstream\\n",
          "ascii",
        ),
        Buffer.from(logo.bytes),
        Buffer.from("\\nendstream", "ascii"),
      ]),
    );
  } else {
    objects.push(
      Buffer.from(
        "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length 3 >>\\nstream\\n\\x00\\x00\\x00\\nendstream",
        "binary",
      ),
    );
  }

  for (let i = 0; i < visual.satelliteTiles.length; i += 1) {
    const tile = visual.satelliteTiles[i];
    objects.push(
      Buffer.concat([
        Buffer.from(
          "<< /Type /XObject /Subtype /Image /Width " +
          tile.w +
          " /Height " +
          tile.h +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          tile.bytes.length +
          " >>\nstream\n",
          "ascii",
        ),
        Buffer.from(tile.bytes),
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  if (visual.roofPhoto) {
    const photo = visual.roofPhoto;
    objects.push(
      Buffer.concat([
        Buffer.from(
          "<< /Type /XObject /Subtype /Image /Width " + photo.width +
          " /Height " + photo.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          photo.bytes.length + " >>\nstream\n",
          "ascii",
        ),
        Buffer.from(photo.bytes),
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  for (let i = 0; i < totalPages; i += 1) {
    const pageObject = pageObjectStart + i * 2;
    const contentObject = pageObject + 1;
    const visualXObjects = visual.satelliteTiles.map((tile) =>
      "/" + tile.name + " " + (satelliteObjectStart + visual.satelliteTiles.indexOf(tile)) + " 0 R"
    ).join(" ");
    const xObjectEntries =
      " /XObject << /RoofRayLogo " + logoObject + " 0 R " +
      visualXObjects +
      (visual.roofPhoto ? " /RoofPhoto " + roofPhotoObject + " 0 R" : "") +
      " >>";
    const contentLines = i === visualPageIndex
      ? roofVisualCommands(visual)
      : [
        "0.02 0.07 0.14 rg",
        "0 535 842 60 re f",
        "0.10 0.58 0.95 rg",
        "0 533 842 2 re f",
        "q", "100 0 0 36 42 546 cm", "/RoofRayLogo Do", "Q",
        "BT", "/F2 16 Tf", "0.98 0.98 0.98 rg", "155 563 Td", "(RoofRay Solar Feasibility Report) Tj",
        "/F1 7 Tf", "0 -15 Td", "(LOCATION-BASED ROOFTOP SOLAR FEASIBILITY) Tj", "ET",
        "BT", "/F2 11 Tf", "0.02 0.07 0.14 rg", margin + " " + (pageHeight - 92) + " Td", "(Site Analysis Summary) Tj",
        "/F1 10 Tf", "0 -22 Td",
        ...pages[i].flatMap((line, index) => ["(" + text(line) + ") Tj", ...(index === pages[i].length - 1 ? [] : ["0 -" + lineHeight + " Td"])]),
        "ET",
        "0.10 0.58 0.95 rg", "42 34 758 1 re f",
        "BT", "/F1 7 Tf", "0.35 0.43 0.52 rg", "42 22 Td", "(RoofRay | Solar Feasibility Report | Preliminary planning estimate) Tj", "ET",
      ];

    const stream = contentLines.join("\n");
    objects[pageObject - 1] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight +
      "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>" + xObjectEntries +
      " >> /Contents " + contentObject + " 0 R >>";
    objects[contentObject - 1] = Buffer.from(
      "<< /Length " + Buffer.byteLength(stream, "utf8") + " >>\nstream\n" +
      stream + "\nendstream",
      "utf8",
    );
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (let i = 0; i < objects.length; i += 1) {
    offsets[i + 1] = byteOffset;
    const objectHeader = Buffer.from((i + 1) + " 0 obj\n", "ascii");
    const objectBody = typeof objects[i] === "string"
      ? Buffer.from(objects[i] as string, "utf8")
      : objects[i] as Buffer;
    const objectEnd = Buffer.from("\nendobj\n", "ascii");
    chunks.push(objectHeader, objectBody, objectEnd);
    byteOffset += objectHeader.length + objectBody.length + objectEnd.length;
  }

  const xrefOffset = byteOffset;
  const xrefParts: string[] = [
    "xref",
    "0 " + (objects.length + 1),
    "0000000000 65535 f ",
  ];
  for (let i = 1; i <= objects.length; i += 1) {
    xrefParts.push(String(offsets[i]).padStart(10, "0") + " 00000 n ");
  }
  xrefParts.push(
    "trailer",
    "<< /Size " + (objects.length + 1) + " /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  chunks.push(Buffer.from(xrefParts.join("\n") + "\n", "ascii"));
  return new Uint8Array(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfBody;
    const context = body.solarContext ?? {};
    const planning = (context.planningEstimate ?? {}) as Record<string, unknown>;
    const weather = (context.weather ?? {}) as Record<string, any>;
    const currentWeather = (weather.current ?? {}) as Record<string, unknown>;
    const dailyWeather = (weather.daily ?? {}) as Record<string, unknown>;
    const inputs = body.userInputs ?? {};

    const reportText = String(body.report ?? "");

    // Use the finished deterministic report as a fallback for older/partial
    // solarContext payloads. If the chat already showed a real number, the PDF
    // should not replace it with "Unavailable".
    const reportSize = reportNumber(reportText, /Recommended capacity:\s*~?([\\d,.]+)\\s*kW/i);
    const reportPanels = reportNumber(reportText, /Panels:\s*([\d,.]+)\s*[×x]/i);
    const reportMonthly = reportNumber(reportText, /Expected generation:\s*~?([\d,.]+)\s*kWh\/month/i);
    const reportAnnual = reportNumber(reportText, /\|\s*~?([\d,.]+)\s*kWh\/year/i);
    const reportShade = reportNumber(reportText, /Estimated shading:\s*~?([\d,.]+)%/i);
    const reportRoof = reportNumber(reportText, /Roof area:\s*~?([\d,.]+)\s*sq ft/i);
    const reportBill = reportNumber(reportText, /Current electricity bill:\s*₹?([\d,.]+)\s*\/month/i);

    const size = reportSize ?? numberValue(planning.systemSizeKw);
    const panels = reportPanels ?? numberValue(planning.panelCount);
    const monthly = reportMonthly ?? numberValue(planning.averageMonthlyGenerationKwh);
    const annual = reportAnnual ?? numberValue(planning.annualGenerationAfterEstimatedShadingKwh);
    const shade = reportShade ?? numberValue(planning.estimatedShadingPercent);
    const roof = reportRoof ?? numberValue(planning.roofAreaSqFt) ?? numberValue(inputs.roofAreaSqFt);
    const bill = reportBill ?? numberValue(inputs.monthlyBillInr);
    const resolvedLocation = resolveReportLocation(context, planning);
    const lat = resolvedLocation?.latitude ?? null;
    const lon = resolvedLocation?.longitude ?? null;

    // Never generate a fake map around 0,0. If a stale/legacy payload has no
    // real coordinates, the caller must refresh the solar analysis first.
    if (lat === null || lon === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Real roof location is missing from the report data. Please run Location Analysis again before generating the PDF.",
        },
        { status: 422 },
      );
    }

    let mappedBuildings = await fetchMappedBuildings(lat, lon);

    // Reuse the exact roof footprint already obtained during solar analysis when
    // the PDF's independent Overpass request is unavailable. This prevents a
    // valid mapped roof from turning into an empty 3D scene just because a
    // second map request timed out or hit an Overpass rate limit.
    if (!mappedBuildings.length) {
      const contextRoof = (context.roof ?? null) as Record<string, unknown> | null;
      const fallbackRoof = mappedBuildingFromRoofContext(contextRoof, lat, lon);
      if (fallbackRoof) mappedBuildings = [fallbackRoof];
    }

    // Final visual fallback: when neither Overpass nor the saved OSM roof
    // context has a polygon, create a clearly labelled planning footprint
    // from the user's entered roof area. This keeps the real GPS location
    // visible without falsely claiming that the rectangle is an OSM-mapped
    // house.
    if (!mappedBuildings.length) {
      const planningAreaSqFt =
        numberValue((body.userInputs ?? {}).roofAreaSqFt) ??
        numberValue(planning.roofAreaSqFt);
      const planningBuilding = planningBuildingFromRoofArea(
        planningAreaSqFt,
        lat,
        lon,
      );
      if (planningBuilding) mappedBuildings = [planningBuilding];
    }

    const satelliteTiles = await fetchSatelliteTiles(lat, lon);
    const roofPhoto = decodeJpegDataUrl(
      body.userInputs?.roofPhotoDataUrl ?? body.roofPhotoDataUrl,
    );
    let logoImage: LogoImage | null = null;
    try {
      const logoPath = join(process.cwd(), "public", "Logo-removebg-preview.png");
      logoImage = decodeRoofRayLogo(new Uint8Array(await readFile(logoPath)));
    } catch (logoError) {
      console.warn("[RoofRay] Report logo could not be loaded:", logoError);
    }
    console.info("[RoofRay] PDF visual data", {
      latitude: lat,
      longitude: lon,
      mappedBuildings: mappedBuildings.length,
      targetBuildingMapped: mappedBuildings.some((building) => building.containsTarget),
      satelliteTiles: satelliteTiles.length,
      roofPhoto: Boolean(roofPhoto),
      roofRayLogo: Boolean(logoImage),
    });
    const dailyGeneration = numberValue(planning.averageDailyGenerationKwh);
    const monthlyGeneration = Array.isArray(planning.monthlyGenerationKwh)
      ? planning.monthlyGenerationKwh as Array<Record<string, unknown>>
      : [];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const lines = [
      "Generated from the final RoofRay site analysis.",
      "",
      ...wrap(`Customer: ${inputs.name ?? "Not provided"}`),
      ...wrap(`Location: ${lat !== null && lon !== null ? lat.toFixed(5) + ", " + lon.toFixed(5) : "Detected location"}`),
      ...wrap(`Roof area: ${roof !== null ? roof + " sq ft" : "Not provided"}`),
      ...wrap(`Roof type: ${inputs.roofType ?? "Not provided"}`),
      ...wrap(`Monthly electricity bill: ${bill !== null ? "Rs. " + Math.round(bill) : "Not provided"}`),
      "",
      "Solar feasibility",
      ...wrap(`Recommended system size: ${size !== null ? size.toFixed(2) + " kW" : "Not provided"}`),
      ...wrap(`Estimated panels: ${panels !== null ? Math.round(panels) : "Not provided"}`),
      ...wrap(`Estimated generation: ${monthly !== null ? monthly + " kWh/month" : "Not provided"}${annual !== null ? " | " + annual + " kWh/year" : ""}`),
      ...wrap(`Average expected generation: ${dailyGeneration !== null ? dailyGeneration.toFixed(1) + " kWh/day" : "Unavailable"}`),
      ...wrap(`Estimated shading: ${shade !== null ? shade.toFixed(1) + "%" : "Not provided"}`),
      "",
      "Expected monthly generation",
      ...monthlyGeneration.map((item) => {
        const month = numberValue(item.month);
        const expected = numberValue(item.expectedKwh);
        const averageDaily = numberValue(item.averageDailyKwh);
        if (month === null || expected === null) return "";
        const label = monthNames[Math.max(1, Math.min(12, Math.round(month))) - 1];
        return `${label}: ~${Math.round(expected)} kWh/month${averageDaily !== null ? ` (~${averageDaily.toFixed(1)} kWh/day)` : ""}`;
      }).filter(Boolean),
      ...wrap(`Solar direction: ${planning.recommendedDirection ?? "Unavailable"}`),
      ...wrap(`Recommended slope: ${numberValue(planning.recommendedSlopeDeg) !== null ? numberValue(planning.recommendedSlopeDeg) + " deg" : "Unavailable"}`),
      "",
      "Weather and solar conditions",
      ...wrap(`Current temperature: ${numberValue(currentWeather.temperatureC) !== null ? currentWeather.temperatureC + " C" : "Unavailable"}`),
      ...wrap(`Cloud cover: ${numberValue(currentWeather.cloudCoverPercent) !== null ? currentWeather.cloudCoverPercent + "%" : "Unavailable"}`),
      ...wrap(`Current solar radiation: ${numberValue(currentWeather.shortwaveRadiationWm2) !== null ? currentWeather.shortwaveRadiationWm2 + " W/m2" : "Unavailable"}`),
      ...wrap(`Direct normal irradiance: ${numberValue(currentWeather.directNormalIrradianceWm2) !== null ? currentWeather.directNormalIrradianceWm2 + " W/m2" : "Unavailable"}`),
      ...wrap(`Sunrise: ${dailyWeather.sunrise ?? "Unavailable"}`),
      ...wrap(`Sunset: ${dailyWeather.sunset ?? "Unavailable"}`),
      ...wrap(`Daylight duration: ${dailyWeather.daylightDurationHours ?? "Unavailable"} hours`),
      "",
      "Report summary",
      ...wrap(body.report ?? "RoofRay report unavailable."),
      "",
      "Planning note: These are location-based planning estimates. Final panel layout, structure, electrical design and shading assessment require a physical site assessment.",
      "Data sources: OpenStreetMap Overpass, RoofRay sun-position calculation, Open-Meteo and PVGIS.",
    ];

    const pdf = buildPdf(lines, {
      roofAreaSqFt: roof,
      roofType: String(inputs.roofType ?? "Roof type unavailable"),
      panelCount: panels,
      panelPowerW: numberValue(planning.panelPowerW) ?? 450,
      direction: String(planning.recommendedDirection ?? "Unavailable"),
      slopeDeg: numberValue(planning.recommendedSlopeDeg),
      roofFootprint: (context.roof ?? null) as Record<string, unknown> | null,
      obstacles: Array.isArray((context.obstacles as Record<string, unknown> | undefined)?.obstacles)
        ? ((context.obstacles as Record<string, unknown>).obstacles as Array<Record<string, unknown>>)
        : [],
      sunCycle: (context.sunCycle ?? null) as Record<string, unknown> | null,
      mappedBuildings,
      satelliteTiles,
      roofPhoto,
      logoImage,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="RoofRay-Solar-Report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[RoofRay] PDF generation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to generate the PDF report." }, { status: 500 });
  }
}
