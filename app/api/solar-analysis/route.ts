import { NextResponse } from "next/server";
import { getPVGISAnalysis } from "@/lib/pvgis";

type SolarAnalysisRequest = {
  latitude?: unknown;
  longitude?: unknown;
  peakPowerKw?: unknown;
  lossPercent?: unknown;
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SolarAnalysisRequest;

    const latitude = finiteNumber(body.latitude);
    const longitude = finiteNumber(body.longitude);
    const peakPowerKw = finiteNumber(body.peakPowerKw) ?? 1;
    const lossPercent = finiteNumber(body.lossPercent) ?? 14;

    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { ok: false, error: "A valid latitude and longitude are required." },
        { status: 400 },
      );
    }

    if (peakPowerKw <= 0 || peakPowerKw > 1000) {
      return NextResponse.json(
        { ok: false, error: "peakPowerKw must be greater than 0 and at most 1000." },
        { status: 400 },
      );
    }

    if (lossPercent < 0 || lossPercent > 100) {
      return NextResponse.json(
        { ok: false, error: "lossPercent must be between 0 and 100." },
        { status: 400 },
      );
    }

    const analysis = await getPVGISAnalysis({
      latitude,
      longitude,
      peakPowerKw,
      lossPercent,
    });

    return NextResponse.json({
      ok: true,
      analysis,
    });
  } catch (error) {
    console.error("[RoofRay] PVGIS solar analysis failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          "Solar analysis is temporarily unavailable. Please try again in a moment.",
      },
      { status: 502 },
    );
  }
}
