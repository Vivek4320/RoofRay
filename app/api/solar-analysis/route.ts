import { NextResponse } from "next/server";
import { getNearbyObstacleAnalysis, buildCurrentSunCycle } from "@/lib/obstacles";
import { getRoofFootprint } from "@/lib/roofFootprint";
import { estimatePanelPlacement } from "@/lib/panelPlacement";
import { getPVGISAnalysis } from "@/lib/pvgis";
import { analyzeShadowTimeline } from "@/lib/shadowEngine";
import { getOpenMeteoSolarWeather } from "@/lib/openMeteo";

type SolarAnalysisRequest = {
  latitude?: unknown;
  longitude?: unknown;
  peakPowerKw?: unknown;
  lossPercent?: unknown;
  obstacleRadiusMeters?: unknown;
  roofAreaM2?: unknown;
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
    const roofAreaM2 = finiteNumber(body.roofAreaM2);

    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ ok: false, error: "A valid latitude and longitude are required." }, { status: 400 });
    }
    if (peakPowerKw <= 0 || peakPowerKw > 1000) {
      return NextResponse.json({ ok: false, error: "peakPowerKw must be greater than 0 and at most 1000." }, { status: 400 });
    }
    if (roofAreaM2 !== null && (roofAreaM2 <= 0 || roofAreaM2 > 100000)) {
      return NextResponse.json({ ok: false, error: "roofAreaM2 must be greater than 0 and at most 100000." }, { status: 400 });
    }
    if (lossPercent < 0 || lossPercent > 100) {
      return NextResponse.json({ ok: false, error: "lossPercent must be between 0 and 100." }, { status: 400 });
    }

    // PVGIS is required for generation. Roof-footprint and mapped-obstacle
    // services are enrichment only: if either one fails, the user's own roof
    // area + PVGIS can still produce a real planning estimate.
    const [pvgisResult, obstaclesResult, roofResult, weatherResult] = await Promise.allSettled([
      getPVGISAnalysis({ latitude, longitude, peakPowerKw, lossPercent }),
      getNearbyObstacleAnalysis(latitude, longitude, obstacleRadiusMeters),
      getRoofFootprint(latitude, longitude),
      getOpenMeteoSolarWeather(latitude, longitude),
    ]);

    if (pvgisResult.status === "rejected") {
      throw pvgisResult.reason;
    }

    const pvgis = pvgisResult.value;
    const obstacles =
      obstaclesResult.status === "fulfilled"
        ? obstaclesResult.value
        : { obstacles: [], source: "unavailable" };

    const roof =
      roofResult.status === "fulfilled"
        ? roofResult.value
        : null;

    const weather =
      weatherResult.status === "fulfilled"
        ? weatherResult.value
        : null;

    const sunCycle = buildCurrentSunCycle(latitude, longitude);
    const shadow = analyzeShadowTimeline(
      obstacles.obstacles,
      sunCycle.next12Hours.map((sample) => ({
        timestamp: sample.timestamp,
        azimuthDeg: sample.azimuthDeg,
        elevationDeg: sample.elevationDeg,
      })),
    );
    // Always calculate a planning estimate from the user's actual roof area when
    // available. A mapped roof footprint is useful for spatial validation, but it
    // should not block the solar-size/generation estimate if footprint mapping fails.
    const planningRoofAreaM2 = roofAreaM2 ?? roof?.areaM2 ?? null;
    const shadingFactor = shadow.timeSeries.length
      ? shadow.timeSeries.filter(
          (sample) => sample.risk === "high" || sample.risk === "medium",
        ).length / shadow.timeSeries.length * 0.15
      : 0;

    const panelPlacement = planningRoofAreaM2 !== null
      ? estimatePanelPlacement({
          roofAreaM2: planningRoofAreaM2,
          annualSpecificYieldKwhPerKwp: pvgis.annual.specificYieldKwhPerKwp,
          recommendedDirection: pvgis.optimalOrientation.direction,
          shadingFactor,
        })
      : null;

    const averageMonthlyGenerationKwh =
      panelPlacement?.estimate.effectiveGenerationKwh !== null &&
      panelPlacement?.estimate.effectiveGenerationKwh !== undefined
        ? Number((panelPlacement.estimate.effectiveGenerationKwh / 12).toFixed(0))
        : null;

    const systemSizeKw = panelPlacement?.estimate.systemSizeKw ?? null;
    const monthlyGenerationKwh = pvgis.monthly.map((item) => ({
      month: item.month,
      expectedKwh: systemSizeKw === null
        ? null
        : Math.round(
            item.energyKwh *
              (1 - Math.min(Math.max(shadingFactor, 0), 0.8)) *
              systemSizeKw,
          ),
      averageDailyKwh: systemSizeKw === null
        ? null
        : Number(
            (
              (item.energyKwh *
                (1 - Math.min(Math.max(shadingFactor, 0), 0.8)) *
                systemSizeKw) /
              new Date(2026, item.month, 0).getDate()
            ).toFixed(2),
          ),
    }));

    const averageDailyGenerationKwh =
      panelPlacement?.estimate.effectiveGenerationKwh !== null &&
      panelPlacement?.estimate.effectiveGenerationKwh !== undefined
        ? Number((panelPlacement.estimate.effectiveGenerationKwh / 365).toFixed(2))
        : null;

    const estimatedShadingPercent = Number((shadingFactor * 100).toFixed(1));

    return NextResponse.json({
      ok: true,
      analysis: {
        ...pvgis,
        sunCycle,
        weather,
        obstacles,
        roof,
        shadow,
        panelPlacement,
        planningEstimate: {
          location: {
            latitude,
            longitude,
          },
          roofAreaM2: planningRoofAreaM2,
          roofAreaSqFt:
            planningRoofAreaM2 === null
              ? null
              : Number((planningRoofAreaM2 / 0.092903).toFixed(0)),
          estimatedShadingPercent,
          averageMonthlyGenerationKwh,
          averageDailyGenerationKwh,
          monthlyGenerationKwh,
          annualGenerationAfterEstimatedShadingKwh:
            panelPlacement?.estimate.effectiveGenerationKwh ?? null,
          systemSizeKw: panelPlacement?.estimate.systemSizeKw ?? null,
          panelCount: panelPlacement?.estimate.panelCount ?? null,
          panelPowerW: panelPlacement?.panel.assumedPowerW ?? null,
          recommendedDirection: pvgis.optimalOrientation.direction,
          recommendedSlopeDeg: pvgis.optimalOrientation.slopeDeg,
          note:
            "These are location-based planning estimates. Final panel count, layout, structure, electrical design, and shading require a physical site assessment.",
        },
      },
    });
  } catch (error) {
    console.error("[RoofRay] Solar analysis failed:", error);
    return NextResponse.json(
      { ok: false, error: "Solar analysis is temporarily unavailable. Please try again in a moment." },
      { status: 502 },
    );
  }
}
