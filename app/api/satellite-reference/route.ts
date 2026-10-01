import { NextResponse } from "next/server";

function valid(value: string | null, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

async function fetchArcgis(latitude: number, longitude: number) {
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
      const response = await fetch(host + "?" + params.toString(), {
        cache: "no-store",
        headers: { Accept: "image/jpeg,image/*" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 5000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;

      return {
        image: "data:image/jpeg;base64," + Buffer.from(bytes).toString("base64"),
        source: "Esri World Imagery",
        center: { latitude, longitude },
        coverageMeters: { width: 560, height: 400 },
      };
    } catch {
      // Try the alternate ArcGIS host.
    }
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latitude = valid(url.searchParams.get("latitude"), -90, 90);
    const longitude = valid(url.searchParams.get("longitude"), -180, 180);

    if (latitude === null || longitude === null) {
      return NextResponse.json(
        { ok: false, error: "Valid latitude and longitude are required." },
        { status: 400 },
      );
    }

    const result = await fetchArcgis(latitude, longitude);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Satellite imagery could not be loaded." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[RoofRay] Satellite reference failed:", error);
    return NextResponse.json(
      { ok: false, error: "Satellite imagery is temporarily unavailable." },
      { status: 502 },
    );
  }
}
