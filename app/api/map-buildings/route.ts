import { NextResponse } from "next/server";

type Building = {
  polygon: Array<{ latitude: number; longitude: number }>;
  heightMeters: number;
  levels: number;
  containsTarget: boolean;
};

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

    return NextResponse.json({ ok: true, buildings });
  } catch (error) {
    console.error("[RoofRay] 3D building map failed:", error);
    return NextResponse.json(
      { ok: false, error: "3D building map is temporarily unavailable." },
      { status: 502 },
    );
  }
}
