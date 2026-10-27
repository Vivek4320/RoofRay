import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (!address || address.length > 500) {
      return NextResponse.json(
        { ok: false, error: "Enter a full address or valid Google Maps coordinates." },
        { status: 400 },
      );
    }

    // Accept coordinates pasted from Google Maps, e.g. "22.3072, 72.1234".
    const coordinateMatch = address.match(
      /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
    );
    if (coordinateMatch) {
      const latitude = Number(coordinateMatch[1]);
      const longitude = Number(coordinateMatch[2]);
      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        return NextResponse.json({
          ok: true,
          latitude,
          longitude,
          label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          source: "coordinates",
        });
      }
      return NextResponse.json(
        { ok: false, error: "Coordinates are outside the valid latitude/longitude range." },
        { status: 400 },
      );
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", address);
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "RoofRay/1.0 rooftop-solar-feasibility-app",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Address lookup is temporarily unavailable. Try pasting coordinates from Google Maps." },
        { status: 502 },
      );
    }

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);

    if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { ok: false, error: "Address not found. Enter your house number, street, area and city, or paste Google Maps coordinates." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      latitude,
      longitude,
      label: typeof first.display_name === "string" ? first.display_name : address,
      source: "address",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not look up that location. Try again or paste Google Maps coordinates." },
      { status: 500 },
    );
  }
}
