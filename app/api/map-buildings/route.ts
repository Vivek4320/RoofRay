import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";

type Building = {
  polygon: Array<{ latitude: number; longitude: number }>;
  heightMeters: number;
  levels: number;
  containsTarget: boolean;
};

function bingQuadKey(latitude: number, longitude: number, level = 9): string {
  const n = 2 ** level;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const sinLat = Math.sin((latitude * Math.PI) / 180);
  const y = Math.floor(
    (0.5 - Math.log((1 + sinLat) / Math.max(1e-12, 1 - sinLat)) / (4 * Math.PI)) * n,
  );
  let key = "";
  for (let i = level; i > 0; i -= 1) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if (x & mask) digit += 1;
    if (y & mask) digit += 2;
    key += String(digit);
  }
  return key;
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

async function fetchMicrosoftBuildings(
  latitude: number,
  longitude: number,
  radius: number,
): Promise<Building[]> {
  try {
    const links = await fetch(
      "https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv",
      { cache: "no-store", signal: AbortSignal.timeout(12000) },
    );
    if (!links.ok) return [];

    const lines = (await links.text()).split(/\r?\n/).filter(Boolean);
    const header = parseSimpleCsvLine(lines[0] ?? "").map((v) => v.toLowerCase());
    const li = header.indexOf("location");
    const qi = header.indexOf("quadkey");
    const ui = header.indexOf("url");
    if (li < 0 || qi < 0 || ui < 0) return [];

    const rows = new Map<string, string>();
    for (let i = 1; i < lines.length; i += 1) {
      const fields = parseSimpleCsvLine(lines[i]);
      if (fields[li]?.toLowerCase() === "india" && fields[qi] && fields[ui]) {
        rows.set(fields[qi], fields[ui]);
      }
    }

    const quadKeys = neighboringQuadKeys(latitude, longitude, 9);
    console.info("[RoofRay] Microsoft 3D lookup", {
      quadKey: bingQuadKey(latitude, longitude, 9),
      candidateTiles: quadKeys.length,
      matchedTiles: quadKeys.filter((key) => rows.has(key)).length,
    });

    const latDelta = radius / 111320;
    const lonDelta = radius / Math.max(1, 111320 * Math.cos((latitude * Math.PI) / 180));
    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;
    const result: Building[] = [];

    for (const quadKey of quadKeys) {
      const dataUrl = rows.get(quadKey);
      if (!dataUrl) continue;

      try {
        const response = await fetch(dataUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) continue;

        const raw = gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
        for (const line of raw.split(/\r?\n/)) {
          if (result.length >= 100 || !line.trim()) continue;
          try {
            const feature = JSON.parse(line) as {
              geometry?: { type?: string; coordinates?: unknown };
              properties?: Record<string, unknown>;
            };
            const geometry = feature.geometry;
            if (!geometry?.coordinates) continue;

            let ring: unknown[] | null = null;
            if (geometry.type === "Polygon") {
              const coordinates = geometry.coordinates as unknown[];
              ring = Array.isArray(coordinates?.[0]) ? coordinates[0] as unknown[] : null;
            } else if (geometry.type === "MultiPolygon") {
              const polygons = geometry.coordinates as unknown[];
              const polygon = polygons.find(
                (p) => Array.isArray(p) && Array.isArray((p as unknown[])[0]),
              );
              ring = polygon ? (polygon as unknown[])[0] as unknown[] : null;
            }
            if (!ring || ring.length < 4) continue;

            const polygon = ring
              .map((p) =>
                Array.isArray(p)
                  ? { longitude: Number(p[0]), latitude: Number(p[1]) }
                  : null,
              )
              .filter(
                (p): p is { longitude: number; latitude: number } =>
                  p !== null &&
                  Number.isFinite(p.longitude) &&
                  Number.isFinite(p.latitude),
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
            const heightMeters = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 6;

            result.push({
              polygon,
              heightMeters: Math.max(3, heightMeters),
              levels: Math.max(1, Math.round(heightMeters / 3)),
              containsTarget: false,
            });
          } catch {}
        }
      } catch (error) {
        console.warn("[RoofRay] Microsoft 3D tile failed", {
          quadKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (result.length >= 100) break;
    }

    const mLat = 111320;
    const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
    function containsTarget(points: Array<{ x: number; y: number }>) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        const hit =
          a.y > 0 !== b.y > 0 &&
          0 < ((b.x - a.x) * (0 - a.y)) / (b.y - a.y) + a.x;
        if (hit) inside = !inside;
      }
      return inside;
    }

    return result.map((building) => ({
      ...building,
      containsTarget: containsTarget(
        building.polygon.map((p) => ({
          x: (p.longitude - longitude) * mLon,
          y: (p.latitude - latitude) * mLat,
        })),
      ),
    }));
  } catch (error) {
    console.warn("[RoofRay] Microsoft building fallback failed:", error);
    return [];
  }
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("latitude"));
    const longitude = Number(url.searchParams.get("longitude"));
    const radius = Math.min(
      200,
      Math.max(60, Number(url.searchParams.get("radius")) || 140),
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { ok: false, error: "Valid latitude and longitude are required." },
        { status: 400 },
      );
    }

    const query = `[out:json][timeout:20];
way["building"](around:${radius},${latitude},${longitude});
out geom tags qt;`;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "data=" + encodeURIComponent(query),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Building map service returned HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      elements?: Array<{
        geometry?: Array<{ lat: number; lon: number }>;
        tags?: Record<string, string>;
      }>;
    };

    const metersLat = 111320;
    const metersLon = 111320 * Math.cos((latitude * Math.PI) / 180);

    function containsTarget(points: Array<{ x: number; y: number }>) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        const hit =
          a.y > 0 !== b.y > 0 &&
          0 < ((b.x - a.x) * (0 - a.y)) / (b.y - a.y) + a.x;
        if (hit) inside = !inside;
      }
      return inside;
    }

    const buildings: Building[] = (data.elements ?? [])
      .map((element) => {
        const geometry = element.geometry ?? [];
        const projected = geometry.map((point) => ({
          x: (point.lon - longitude) * metersLon,
          y: (point.lat - latitude) * metersLat,
        }));
        const tags = element.tags ?? {};
        const levels = Math.max(1, Number(tags["building:levels"]) || 1);
        const taggedHeight = Number.parseFloat(tags.height ?? "");
        const heightMeters = Number.isFinite(taggedHeight)
          ? Math.max(3, taggedHeight)
          : levels * 3;

        return {
          polygon: geometry.map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
          })),
          heightMeters,
          levels,
          containsTarget: projected.length >= 3 && containsTarget(projected),
        };
      })
      .filter((building) => building.polygon.length >= 3)
      .sort((a, b) => {
        if (a.containsTarget !== b.containsTarget) {
          return a.containsTarget ? -1 : 1;
        }
        return a.polygon.length - b.polygon.length;
      })
      .slice(0, 40);

    const finalBuildings =
      buildings.length > 0
        ? buildings
        : await fetchMicrosoftBuildings(latitude, longitude, radius);

    return NextResponse.json({ ok: true, buildings: finalBuildings });
  } catch (error) {
    console.error("[RoofRay] 3D building map failed:", error);
    return NextResponse.json(
      { ok: false, error: "3D building map is temporarily unavailable." },
      { status: 502 },
    );
  }
}
