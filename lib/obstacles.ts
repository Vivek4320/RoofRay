export type SolarObstacle = {
  id: string;
  type: "building" | "tower" | "mast" | "other";
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  bearingDeg: number;
  heightMeters: number;
  heightSource: "osm-height" | "osm-levels" | "estimated";
  tags: Record<string, string>;
  shadowRisk: "high" | "medium" | "low" | "unknown";
  estimatedShadowReachMeters: number | null;
};

export type SolarObstacleAnalysis = {
  provider: "OpenStreetMap Overpass";
  radiusMeters: number;
  obstacles: SolarObstacle[];
  likelyShadowDirections: string[];
  caveats: string[];
  attribution: "© OpenStreetMap contributors";
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type SunPosition = {
  azimuthDeg: number;
  elevationDeg: number;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function numberValue(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseHeight(tags: Record<string, string>): {
  meters: number;
  source: SolarObstacle["heightSource"];
} {
  const direct = numberValue(tags.height?.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (direct !== null && direct > 0 && direct < 500) {
    return { meters: direct, source: "osm-height" };
  }

  const levels = numberValue(tags["building:levels"]?.replace(",", "."));
  if (levels !== null && levels > 0 && levels < 100) {
    const roofLevels = numberValue(tags["roof:levels"]?.replace(",", ".") ?? 0) ?? 0;
    return {
      meters: Number(((levels + roofLevels) * 3.2).toFixed(1)),
      source: "osm-levels",
    };
  }

  return {
    meters: tags["tower:type"] === "communication" || tags.man_made === "communications_tower" ? 30 : 6,
    source: "estimated",
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function distanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadius = 6371000;
  const dLat = toRadians(latitude2 - latitude1);
  const dLon = toRadians(longitude2 - longitude1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export function bearingDegrees(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);
  const dLon = toRadians(longitude2 - longitude1);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// Compact NOAA-style solar-position calculation.
// Azimuth is clockwise from true north.
export function getSunPosition(date: Date, latitude: number, longitude: number): SunPosition {
  const unixDays = date.getTime() / 86400000 + 2440587.5;
  const julianCentury = (unixDays - 2451545.0) / 36525;

  const geomMeanLongSun =
    (280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032)) % 360;
  const geomMeanAnomSun =
    357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);
  const eccentricityEarthOrbit =
    0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

  const sunEqCenter =
    Math.sin(toRadians(geomMeanAnomSun)) *
      (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) +
    Math.sin(toRadians(2 * geomMeanAnomSun)) *
      (0.019993 - 0.000101 * julianCentury) +
    Math.sin(toRadians(3 * geomMeanAnomSun)) * 0.000289;

  const sunTrueLong = geomMeanLongSun + sunEqCenter;
  const omega = 125.04 - 1934.136 * julianCentury;
  const sunAppLong =
    sunTrueLong - 0.00569 - 0.00478 * Math.sin(toRadians(omega));

  const meanObliq =
    23 +
    (26 +
      ((21.448 -
        julianCentury *
          (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) /
        60)) /
      60;
  const obliqCorr =
    meanObliq + 0.00256 * Math.cos(toRadians(omega));
  const sunDeclination = toDegrees(
    Math.asin(
      Math.sin(toRadians(obliqCorr)) * Math.sin(toRadians(sunAppLong)),
    ),
  );

  const varY = Math.tan(toRadians(obliqCorr / 2)) ** 2;
  const eqTime =
    4 *
    toDegrees(
      varY * Math.sin(2 * toRadians(geomMeanLongSun)) -
        2 * eccentricityEarthOrbit * Math.sin(toRadians(geomMeanAnomSun)) +
        4 *
          eccentricityEarthOrbit *
          varY *
          Math.sin(toRadians(geomMeanAnomSun)) *
          Math.cos(2 * toRadians(geomMeanLongSun)) -
        0.5 * varY ** 2 * Math.sin(4 * toRadians(geomMeanLongSun)) -
        1.25 * eccentricityEarthOrbit ** 2 *
          Math.sin(2 * toRadians(geomMeanAnomSun)),
    );

  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarTime = (minutesUtc + eqTime + 4 * longitude) % 1440;
  const hourAngle = trueSolarTime < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  const solarZenith = toDegrees(
    Math.acos(
      Math.sin(toRadians(latitude)) * Math.sin(toRadians(sunDeclination)) +
        Math.cos(toRadians(latitude)) *
          Math.cos(toRadians(sunDeclination)) *
          Math.cos(toRadians(hourAngle)),
    ),
  );

  const elevation = 90 - solarZenith;
  const azimuth =
    (toDegrees(
      Math.atan2(
        Math.sin(toRadians(hourAngle)),
        Math.cos(toRadians(hourAngle)) * Math.sin(toRadians(latitude)) -
          Math.tan(toRadians(sunDeclination)) * Math.cos(toRadians(latitude)),
      ),
    ) +
      180) %
    360;

  return { azimuthDeg: azimuth, elevationDeg: elevation };
}

function directionName(deg: number): string {
  const directions = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
  return directions[Math.round(deg / 45) % 8];
}

export function buildCurrentSunCycle(latitude: number, longitude: number, date = new Date()) {
  const samples = Array.from({ length: 12 }, (_, index) => {
    const sampleDate = new Date(date.getTime() + index * 60 * 60 * 1000);
    const sun = getSunPosition(sampleDate, latitude, longitude);
    return {
      timestamp: sampleDate.toISOString(),
      azimuthDeg: Number(sun.azimuthDeg.toFixed(1)),
      elevationDeg: Number(sun.elevationDeg.toFixed(1)),
      direction: directionName(sun.azimuthDeg),
      aboveHorizon: sun.elevationDeg > 0,
    };
  });

  return {
    current: {
      timestamp: date.toISOString(),
      ...(() => {
        const sun = getSunPosition(date, latitude, longitude);
        return {
          azimuthDeg: Number(sun.azimuthDeg.toFixed(1)),
          elevationDeg: Number(sun.elevationDeg.toFixed(1)),
          direction: directionName(sun.azimuthDeg),
          aboveHorizon: sun.elevationDeg > 0,
        };
      })(),
    },
    next12Hours: samples,
  };
}

function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 180) % 360) - 180);
}

function classifyShadow(
  obstacleHeight: number,
  distance: number,
  obstacleBearing: number,
  sun: SunPosition,
): SolarObstacle["shadowRisk"] {
  if (sun.elevationDeg <= 0) return "unknown";

  const shadowReach = obstacleHeight / Math.tan(toRadians(sun.elevationDeg));
  if (distance > shadowReach) return "low";

  const alignment = angularDifference(obstacleBearing, sun.azimuthDeg);
  if (alignment <= 22.5) return "high";
  if (alignment <= 45) return "medium";
  return "low";
}

export async function getNearbyObstacleAnalysis(
  latitude: number,
  longitude: number,
  radiusMeters = 500,
): Promise<SolarObstacleAnalysis> {
  const safeRadius = Math.min(Math.max(Math.round(radiusMeters), 100), 1000);

  const query = `[out:json][timeout:20];
(
  nwr["building"] around:${safeRadius},${latitude},${longitude};
  nwr["man_made"~"^(tower|mast|communications_tower)$"] around:${safeRadius},${latitude},${longitude};
  nwr["tower:type"] around:${safeRadius},${latitude},${longitude};
);
out center tags qt;`;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap Overpass request failed (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as { elements?: OverpassElement[] };
  const now = new Date();
  const currentSun = getSunPosition(now, latitude, longitude);

  const obstacles = (data.elements ?? [])
    .map((element) => {
      const tags = element.tags ?? {};
      const obstacleLatitude = element.lat ?? element.center?.lat;
      const obstacleLongitude = element.lon ?? element.center?.lon;

      if (
        typeof obstacleLatitude !== "number" ||
        typeof obstacleLongitude !== "number" ||
        !Number.isFinite(obstacleLatitude) ||
        !Number.isFinite(obstacleLongitude)
      ) {
        return null;
      }

      const distance = distanceMeters(
        latitude,
        longitude,
        obstacleLatitude,
        obstacleLongitude,
      );

      if (distance < 5) return null;

      const bearing = bearingDegrees(
        latitude,
        longitude,
        obstacleLatitude,
        obstacleLongitude,
      );

      const height = parseHeight(tags);
      const shadowReach =
        currentSun.elevationDeg > 0
          ? height.meters / Math.tan(toRadians(currentSun.elevationDeg))
          : null;

      const type: SolarObstacle["type"] =
        tags.man_made === "mast"
          ? "mast"
          : tags.man_made === "tower" ||
              tags.man_made === "communications_tower" ||
              tags.building === "tower" ||
              Boolean(tags["tower:type"])
            ? "tower"
            : tags.building
              ? "building"
              : "other";

      return {
        id: `${element.type}/${element.id}`,
        type,
        name: tags.name ?? "Unnamed obstacle",
        latitude: Number(obstacleLatitude.toFixed(6)),
        longitude: Number(obstacleLongitude.toFixed(6)),
        distanceMeters: Number(distance.toFixed(1)),
        bearingDeg: Number(bearing.toFixed(1)),
        heightMeters: height.meters,
        heightSource: height.source,
        tags,
        shadowRisk: classifyShadow(
          height.meters,
          distance,
          bearing,
          currentSun,
        ),
        estimatedShadowReachMeters:
          shadowReach === null ? null : Number(shadowReach.toFixed(1)),
      } satisfies SolarObstacle;
    })
    .filter((obstacle): obstacle is SolarObstacle => Boolean(obstacle))
    .sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2, unknown: 3 };
      return (
        riskOrder[a.shadowRisk] - riskOrder[b.shadowRisk] ||
        a.distanceMeters - b.distanceMeters
      );
    })
    .slice(0, 50);

  const likelyShadowDirections = obstacles
    .filter((obstacle) => obstacle.shadowRisk === "high" || obstacle.shadowRisk === "medium")
    .slice(0, 8)
    .map((obstacle) => directionName((obstacle.bearingDeg + 180) % 360));

  return {
    provider: "OpenStreetMap Overpass",
    radiusMeters: safeRadius,
    obstacles,
    likelyShadowDirections: Array.from(new Set(likelyShadowDirections)),
    caveats: [
      "OpenStreetMap coverage varies by area; an unmapped building or tower will not appear here.",
      "Obstacle heights use OSM height/building-level tags when available and conservative estimates otherwise.",
      "Shadow risk is a geometric estimate using the current sun position; it is not a substitute for a site survey or high-resolution 3D/shade model.",
      "The current analysis does not prove that a specific roof point is shaded.",
    ],
    attribution: "© OpenStreetMap contributors",
  };
}
