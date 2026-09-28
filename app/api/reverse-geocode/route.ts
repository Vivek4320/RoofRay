import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "Valid coordinates are required." }, { status: 400 });
    }

    const response = await fetch(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lon) +
        "&zoom=18&addressdetails=1",
      {
        headers: {
          "User-Agent": "RoofRay/1.0 rooftop-solar-feasibility-app",
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json({ ok: false, displayName: null }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({
      ok: true,
      displayName: typeof data?.display_name === "string" ? data.display_name : null,
    });
  } catch {
    return NextResponse.json({ ok: false, displayName: null }, { status: 502 });
  }
}
