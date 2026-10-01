import { NextResponse } from "next/server";

type SolarVisualBody = {
  latitude?: number;
  longitude?: number;
  analysis?: Record<string, unknown> | null;
};

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function pickGeneratedImage(data: any): string | null {
  const direct = data?.output_image?.data;
  if (typeof direct === "string" && direct.length > 100) {
    return direct;
  }

  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    const blocks = Array.isArray(step?.content) ? step.content : [];
    for (const block of blocks) {
      if (block?.type === "image" && typeof block?.data === "string" && block.data.length > 100) {
        return block.data;
      }
    }
  }

  return null;
}

async function fetchSatelliteReference(latitude: number, longitude: number): Promise<string | null> {
  const zoom = 19;
  const metersPerDegreeLat = 111320;
  const halfWidthMeters = 170;
  const halfHeightMeters = 120;
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
        size: "1344,768",
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

      return Buffer.from(bytes).toString("base64");
    } catch {
      // Try the second ArcGIS host.
    }
  }

  return null;
}

function sunSummary(analysis: Record<string, unknown> | null | undefined) {
  const sun = (analysis?.sunCycle ?? {}) as Record<string, unknown>;
  const planning = (analysis?.planningEstimate ?? {}) as Record<string, unknown>;
  const samples = Array.isArray(sun.next12Hours)
    ? sun.next12Hours as Array<Record<string, unknown>>
    : [];

  const points = samples
    .filter((sample) => Number.isFinite(Number(sample.azimuthDeg)))
    .slice(0, 8)
    .map((sample) => ({
      time: String(sample.timestamp ?? ""),
      azimuth: Number(sample.azimuthDeg),
      elevation: Number(sample.elevationDeg),
    }));

  return {
    sunrise: sun.sunrise ?? null,
    sunset: sun.sunset ?? null,
    solarNoon: sun.solarNoon ?? null,
    direction: planning.recommendedDirection ?? null,
    slope: planning.recommendedSlopeDeg ?? null,
    points,
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "GEMINI_API_KEY is missing. Add it to the server environment to enable the AI solar visual.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as SolarVisualBody;
    const latitude = finiteCoordinate(body.latitude, -90, 90);
    const longitude = finiteCoordinate(body.longitude, -180, 180);

    if (latitude === null || longitude === null) {
      return NextResponse.json(
        { ok: false, error: "A valid GPS location is required." },
        { status: 400 },
      );
    }

    const satelliteBase64 = await fetchSatelliteReference(latitude, longitude);
    if (!satelliteBase64) {
      return NextResponse.json(
        { ok: false, error: "Satellite reference imagery could not be loaded for this location." },
        { status: 502 },
      );
    }

    const summary = sunSummary(body.analysis);
    const roofArea = Number((body.analysis?.planningEstimate as any)?.roofAreaSqFt);
    const panelCount = Number((body.analysis?.planningEstimate as any)?.panelCount);

    const prompt = [
      "Create a polished RoofRay solar feasibility visual using the supplied satellite image as the geographic reference.",
      "The supplied image is centered exactly on the user's GPS coordinate. Preserve the real neighborhood layout, roads, building arrangement, and overall viewpoint from the reference image as much as possible.",
      "Do not invent a different city or a generic house scene.",
      "Identify the building closest to the exact image center as the target house and highlight ONLY that target building with a green translucent outline/fill.",
      "Highlight surrounding buildings with a subtle blue outline so the target house is visually distinct.",
      "Place a realistic solar panel array on the target roof only when the roof area and panel count indicate one is planned.",
      "Overlay a clean yellow dashed sun path across the sky using the supplied solar azimuth/elevation samples. Show small sun markers at the sampled times.",
      "Add a compact professional RoofRay information panel with the GPS coordinates, sunrise, solar noon, sunset, roof area, recommended direction and tilt when available.",
      "Add a small legend: green = Your House, blue = Nearby Buildings, yellow dashed = Sun Path.",
      "Make it look like a premium photorealistic aerial solar-site analysis, not a fantasy illustration and not a map UI.",
      "Do not add people, faces, user-drawn polygons, or unrelated UI controls.",
      "",
      "LOCATION:",
      latitude.toFixed(6) + ", " + longitude.toFixed(6),
      "",
      "SOLAR DATA:",
      JSON.stringify(summary),
      "",
      "ROOF DATA:",
      JSON.stringify({
        roofAreaSqFt: Number.isFinite(roofArea) ? roofArea : null,
        panelCount: Number.isFinite(panelCount) ? panelCount : null,
      }),
    ].join("\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image",
          input: [
            {
              type: "image",
              mime_type: "image/jpeg",
              data: satelliteBase64,
            },
            {
              type: "text",
              text: prompt,
            },
          ],
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            aspect_ratio: "16:9",
            image_size: "2K",
          },
        }),
        signal: AbortSignal.timeout(90000),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[RoofRay] Gemini solar visual error:", data);
      return NextResponse.json(
        {
          ok: false,
          error: "The AI solar visual could not be generated.",
        },
        { status: 502 },
      );
    }

    const imageBase64 = pickGeneratedImage(data);
    if (!imageBase64) {
      console.error("[RoofRay] Gemini returned no generated image.");
      return NextResponse.json(
        { ok: false, error: "The AI model returned no image." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      image: "data:image/jpeg;base64," + imageBase64,
      generatedBy: "Gemini 3.1 Flash Image",
      reference: "Esri World Imagery",
    });
  } catch (error) {
    console.error("[RoofRay] Solar visual generation failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to generate the AI solar visual right now." },
      { status: 500 },
    );
  }
}
