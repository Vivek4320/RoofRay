export type RoofFootprint = {
  provider: "OpenStreetMap Overpass";
  buildingId: string;
  latitude: number;
  longitude: number;
  areaM2: number;
  perimeterM: number;
  polygon: Array<{ latitude: number; longitude: number }>;
  dimensionsM: { width: number; length: number };
  orientation: {
    azimuthDeg: number;
    direction: string;
    source: "longest-footprint-edge";
  };
  shape: "polygon";
  confidence: "high" | "medium" | "low";
  attribution: "© OpenStreetMap contributors";
  caveats: string[];
};

type Element = {
  type: string;
  id: number;
  center?: { lat?: number; lon?: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function toXY(lat: number, lon: number, originLat: number, originLon: number) {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((originLat * Math.PI) / 180);
  return {
    x: (lon - originLon) * mPerDegLon,
    y: (lat - originLat) * mPerDegLat,
  };
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    sum += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: Array<{ x: number; y: number }>) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    total += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return total;
}

function containsPoint(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function directionName(deg: number) {
  const directions = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
  return directions[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function footprintOrientation(points: Array<{ x: number; y: number }>) {
  let longest = { dx: 1, dy: 0, length: 0 };
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const dx = next.x - points[i].x;
    const dy = next.y - points[i].y;
    const length = Math.hypot(dx, dy);
    if (length > longest.length) longest = { dx, dy, length };
  }

  // x is east-west and y is north-south.
  let azimuth = (Math.atan2(longest.dx, longest.dy) * 180) / Math.PI;
  azimuth = (azimuth + 360) % 360;
  if (azimuth >= 180) azimuth -= 180;

  return {
    azimuthDeg: Number(azimuth.toFixed(1)),
    direction: directionName(azimuth),
    source: "longest-footprint-edge" as const,
  };
}

function dimensions(points: Array<{ x: number; y: number }>) {
  let maxWidth = 0;
  let maxLength = 0;

  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const edge = Math.hypot(next.x - points[i].x, next.y - points[i].y);
    maxLength = Math.max(maxLength, edge);
  }

  // Bounding-box dimensions are more useful than a raw polygon edge for irregular footprints.
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  maxWidth = Math.max(...xs) - Math.min(...xs);
  const bboxLength = Math.max(...ys) - Math.min(...ys);

  return {
    width: Number(Math.max(maxWidth, 0).toFixed(1)),
    length: Number(Math.max(bboxLength, maxLength, 0).toFixed(1)),
  };
}

export async function getRoofFootprint(
  latitude: number,
  longitude: number,
  radiusMeters = 80,
): Promise<RoofFootprint | null> {
  const radius = Math.min(Math.max(Math.round(radiusMeters), 20), 200);

  const query = `[out:json][timeout:20];
(
  way["building"](around:${radius},${latitude},${longitude});
  relation["building"](around:${radius},${latitude},${longitude});
);
out geom tags center qt;`;

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
    throw new Error(`Roof footprint lookup failed (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as { elements?: Element[] };
  const candidates = (data.elements ?? [])
    .filter((element) => Array.isArray(element.geometry) && element.geometry.length >= 3)
    .map((element) => {
      const geometry = element.geometry!;
      const polygon = geometry.map((point) => ({
        latitude: point.lat,
        longitude: point.lon,
      }));

      const projected = polygon.map((point) =>
        toXY(point.latitude, point.longitude, latitude, longitude),
      );
      const userPoint = { x: 0, y: 0 };
      const areaM2 = polygonArea(projected);
      const perimeterM = polygonPerimeter(projected);

      return {
        element,
        polygon,
        projected,
        areaM2,
        perimeterM,
        containsUser: containsPoint(userPoint, projected),
      };
    })
    .filter((candidate) => candidate.areaM2 >= 15 && candidate.areaM2 <= 100000)
    .sort((a, b) => {
      if (a.containsUser !== b.containsUser) return a.containsUser ? -1 : 1;
      return a.areaM2 - b.areaM2;
    });

  const selected = candidates[0];
  if (!selected) return null;

  const dimensionsM = dimensions(selected.projected);
  const orientation = footprintOrientation(selected.projected);
  const confidence = selected.containsUser
    ? selected.element.tags?.building === "house" ||
      selected.element.tags?.building === "residential"
      ? "high"
      : "medium"
    : "low";

  return {
    provider: "OpenStreetMap Overpass",
    buildingId: `${selected.element.type}/${selected.element.id}`,
    latitude,
    longitude,
    areaM2: Number(selected.areaM2.toFixed(1)),
    perimeterM: Number(selected.perimeterM.toFixed(1)),
    polygon: selected.polygon.map((point) => ({
      latitude: Number(point.latitude.toFixed(6)),
      longitude: Number(point.longitude.toFixed(6)),
    })),
    dimensionsM,
    orientation,
    shape: "polygon",
    confidence,
    attribution: "© OpenStreetMap contributors",
    caveats: [
      "This is the mapped building footprint, not a measured roof surface.",
      "The footprint may be missing, incomplete, or outdated.",
      "Roof pitch, parapets, rooftop equipment, and individual roof faces are not derived from this footprint.",
    ],
  };
}
