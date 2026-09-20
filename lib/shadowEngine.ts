export type ShadowTimeSample = {
  timestamp: string;
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  affectedObstacleCount: number;
  highRiskObstacleCount: number;
  risk: "high" | "medium" | "low" | "none";
};

export type ShadowAnalysis = {
  provider: "RoofRay geometric shadow engine";
  currentRisk: "high" | "medium" | "low" | "none";
  estimatedAffectedDirections: string[];
  timeSeries: ShadowTimeSample[];
  caveats: string[];
};

function radians(value: number) { return (value * Math.PI) / 180; }
function angularDifference(a: number, b: number) {
  return Math.abs(((a - b + 180) % 360) - 180);
}
function direction(deg: number) {
  const names = ["North","North-East","East","South-East","South","South-West","West","North-West"];
  return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function analyzeShadowTimeline(
  obstacles: Array<{
    bearingDeg: number;
    heightMeters: number;
    distanceMeters: number;
  }>,
  sunSamples: Array<{
    timestamp: string;
    azimuthDeg: number;
    elevationDeg: number;
  }>,
): ShadowAnalysis {
  const timeSeries = sunSamples.map((sun) => {
    if (sun.elevationDeg <= 0) {
      return {
        timestamp: sun.timestamp,
        sunAzimuthDeg: Number(sun.azimuthDeg.toFixed(1)),
        sunElevationDeg: Number(sun.elevationDeg.toFixed(1)),
        affectedObstacleCount: 0,
        highRiskObstacleCount: 0,
        risk: "none" as const,
      };
    }

    let affectedObstacleCount = 0;
    let highRiskObstacleCount = 0;

    for (const obstacle of obstacles) {
      const reach = obstacle.heightMeters / Math.tan(radians(Math.max(1, sun.elevationDeg)));
      const alignment = angularDifference(obstacle.bearingDeg, sun.azimuthDeg);

      if (obstacle.distanceMeters <= reach && alignment <= 45) {
        affectedObstacleCount++;
        if (alignment <= 22.5 && obstacle.distanceMeters <= reach * 0.75) {
          highRiskObstacleCount++;
        }
      }
    }

    const risk =
      highRiskObstacleCount > 0 ? "high" :
      affectedObstacleCount > 0 ? "medium" :
      "low";

    return {
      timestamp: sun.timestamp,
      sunAzimuthDeg: Number(sun.azimuthDeg.toFixed(1)),
      sunElevationDeg: Number(sun.elevationDeg.toFixed(1)),
      affectedObstacleCount,
      highRiskObstacleCount,
      risk,
    };
  });

  const currentRisk = timeSeries[0]?.risk ?? "none";
  const estimatedAffectedDirections = [...new Set(
    timeSeries
      .filter(sample => sample.risk === "high" || sample.risk === "medium")
      .map(sample => direction((sample.sunAzimuthDeg + 180) % 360))
  )];

  return {
    provider: "RoofRay geometric shadow engine",
    currentRisk,
    estimatedAffectedDirections,
    timeSeries,
    caveats: [
      "This is a geometric shadow-risk estimate using mapped obstacle points and estimated heights.",
      "It does not model exact roof points, tree canopies, roof structures, or a measured 3D scene.",
      "Use the result for planning only; final shading assessment requires a site survey or higher-resolution 3D data.",
    ],
  };
}
