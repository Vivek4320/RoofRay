import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";

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
};

type SatelliteTile = {
  name: string;
  bytes: Uint8Array;
  x: number;
  y: number;
  w: number;
  h: number;
};

type RoofAerialImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  source: "mappls" | "esri";
};

type RoofPhoto = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

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

async function fetchMapplsStillImage(
  latitude: number,
  longitude: number,
): Promise<RoofAerialImage | null> {
  const restKey = process.env.MAPPLS_REST_KEY;
  if (!restKey) return null;

  const urls = [
    "https://apis.mapmyindia.com/advancedmaps/v1/" +
      encodeURIComponent(restKey) +
      "/still_image?center=" +
      encodeURIComponent(latitude + "," + longitude) +
      "&zoom=18&size=1000x700&ssf=1&markers=" +
      encodeURIComponent(latitude + "," + longitude),
    "https://apis.mappls.com/advancedmaps/v1/" +
      encodeURIComponent(restKey) +
      "/still_image?center=" +
      encodeURIComponent(latitude + "," + longitude) +
      "&zoom=18&size=1000x700&ssf=1&markers=" +
      encodeURIComponent(latitude + "," + longitude),
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("image")) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1000) continue;
      return { bytes, width: 1000, height: 700, source: "mappls" };
    } catch {
      // Try the next Mappls host, then fall back to Esri imagery.
    }
  }
  return null;
}

function satelliteTileFingerprint(bytes: Uint8Array): string {
  // We do not need to decode JPEGs server-side. Esri's no-imagery response
  // is commonly the same placeholder image repeated across the whole tile
  // window. Sampling deterministic byte positions lets us reject a window
  // made entirely from identical placeholder tiles while keeping real
  // satellite imagery fast.
  if (bytes.length < 1200) return "tiny";
  const positions = [
    2,
    Math.floor(bytes.length * 0.1),
    Math.floor(bytes.length * 0.25),
    Math.floor(bytes.length * 0.5),
    Math.floor(bytes.length * 0.75),
    bytes.length - 3,
  ];
  return positions.map((p) => bytes[Math.max(0, Math.min(bytes.length - 1, p))]).join(",");
}

async function fetchSatelliteTiles(
  latitude: number,
  longitude: number,
  zoom = 19,
): Promise<SatelliteTile[]> {
  const center = webMercatorPixel(latitude, longitude, zoom);
  const centerTileX = Math.floor(center.x / 256);
  const centerTileY = Math.floor(center.y / 256);
  const startX = centerTileX - 2;
  const startY = centerTileY - 1;
  const hosts = [
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile",
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile",
  ];
  const tiles: SatelliteTile[] = [];
  const jobs: Array<Promise<void>> = [];

  // Five columns x three rows gives a wider high-resolution site window
  // around the exact GPS coordinate. The renderer scales this complete
  // mosaic into the PDF map frame.
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const tileX = startX + col;
      const tileY = startY + row;
      jobs.push(
        (async () => {
          for (const host of hosts) {
            const url = host + "/" + zoom + "/" + tileY + "/" + tileX;
            try {
              const response = await fetch(url, {
                cache: "no-store",
                headers: { Accept: "image/jpeg,image/*" },
                signal: AbortSignal.timeout(10000),
              });
              if (!response.ok) continue;
              const bytes = new Uint8Array(await response.arrayBuffer());
              if (bytes.length < 1000) continue;
              tiles.push({
                name: "ImSat" + row + "_" + col,
                bytes,
                // Keep source-image coordinates in ordinary screen order:
                // row 0 is the northern/top row.
                x: col * 256,
                y: row * 256,
                w: 256,
                h: 256,
              });
              return;
            } catch {
              // Try the next imagery host.
            }
          }
        })(),
      );
    }
  }

  await Promise.all(jobs);

  // Do not accept an entire mosaic made from the same "Map data not
  // available" placeholder. A successful HTTP 200 alone is not evidence
  // that satellite imagery exists at this zoom level.
  const fingerprints = new Set(
    tiles.map((tile) => satelliteTileFingerprint(tile.bytes)),
  );
  if (tiles.length >= 8 && fingerprints.size < Math.min(3, tiles.length)) {
    console.warn("[RoofRay] Satellite tile window appears to be placeholder imagery", {
      zoom,
      tiles: tiles.length,
      uniqueTileFingerprints: fingerprints.size,
    });
    return [];
  }

  return tiles.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchRoofAerialImage(
  latitude: number,
  longitude: number,
): Promise<RoofAerialImage | null> {
  const mappls = await fetchMapplsStillImage(latitude, longitude);
  if (mappls) return mappls;

  for (const zoom of [20, 19, 18, 17]) {
    const tiles = await fetchSatelliteTiles(latitude, longitude, zoom);
    if (tiles.length >= 4) {
      // Keep the existing tile renderer as the fallback path.
      return null;
    }
  }
  return null;
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


type PanelRect = { x: number; y: number; w: number; h: number };

function fitPanelsToPolygon(
  polygon: Array<{ x: number; y: number }>,
  requestedPanels: number,
): PanelRect[] {
  if (polygon.length < 3 || requestedPanels <= 0) return [];

  const minX = Math.min(...polygon.map((p) => p.x));
  const maxX = Math.max(...polygon.map((p) => p.x));
  const minY = Math.min(...polygon.map((p) => p.y));
  const maxY = Math.max(...polygon.map((p) => p.y));
  const roofW = maxX - minX;
  const roofH = maxY - minY;
  if (roofW < 8 || roofH < 8) return [];

  const target = Math.min(40, Math.max(1, Math.round(requestedPanels)));
  const aspect = 1.72;
  let best: PanelRect[] = [];

  // Try several real rectangular panel-grid configurations. A panel is
  // accepted only when all four corners are inside the mapped roof polygon.
  // This prevents panels from being drawn over roads/outside the roof.
  for (const rotated of [false, true]) {
    for (let cols = 1; cols <= Math.min(12, target); cols += 1) {
      const rows = Math.ceil(target / cols);
      const gap = Math.max(1.2, Math.min(3.5, Math.min(roofW, roofH) * 0.035));
      const usableW = roofW * 0.86;
      const usableH = roofH * 0.86;
      const cellW = usableW / cols;
      const cellH = usableH / rows;
      let panelW = rotated ? cellH * aspect : cellW * 0.82;
      let panelH = rotated ? cellW / aspect : cellH * 0.82;

      if (rotated) {
        panelW = Math.min(panelW, cellW * 0.82);
        panelH = Math.min(panelH, cellH * 0.82);
      } else {
        const ratio = panelW / Math.max(panelH, 1);
        if (ratio > aspect) panelW = panelH * aspect;
        else panelH = panelW / aspect;
      }

      panelW = Math.max(4.5, panelW);
      panelH = Math.max(3.5, panelH);

      const rects: PanelRect[] = [];
      const startX = minX + roofW * 0.07 + Math.max(0, (cellW - panelW) / 2);
      const startY = minY + roofH * 0.07 + Math.max(0, (cellH - panelH) / 2);

      for (let row = 0; row < rows && rects.length < target; row += 1) {
        for (let col = 0; col < cols && rects.length < target; col += 1) {
          const x = startX + col * cellW;
          const y = startY + row * cellH;
          const corners = [
            { x, y },
            { x: x + panelW, y },
            { x: x + panelW, y: y + panelH },
            { x, y: y + panelH },
          ];
          if (corners.every((corner) => pointInPolygon(corner, polygon))) {
            rects.push({ x, y, w: panelW, h: panelH });
          }
        }
      }

      if (
        rects.length > best.length ||
        (rects.length === best.length && rects.length > 0 &&
          rects[0].w * rects[0].h > best[0].w * best[0].h)
      ) {
        best = rects;
      }
      if (best.length >= target) return best;
    }
  }

  return best;
}

function bingQuadKey(latitude: number, longitude: number, level = 9): string {
  const n = 2 ** level;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const sinLat = Math.sin((latitude * Math.PI) / 180);
  const y = Math.floor(
    ((0.5 - Math.log((1 + sinLat) / Math.max(1e-12, 1 - sinLat)) / (4 * Math.PI)) * n),
  );
  let quadKey = "";
  for (let i = level; i > 0; i -= 1) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if (x & mask) digit += 1;
    if (y & mask) digit += 2;
    quadKey += String(digit);
  }
  return quadKey;
}

function parseSimpleCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

function neighboringQuadKeys(latitude: number, longitude: number, level = 9): string[] {
  const n = 2 ** level;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const sinLat = Math.sin((latitude * Math.PI) / 180);
  const y = Math.floor(
    (0.5 - Math.log((1 + sinLat) / Math.max(1e-12, 1 - sinLat)) / (4 * Math.PI)) * n,
  );
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = Math.max(0, Math.min(n - 1, x + dx));
      const ny = Math.max(0, Math.min(n - 1, y + dy));
      let key = "";
      for (let i = level; i > 0; i -= 1) {
        const mask = 1 << (i - 1);
        let digit = 0;
        if (nx & mask) digit += 1;
        if (ny & mask) digit += 2;
        key += String(digit);
      }
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

async function fetchMicrosoftBuildingFootprints(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Promise<Array<{
  polygon: Array<{ latitude: number; longitude: number }>;
  heightMeters: number;
}>> {
  try {
    const linksUrl = "https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv";
    const linksResponse = await fetch(linksUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!linksResponse.ok) {
      console.warn("[RoofRay] Microsoft links HTTP", linksResponse.status);
      return [];
    }

    const lines = (await linksResponse.text()).split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];

    const header = parseSimpleCsvLine(lines[0]).map((value) => value.toLowerCase());
    const locationIndex = header.indexOf("location");
    const quadIndex = header.indexOf("quadkey");
    const urlIndex = header.indexOf("url");
    if (locationIndex < 0 || quadIndex < 0 || urlIndex < 0) {
      console.warn("[RoofRay] Microsoft links CSV headers not found", header);
      return [];
    }

    const rows = new Map<string, string>();
    for (let i = 1; i < lines.length; i += 1) {
      const fields = parseSimpleCsvLine(lines[i]);
      const location = fields[locationIndex]?.toLowerCase();
      const quad = fields[quadIndex];
      const url = fields[urlIndex];
      if (location === "india" && quad && url) rows.set(quad, url);
    }

    const quadKeys = neighboringQuadKeys(latitude, longitude, 9);
    console.info("[RoofRay] Microsoft footprint lookup", {
      quadKey: bingQuadKey(latitude, longitude, 9),
      candidateTiles: quadKeys.length,
      matchedTiles: quadKeys.filter((key) => rows.has(key)).length,
    });

    const latDelta = radiusMeters / 111320;
    const lonDelta = radiusMeters / Math.max(1, 111320 * Math.cos((latitude * Math.PI) / 180));
    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;

    const results: Array<{
      polygon: Array<{ latitude: number; longitude: number }>;
      heightMeters: number;
    }> = [];

    const orderedQuadKeys = [
      quadKeys.find((key) => key === bingQuadKey(latitude, longitude, 9)) ?? quadKeys[0],
      ...quadKeys.filter((key) => key !== bingQuadKey(latitude, longitude, 9)),
    ];

    for (const quadKey of orderedQuadKeys) {
      const dataUrl = rows.get(quadKey);
      if (!dataUrl) continue;

      try {
        console.info("[RoofRay] Microsoft footprint tile download", { quadKey });
        const dataResponse = await fetch(dataUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(
            quadKey === bingQuadKey(latitude, longitude, 9) ? 90000 : 30000,
          ),
        });
        if (!dataResponse.ok) {
          console.warn("[RoofRay] Microsoft footprint tile HTTP", {
            quadKey,
            status: dataResponse.status,
          });
          continue;
        }

        const compressed = Buffer.from(await dataResponse.arrayBuffer());
        const raw = gunzipSync(compressed).toString("utf8");
        let parsedFeatures = 0;
        let nearbyFeatures = 0;

        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim()) continue;
          try {
            const feature = JSON.parse(line) as {
              geometry?: { type?: string; coordinates?: unknown };
              properties?: Record<string, unknown>;
            };
            parsedFeatures += 1;
            const geometry = feature.geometry;
            if (!geometry?.coordinates) continue;

            let ring: unknown[] | null = null;
            if (geometry.type === "Polygon") {
              const coordinates = geometry.coordinates as unknown[];
              ring = Array.isArray(coordinates?.[0]) ? coordinates[0] as unknown[] : null;
            } else if (geometry.type === "MultiPolygon") {
              const polygons = geometry.coordinates as unknown[];
              const firstPolygon = polygons.find(
                (polygon) => Array.isArray(polygon) && Array.isArray((polygon as unknown[])[0]),
              );
              ring = firstPolygon ? (firstPolygon as unknown[])[0] as unknown[] : null;
            }
            if (!ring || ring.length < 4) continue;

            const polygon = ring
              .map((point) =>
                Array.isArray(point)
                  ? { longitude: Number(point[0]), latitude: Number(point[1]) }
                  : null,
              )
              .filter(
                (point): point is { latitude: number; longitude: number } =>
                  point !== null &&
                  Number.isFinite(point.latitude) &&
                  Number.isFinite(point.longitude),
              );
            if (polygon.length < 4) continue;

            const pMinLat = Math.min(...polygon.map((p) => p.latitude));
            const pMaxLat = Math.max(...polygon.map((p) => p.latitude));
            const pMinLon = Math.min(...polygon.map((p) => p.longitude));
            const pMaxLon = Math.max(...polygon.map((p) => p.longitude));
            if (
              pMaxLat < minLat || pMinLat > maxLat ||
              pMaxLon < minLon || pMinLon > maxLon
            ) continue;

            const rawHeight = Number(
              feature.properties?.height ??
              feature.properties?.Height ??
              feature.properties?.height_m ??
              feature.properties?.heightMeters ??
              -1,
            );
            const heightMeters =
              Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 6;

            results.push({ polygon, heightMeters });
            nearbyFeatures += 1;
            if (results.length >= 120) break;
          } catch {
            // Ignore malformed GeoJSONL records.
          }
        }

        console.info("[RoofRay] Microsoft footprint tile parsed", {
          quadKey,
          parsedFeatures,
          nearbyFeatures,
          compressedBytes: compressed.length,
        });

        // The center tile is the only tile expected to contain the exact GPS
        // neighbourhood. Stop immediately once it produced buildings.
        if (nearbyFeatures > 0 || results.length >= 120) break;
      } catch (error) {
        console.warn("[RoofRay] Microsoft footprint tile failed", {
          quadKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  } catch (error) {
    console.warn("[RoofRay] Microsoft building footprint fallback failed:", error);
    return [];
  }
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
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        cache: "no-store",
        signal: AbortSignal.timeout(18000),
      });
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
      // Try the next public Overpass endpoint.
    }
  }

  if (!data || !Array.isArray(data.elements) || data.elements.length === 0) {
    const microsoftBuildings = await fetchMicrosoftBuildingFootprints(
      latitude,
      longitude,
      safeRadius,
    );
    const mLat = 111320;
    const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
    const polygonArea = (points: Array<{ x: number; y: number }>) => {
      let sum = 0;
      for (let i = 0; i < points.length; i += 1) {
        const n = points[(i + 1) % points.length];
        sum += points[i].x * n.y - n.x * points[i].y;
      }
      return Math.abs(sum) / 2;
    };
    return microsoftBuildings
      .map((building) => {
        const projected = building.polygon.map((p) => ({
          x: (p.longitude - longitude) * mLon,
          y: (p.latitude - latitude) * mLat,
        }));
        const containsTarget = pointInPolygon({ x: 0, y: 0 }, projected);
        const centroid = projected.reduce(
          (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
          { x: 0, y: 0 },
        );
        if (projected.length) {
          centroid.x /= projected.length;
          centroid.y /= projected.length;
        }
        return {
          polygon: building.polygon,
          areaM2: polygonArea(projected),
          containsTarget,
          distanceMeters: Math.hypot(centroid.x, centroid.y),
          heightMeters: Math.max(3, building.heightMeters),
          levels: Math.max(1, Math.round(building.heightMeters / 3)),
        };
      })
      .filter((item) => item.areaM2 >= 12 && item.areaM2 <= 100000)
      .sort((a, b) => {
        if (a.containsTarget !== b.containsTarget) return a.containsTarget ? -1 : 1;
        return a.distanceMeters - b.distanceMeters;
      })
      .slice(0, 40);
  }

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

  const mappedBuildings = (data.elements ?? [])
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

  if (mappedBuildings.length > 0) return mappedBuildings;

  // OSM can return successfully while having no building polygons in this
  // neighbourhood. Fall back to Microsoft's satellite-derived footprints.
  const microsoftBuildings = await fetchMicrosoftBuildingFootprints(
    latitude,
    longitude,
    safeRadius,
  );
  const mLatFallback = 111320;
  const mLonFallback = 111320 * Math.cos((latitude * Math.PI) / 180);
  const fallbackArea = (points: Array<{ x: number; y: number }>) => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const n = points[(i + 1) % points.length];
      sum += points[i].x * n.y - n.x * points[i].y;
    }
    return Math.abs(sum) / 2;
  };
  return microsoftBuildings
    .map((building) => {
      const projected = building.polygon.map((p) => ({
        x: (p.longitude - longitude) * mLonFallback,
        y: (p.latitude - latitude) * mLatFallback,
      }));
      const containsTarget = pointInPolygon({ x: 0, y: 0 }, projected);
      const centroid = projected.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      if (projected.length) {
        centroid.x /= projected.length;
        centroid.y /= projected.length;
      }
      return {
        polygon: building.polygon,
        areaM2: fallbackArea(projected),
        containsTarget,
        distanceMeters: Math.hypot(centroid.x, centroid.y),
        heightMeters: Math.max(3, building.heightMeters),
        levels: Math.max(1, Math.round(building.heightMeters / 3)),
      };
    })
    .filter((item) => item.areaM2 >= 12 && item.areaM2 <= 100000)
    .sort((a, b) => {
      if (a.containsTarget !== b.containsTarget) return a.containsTarget ? -1 : 1;
      return a.distanceMeters - b.distanceMeters;
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
  roofAerialImage,
  roofPhoto,
  reportLocation,
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
  roofAerialImage: RoofAerialImage | null;
  roofPhoto: RoofPhoto | null;
  reportLocation: { latitude: number; longitude: number };
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
    mappedBuildings
      .filter((building) => building.distanceMeters <= 150)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ??
    null;
  const actualRoofPolygon =
    roofPolygon.length >= 3 ? roofPolygon : (mappedTarget?.polygon ?? []);

  // The resolved report GPS is authoritative for every visual layer.
  // Never let a stale/legacy roof object containing 0,0 recenter the PDF.
  const centerLat = reportLocation.latitude;
  const centerLon = reportLocation.longitude;

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
  const mapY = 250;
  const mapW = 634;
  const mapH = 310;

  // Use a local metre projection for the PDF scene. This is more
  // reliable than a fixed Web-Mercator tile window because Microsoft
  // footprints can span a different tile extent than the imagery window.
  const metersLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const metersLat = 111320;
  const scenePoints = mappedBuildings.flatMap((building) =>
    building.polygon.map((point) => ({
      x: (point.longitude - centerLon) * metersLon,
      y: (point.latitude - centerLat) * metersLat,
    })),
  );
  const maxSceneDistance = Math.max(
    120,
    ...scenePoints.map((point) => Math.hypot(point.x, point.y)),
  );
  const sceneScale = Math.min(mapW - 28, mapH - 28) / (2 * maxSceneDistance * 1.08);

  const project = (lat: number, lon: number) => {
    const xMeters = (lon - centerLon) * metersLon;
    const yMeters = (lat - centerLat) * metersLat;
    return {
      x: mapX + mapW / 2 + xMeters * sceneScale,
      y: mapY + mapH / 2 - yMeters * sceneScale,
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

  // The PDF site-view is intentionally a clean map-style 3D diagram:
  // white/grey buildings, blue target house, amber taller neighbours.
  // Satellite imagery is kept out of this panel so the geometry remains
  // visually clear and matches the interactive 3D building-map experience.
  commands.push(
    "0.94 0.95 0.96 rg",
    (mapX + 2).toFixed(1) + " " + (mapY + 2).toFixed(1) + " " + (mapW - 4).toFixed(1) + " " + (mapH - 4).toFixed(1) + " re f",
  );

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
  }

  commands.push(
    "0.20 0.85 1.00 RG",
    "1.5 w",
    mapX + " " + mapY + " " + mapW + " " + mapH + " re S",
  );

  // Real-location 3D site model: every mapped OSM building is extruded from
  // its actual footprint. Height comes from OSM height/building:levels, with
  // 3m per level as the documented fallback. This is a map-based 3D
  // visualization, not a photogrammetric claim.
  const sceneBuildings = (roofPhoto ? [] : mappedBuildings)
    .filter((building) => building.polygon.length >= 3)
    .sort((a, b) => {
      if (a.containsTarget !== b.containsTarget) return a.containsTarget ? -1 : 1;
      return b.heightMeters - a.heightMeters;
    })
    .slice(0, 32);

  const projectGround = (point: { latitude: number; longitude: number }) =>
    project(point.latitude, point.longitude);

  for (const building of sceneBuildings) {
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
        building === mappedTarget || building.containsTarget
          ? "0.18 0.45 0.95 rg"
          : building.heightMeters >= 10
            ? "0.96 0.55 0.08 rg"
            : "0.78 0.80 0.82 rg",
        face[0].x.toFixed(1) + " " + face[0].y.toFixed(1) + " m",
        face[1].x.toFixed(1) + " " + face[1].y.toFixed(1) + " l",
        face[2].x.toFixed(1) + " " + face[2].y.toFixed(1) + " l",
        face[3].x.toFixed(1) + " " + face[3].y.toFixed(1) + " l h f",
      );
    }

    // Roof surface follows the real mapped polygon.
    commands.push(
      building === mappedTarget || building.containsTarget
        ? "0.30 0.62 1.00 rg"
        : building.heightMeters >= 10
          ? "1.00 0.67 0.18 rg"
          : "0.93 0.94 0.95 rg",
      building === mappedTarget || building.containsTarget
        ? "0.05 0.28 0.72 RG"
        : building.heightMeters >= 10
          ? "0.80 0.36 0.02 RG"
          : "0.72 0.74 0.76 RG",
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
      const label = building.containsTarget ? "YOUR HOUSE" : "NEAREST MAPPED BUILDING";
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

  // Exact GPS house marker. This is rendered independently from OSM
  // building coverage, so the report always shows where the user's device
  // actually reported the house location.
  const gpsHousePoint = project(centerLat, centerLon);
  commands.push(
    "0.10 0.55 1.00 rg",
    (gpsHousePoint.x - 7).toFixed(1) + " " + (gpsHousePoint.y - 7).toFixed(1) + " 14 14 re f",
    "0.98 0.98 1.00 RG",
    "1.5 w",
    (gpsHousePoint.x - 7).toFixed(1) + " " + (gpsHousePoint.y - 7).toFixed(1) + " 14 14 re S",
    "0.03 0.08 0.13 rg",
    (gpsHousePoint.x + 10).toFixed(1) + " " + (gpsHousePoint.y + 6).toFixed(1) + " 88 18 re f",
    "BT /F2 7 Tf 0.98 0.98 1.00 rg " +
      (gpsHousePoint.x + 14).toFixed(1) + " " + (gpsHousePoint.y + 12).toFixed(1) +
      " Td (YOUR HOUSE) Tj ET",
    "BT /F1 5.5 Tf 0.80 0.92 0.98 rg " +
      (gpsHousePoint.x + 14).toFixed(1) + " " + (gpsHousePoint.y + 3).toFixed(1) +
      " Td (" + (mappedTarget ? "Mapped building + GPS point" : "GPS point - building footprint unavailable") + ") Tj ET",

  // Prominent location pin: exact device GPS, placed over the target house
  // whenever the mapped target is close enough to the GPS point.
  const pinPoint = gpsHousePoint;
  commands.push(
    "0.90 0.12 0.12 rg",
    (pinPoint.x - 6).toFixed(1) + " " + (pinPoint.y - 4).toFixed(1) + " 12 12 re f",
    "0.98 0.98 1.00 RG",
    "1.2 w",
    (pinPoint.x - 6).toFixed(1) + " " + (pinPoint.y - 4).toFixed(1) + " 12 12 re S",
    "0.90 0.12 0.12 rg",
    (pinPoint.x - 2.5).toFixed(1) + " " + (pinPoint.y - 11).toFixed(1) + " m",
    (pinPoint.x + 2.5).toFixed(1) + " " + (pinPoint.y - 11).toFixed(1) + " l",
    pinPoint.x.toFixed(1) + " " + (pinPoint.y - 18).toFixed(1) + " l h f",
    "BT /F2 6.5 Tf 0.98 0.98 1.00 rg " +
      (pinPoint.x + 10).toFixed(1) + " " + (pinPoint.y + 2).toFixed(1) +
      " Td (GPS LOCATION) Tj ET",
  );

  );

  // Actual mapped target roof outline + geometry-validated panel placement.
  // Panels are generated only from the detected roof polygon; no generic
  // rectangle is used as a substitute for the real roof.
  if (roofPoints.length >= 3) {
    commands.push(
      "0.20 0.90 1.00 RG",
      "2.8 w",
      roofPoints[0].x.toFixed(1) + " " + roofPoints[0].y.toFixed(1) + " m",
    );
    for (let i = 1; i < roofPoints.length; i += 1) {
      commands.push(roofPoints[i].x.toFixed(1) + " " + roofPoints[i].y.toFixed(1) + " l");
    }
    commands.push("h S");

    const fittedPanels = fitPanelsToPolygon(roofPoints, safePanels);
    for (const panel of fittedPanels) {
      commands.push(
        "0.02 0.17 0.34 rg",
        panel.x.toFixed(1) + " " + panel.y.toFixed(1) + " " +
          panel.w.toFixed(1) + " " + panel.h.toFixed(1) + " re f",
        "0.35 0.82 1.00 RG",
        "0.55 w",
        panel.x.toFixed(1) + " " + panel.y.toFixed(1) + " " +
          panel.w.toFixed(1) + " " + panel.h.toFixed(1) + " re S",
      );
    }

    const houseCenter = {
      x: roofPoints.reduce((sum, p) => sum + p.x, 0) / roofPoints.length,
      y: roofPoints.reduce((sum, p) => sum + p.y, 0) / roofPoints.length,
    };
    commands.push(
      "0.10 0.55 1.00 rg",
      (houseCenter.x - 5).toFixed(1) + " " + (houseCenter.y - 5).toFixed(1) + " 10 10 re f",
      "0.05 0.12 0.20 rg",
      (houseCenter.x + 5).toFixed(1) + " " + (houseCenter.y + 4).toFixed(1) + " 92 18 re f",
      "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
        (houseCenter.x + 9).toFixed(1) + " " + (houseCenter.y + 8).toFixed(1) +
        " Td (Mapped roof - " + fittedPanels.length + " panels fit) Tj ET",
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

    for (const building of sceneBuildings) {
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
      const pixelsPerMeterX = mapW / (1280 * metersPerPixel);
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
    // Yellow dashed sight lines make the solar direction and the potential
    // shadow direction immediately readable in the aerial map.
    commands.push(
      "1.00 0.62 0.00 RG",
      "1.1 w",
      "[4 3] 0 d",
    );
    for (const point of sunPoints.filter((_, index) => index === 0 || index === Math.floor(sunPoints.length / 2) || index === sunPoints.length - 1)) {
      commands.push(
        gpsHousePoint.x.toFixed(1) + " " + gpsHousePoint.y.toFixed(1) + " m",
        point.x.toFixed(1) + " " + point.y.toFixed(1) + " l S",
      );
    }
    commands.push("[] 0 d");

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

  // Technical 3D site-view legend: blue = target house, amber = taller
  // nearby buildings that may contribute to shading, grey = other mapped
  // buildings, yellow = calculated sun direction/path.
  const legendX = mapX + 14;
  const legendY = mapY + mapH - 74;
  commands.push(
    "0.02 0.05 0.08 rg",
    legendX.toFixed(1) + " " + legendY.toFixed(1) + " 174 58 re f",
    "0.10 0.55 1.00 rg",
    (legendX + 8).toFixed(1) + " " + (legendY + 37).toFixed(1) + " 10 10 re f",
    "BT /F1 6.5 Tf 0.98 0.98 0.98 rg " + (legendX + 24).toFixed(1) + " " + (legendY + 39).toFixed(1) + " Td (Your house / GPS) Tj ET",
    "0.92 0.63 0.22 rg",
    (legendX + 8).toFixed(1) + " " + (legendY + 21).toFixed(1) + " 10 10 re f",
    "BT /F1 6.5 Tf 0.98 0.98 0.98 rg " + (legendX + 24).toFixed(1) + " " + (legendY + 23).toFixed(1) + " Td (Nearby tall building / shading risk) Tj ET",
    "1.00 0.62 0.00 RG",
    "2 w",
    (legendX + 8).toFixed(1) + " " + (legendY + 8).toFixed(1) + " m",
    (legendX + 18).toFixed(1) + " " + (legendY + 8).toFixed(1) + " l S",
    "BT /F1 6.5 Tf 0.98 0.98 0.98 rg " + (legendX + 24).toFixed(1) + " " + (legendY + 6).toFixed(1) + " Td (Sun direction / rays) Tj ET",
  );

  // North compass and a compact 3D-view orientation marker.
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
  const cardY = 30;
  const cardH = 198;
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
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (cardXs[1] + 10).toFixed(1) + " " + (cardY + cardH - 16) + " Td (YOUR ROOFTOP - SOLAR PANEL PLACEMENT) Tj ET",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (cardXs[2] + 10).toFixed(1) + " " + (cardY + cardH - 16) + " Td (3D INSTALLATION VIEW) Tj ET",
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
    "BT /F1 5.5 Tf 0.65 0.72 0.78 rg " + (c1x + 8).toFixed(1) + " " + (c1y + 6).toFixed(1) + " Td (White = other buildings | Blue = your house | Amber = tall building | Yellow = sun path) Tj ET",
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
    const fittedCardPanels = fitPanelsToPolygon(mapped, safePanels);
    for (const panel of fittedCardPanels) {
      commands.push(
        "0.02 0.17 0.34 rg",
        panel.x.toFixed(1) + " " + panel.y.toFixed(1) + " " +
          panel.w.toFixed(1) + " " + panel.h.toFixed(1) + " re f",
        "0.35 0.82 1.00 RG",
        "0.45 w",
        panel.x.toFixed(1) + " " + panel.y.toFixed(1) + " " +
          panel.w.toFixed(1) + " " + panel.h.toFixed(1) + " re S",
      );
    }
    commands.push(
      "BT /F2 7 Tf 0.98 0.98 0.98 rg " +
        (c2x + 8).toFixed(1) + " " + (c2y + 7).toFixed(1) +
        " Td (" + fittedCardPanels.length + "/" + (safePanels || 0) +
        " requested panels fit inside mapped roof) Tj ET",
    );
  } else {
    commands.push(
      "0.10 0.55 1.00 rg",
      (c2x + c2w / 2 - 7).toFixed(1) + " " + (c2y + 64).toFixed(1) + " 14 14 re f",
      "BT /F2 9 Tf 0.98 0.98 0.98 rg " + (c2x + 18).toFixed(1) + " " + (c2y + 43).toFixed(1) +
        " Td (YOUR HOUSE - GPS LOCATION) Tj ET",
      "BT /F1 7 Tf 0.75 0.78 0.82 rg " + (c2x + 18).toFixed(1) + " " + (c2y + 28).toFixed(1) +
        " Td (Exact coordinates are marked on the aerial map.) Tj ET",
      "BT /F1 6.5 Tf 0.65 0.72 0.78 rg " + (c2x + 18).toFixed(1) + " " + (c2y + 15).toFixed(1) +
        " Td (Roof footprint is not available from the map source.) Tj ET",
    );
  }

  // Card 3: only show an installation model when an actual mapped roof
  // polygon exists. Never draw a generic house/panel model when the roof
  // footprint has not been verified.
  const c3x = cardXs[2] + 14;
  const c3y = cardY + 30;
  const c3w = cardW - 28;
  const c3h = cardH - 55;
  const baseX = c3x + 34;
  const baseY = c3y + 35;
  const baseW = c3w * 0.68;
  const baseH = c3h * 0.42;

  if (roofPoints.length >= 3) {
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

  commands.push(
    "BT /F1 5.5 Tf 0.65 0.72 0.78 rg " +
      (c3x + 10).toFixed(1) + " " + (c3y + 8).toFixed(1) +
      " Td (3D sketch based on mapped roof footprint) Tj ET",
  );
  } else {
    commands.push(
      "0.08 0.12 0.16 rg",
      c3x.toFixed(1) + " " + c3y.toFixed(1) + " " + c3w.toFixed(1) + " " + c3h.toFixed(1) + " re f",
      "BT /F2 8 Tf 0.98 0.98 0.98 rg " +
        (c3x + 14).toFixed(1) + " " + (c3y + 92).toFixed(1) +
        " Td (3D installation view unavailable) Tj ET",
      "BT /F1 6.5 Tf 0.65 0.72 0.78 rg " +
        (c3x + 14).toFixed(1) + " " + (c3y + 76).toFixed(1) +
        " Td (A verified roof footprint is required.) Tj ET",
      "BT /F1 6 Tf 0.55 0.65 0.72 rg " +
        (c3x + 14).toFixed(1) + " " + (c3y + 62).toFixed(1) +
        " Td (No generic roof geometry has been substituted.) Tj ET",
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
    "BT /F1 6 Tf 0.45 0.58 0.66 rg 30 88 Td (Aerial: available imagery | 3D: mapped building geometry.) Tj ET",
  );

  return [
    ...commands,
    "BT /F2 17 Tf 0.98 0.98 0.98 rg 190 578 Td (3D SITE VIEW - BUILDING ANALYSIS) Tj ET",
    "BT /F1 8 Tf 0.70 0.78 0.84 rg 190 565 Td (Clean 3D building map + target-house highlight + nearby building shading analysis) Tj ET",
    "BT /F2 8 Tf 0.98 0.98 0.98 rg 208 536 Td (Blue = your house | Amber = nearby tall building | White/grey = other buildings | Yellow = sun path) Tj ET",
    "BT /F1 7 Tf 0.82 0.86 0.90 rg 208 522 Td (3D geometry is map-derived; building heights are estimates where source heights are unavailable.) Tj ET",
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
  roofAerialImage: RoofAerialImage | null;
  roofPhoto: RoofPhoto | null;
  reportLocation: { latitude: number; longitude: number };
}): Uint8Array {
  const pageWidth = 842, pageHeight = 595, margin = 42, lineHeight = 15, linesPerPage = 32;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(["RoofRay Solar Feasibility Report"]);

  const visualPageIndex = pages.length;
  const totalPages = pages.length + 1;
  const roofPhotoObject = 5 + visual.satelliteTiles.length;
  const aerialObject = roofPhotoObject + (visual.roofPhoto ? 1 : 0);
  const pageObjectStart = 5 + visual.satelliteTiles.length + (visual.roofPhoto ? 1 : 0) + (visual.roofAerialImage ? 1 : 0);
  const objects: Array<string | Buffer> = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" +
    Array.from({ length: totalPages }, (_, i) => (pageObjectStart + i * 2) + " 0 R").join(" ") +
    "] /Count " + totalPages + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

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

  if (visual.roofAerialImage) {
    const aerial = visual.roofAerialImage;
    objects.push(
      Buffer.concat([
        Buffer.from(
          "<< /Type /XObject /Subtype /Image /Width " + aerial.width +
          " /Height " + aerial.height +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          aerial.bytes.length + " >>\nstream\n",
          "ascii",
        ),
        Buffer.from(aerial.bytes),
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  for (let i = 0; i < totalPages; i += 1) {
    const pageObject = pageObjectStart + i * 2;
    const contentObject = pageObject + 1;
    const xObjectEntries = i === visualPageIndex && (visual.satelliteTiles.length || visual.roofPhoto || visual.roofAerialImage)
      ? " /XObject << " +
        visual.satelliteTiles.map((tile) => "/" + tile.name + " " + (5 + visual.satelliteTiles.indexOf(tile)) + " 0 R").join(" ") +
        (visual.roofPhoto ? " /RoofPhoto " + roofPhotoObject + " 0 R" : "") +
        (visual.roofAerialImage ? " /RoofAerial " + aerialObject + " 0 R" : "") +
        " >>"
      : "";
    const contentLines = i === visualPageIndex
      ? roofVisualCommands(visual)
      : ["BT", "/F2 18 Tf", margin + " " + (pageHeight - 58) + " Td", "(RoofRay Solar Feasibility Report) Tj", "/F1 10 Tf", "0 -28 Td",
        ...pages[i].flatMap((line, index) => ["(" + text(line) + ") Tj", ...(index === pages[i].length - 1 ? [] : ["0 -" + lineHeight + " Td"])]), "ET"];

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

    const size = numberValue(planning.systemSizeKw);
    const panels = numberValue(planning.panelCount);
    const monthly = numberValue(planning.averageMonthlyGenerationKwh);
    const annual = numberValue(planning.annualGenerationAfterEstimatedShadingKwh);
    const shade = numberValue(planning.estimatedShadingPercent);
    const roof = numberValue(planning.roofAreaSqFt);
    const bill = numberValue(inputs.monthlyBillInr);
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

    const mappedBuildings = await fetchMappedBuildings(lat, lon);

    // Use verified satellite imagery first. Mappls Still Map is a map-image
    // API and can return a styled/vector basemap; using it as the first
    // source made the PDF look like an empty dark map even though the request
    // succeeded. Esri World Imagery is the explicit satellite fallback.
    let satelliteTiles: SatelliteTile[] = [];
    for (const zoom of [20, 19, 18]) {
      const candidate = await fetchSatelliteTiles(lat, lon, zoom);
      if (candidate.length >= 8) {
        satelliteTiles = candidate;
        break;
      }
    }

    // Mappls remains the secondary imagery source when satellite tiles are
    // unavailable. The exact GPS is still drawn independently on top.
    const roofAerialImage =
      satelliteTiles.length >= 8 ? null : await fetchMapplsStillImage(lat, lon);
    const roofPhoto = decodeJpegDataUrl(
      body.userInputs?.roofPhotoDataUrl ?? body.roofPhotoDataUrl,
    );
    console.info("[RoofRay] PDF visual data", {
      latitude: lat,
      longitude: lon,
      mappedBuildings: mappedBuildings.length,
      targetBuildingMapped: mappedBuildings.some((building) => building.containsTarget),
      satelliteTiles: satelliteTiles.length,
      roofAerialImage: Boolean(roofAerialImage),
      roofPhoto: Boolean(roofPhoto),
      reportCenter: { latitude: lat, longitude: lon },
    });
    const reportText = String(body.report ?? "");
    const reportSize = reportNumber(reportText, /Recommended capacity:\s*~?([\d,.]+)\s*kW/i);
    const reportPanels = reportNumber(reportText, /Panels:\s*([\d,.]+)\s*[×x]/i);
    const reportMonthly = reportNumber(reportText, /Expected generation:\s*~?([\d,.]+)\s*kWh\/month/i);
    const reportAnnual = reportNumber(reportText, /\|\s*~?([\d,.]+)\s*kWh\/year/i);
    const reportShade = reportNumber(reportText, /Estimated shading:\s*~?([\d,.]+)%/i);
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
      ...wrap(`Roof area: ${roof !== null ? roof + " sq ft" : "Not available"}`),
      ...wrap(`Roof type: ${inputs.roofType ?? "Not provided"}`),
      ...wrap(`Monthly electricity bill: ${bill !== null ? "Rs. " + Math.round(bill) : "Not provided"}`),
      "",
      "Solar feasibility",
      ...wrap(`Recommended system size: ${(reportSize ?? size) !== null ? (reportSize ?? size)!.toFixed(2) + " kW" : "Unavailable"}`),
      ...wrap(`Estimated panels: ${(reportPanels ?? panels) !== null ? Math.round(reportPanels ?? panels) : "Unavailable"}`),
      ...wrap(`Estimated generation: ${(reportMonthly ?? monthly) !== null ? (reportMonthly ?? monthly) + " kWh/month" : "Unavailable"}${(reportAnnual ?? annual) !== null ? " | " + (reportAnnual ?? annual) + " kWh/year" : ""}`),
      ...wrap(`Average expected generation: ${dailyGeneration !== null ? dailyGeneration.toFixed(1) + " kWh/day" : "Unavailable"}`),
      ...wrap(`Estimated shading: ${(reportShade ?? shade) !== null ? (reportShade ?? shade)!.toFixed(1) + "%" : "Unavailable"}`),
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
      panelPowerW: numberValue(planning.panelPowerW),
      direction: String(planning.recommendedDirection ?? "Unavailable"),
      slopeDeg: numberValue(planning.recommendedSlopeDeg),
      roofFootprint: (context.roof ?? null) as Record<string, unknown> | null,
      obstacles: Array.isArray((context.obstacles as Record<string, unknown> | undefined)?.obstacles)
        ? ((context.obstacles as Record<string, unknown>).obstacles as Array<Record<string, unknown>>)
        : [],
      sunCycle: (context.sunCycle ?? null) as Record<string, unknown> | null,
      mappedBuildings,
      satelliteTiles,
      roofAerialImage,
      roofPhoto,
      reportLocation: { latitude: lat, longitude: lon },
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