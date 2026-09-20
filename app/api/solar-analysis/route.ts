import { NextResponse } from "next/server";
import { getNearbyObstacleAnalysis, buildCurrentSunCycle } from "@/lib/obstacles";
import { getRoofFootprint } from "@/lib/roofFootprint";
import { estimatePanelPlacement } from "@/lib/panelPlacement";
import { getPVGISAnalysis } from "@/lib/pvgis";
import { analyzeShadowTimeline } from "@/lib/shadowEngine";

type SolarAnalysisRequest = {
  latitude?: unknown;
  longitude?: unknown;
  peakPowerKw?: unknown;
  lossPercent?: unknown;
  obstacleRadiusMeters?: unknown;
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
    const obstacleRadiusMeters = finiteNumber(body.obstacleRadiusMeters) ?? 500;

    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ ok: false, error: "A valid latitude and longitude are required." }, { status: 400 });
    }
    if (peakPowerKw <= 0 || peakPowerKw > 1000) {
      return NextResponse.json({ ok: false, error: "peakPowerKw must be greater than 0 and at most 1000." }, { status: 400 });
    }
    if (lossPercent < 0 || lossPercent > 100) {
      return NextResponse.json({ ok: false, error: "lossPercent must be between 0 and 100." }, { status: 400 });
    }

    const [pvgis, obstacles, roof] = await Promise.all([
      getPVGISAnalysis({ latitude, longitude, peakPowerKw, lossPercent }),
      getNearbyObstacleAnalysis(latitude, longitude, obstacleRadiusMeters),
      getRoofFootprint(latitude, longitude),
    ]);

    const sunCycle = buildCurrentSunCycle(latitude, longitude);
    const shadow = analyzeShadowTimeline(
      obstacles.obstacles,
      sunCycle.next12Hours.map((sample) => ({
        timestamp: sample.timestamp,
        azimuthDeg: sample.azimuthDeg,
        elevationDeg: sample.elevationDeg,
      })),
    );
    const panelPlacement = roof
      ? estimatePanelPlacement({
          roofAreaM2: roof.areaM2,
          annualSpecificYieldKwhPerKwp: pvgis.annual.specificYieldKwhPerKwp,
          recommendedDirection: pvgis.optimalOrientation.direction,
        })
      : null;

    return NextResponse.json({
      ok: true,
      analysis: { ...pvgis, sunCycle, obstacles, roof, shadow, panelPlacement },
    });
  } catch (error) {
    console.error("[RoofRay] Solar analysis failed:", error);
    return NextResponse.json(
      { ok: false, error: "Solar analysis is temporarily unavailable. Please try again in a moment." },
      { status: 502 },
    );
  }
}
