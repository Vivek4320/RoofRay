import { NextResponse } from "next/server";

type PdfBody = {
  report?: unknown;
  solarContext?: Record<string, unknown> | null;
  userInputs?: Record<string, unknown> | null;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[^ -~]/g, "")
    .replace(/[()\\]/g, (char) => "\\" + char);
}

function wrap(value: unknown, width = 88): string[] {
  const source = text(value).replace(/\s+/g, " ").trim();
  if (!source) return [];
  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function reportNumber(report: string, pattern: RegExp): number | null {
  const match = report.match(pattern);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

type MappedBuilding = {
  polygon: Array<{ latitude: number; longitude: number }>;
  areaM2: number;
  containsTarget: boolean;
};

type SatelliteTile = {
  name: string;
  bytes: Uint8Array;
  x: number;
  y: number;
  w: number;
  h: number;
};

function webMercatorPixel(latitude: number, longitude: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const x = ((longitude + 180) / 360) * size;
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const y =
    (0.5 -
      Math.log((1 + sinLat) / Math.max(1e-12, 1 - sinLat)) /
        (4 * Math.PI)) *
    size;
  return { x, y, size };
}

async function fetchSatelliteTiles(
  latitude: number,
  longitude: number,
  zoom = 18,
): Promise<SatelliteTile[]> {
  const center = webMercatorPixel(latitude, longitude, zoom);
  const centerTileX = Math.floor(center.x / 256);
  const centerTileY = Math.floor(center.y / 256);
  const startX = centerTileX - 1;
  const startY = centerTileY - 1;
  const tiles: SatelliteTile[] = [];

  const jobs: Array<Promise<void>> = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const tileX = startX + col;
      const tileY = startY + row;
      const url =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" +
        zoom +
        "/" +
        tileY +
        "/" +
        tileX;
      jobs.push(
        fetch(url, {
          cache: "no-store",
          headers: { Accept: "image/jpeg,image/*" },
          signal: AbortSignal.timeout(8000),
        })
          .then(async (response) => {
            if (!response.ok) return;
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length < 1000) return;
            tiles.push({
              name: "ImSat" + row + "_" + col,
              bytes,
              x: col * 128,
              y: (2 - row) * 120,
              w: 128,
              h: 120,
            });
          })
          .catch(() => undefined),
      );
    }
  }

  await Promise.all(jobs);
  return tiles.sort((a, b) => a.name.localeCompare(b.name));
}

function pointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

async function fetchMappedBuildings(
  latitude: number,
  longitude: number,
  radiusMeters = 140,
): Promise<MappedBuilding[]> {
  const query = `[out:json][timeout:20];
way["building"](around:${Math.min(Math.max(radiusMeters, 60), 200)},${latitude},${longitude});
out geom tags qt;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "data=" + encodeURIComponent(query),
    cache: "no-store",
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    elements?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  };
  const mLat = 111320;
  const mLon = 111320 * Math.cos((latitude * Math.PI) / 180);
  const area = (points: Array<{ x: number; y: number }>) => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const n = points[(i + 1) % points.length];
      sum += points[i].x * n.y - n.x * points[i].y;
    }
    return Math.abs(sum) / 2;
  };

  return (data.elements ?? [])
    .map((element) => {
      const geo = element.geometry ?? [];
      const projected = geo.map((p) => ({
        x: (p.lon - longitude) * mLon,
        y: (p.lat - latitude) * mLat,
      }));
      return {
        polygon: geo.map((p) => ({ latitude: p.lat, longitude: p.lon })),
        areaM2: area(projected),
        containsTarget: projected.length >= 3 && pointInPolygon({ x: 0, y: 0 }, projected),
      };
    })
    .filter((item) => item.polygon.length >= 3 && item.areaM2 >= 12 && item.areaM2 <= 100000)
    .sort((a, b) => {
      if (a.containsTarget !== b.containsTarget) return a.containsTarget ? -1 : 1;
      return a.areaM2 - b.areaM2;
    })
    .slice(0, 35);
}


function roofVisualCommands({
  roofAreaSqFt,
  roofType,
  panelCount,
  panelPowerW,
  direction,
  slopeDeg,
  roofFootprint,
  obstacles,
  sunCycle,
  mappedBuildings,
  satelliteTiles,
}: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
  roofFootprint: Record<string, unknown> | null;
  obstacles: Array<Record<string, unknown>>;
  sunCycle: Record<string, unknown> | null;
  mappedBuildings: MappedBuilding[];
  satelliteTiles: SatelliteTile[];
}): string[] {
  const safePanels = Math.max(0, Math.min(40, Math.round(panelCount ?? 0)));
  const roofPolygon = Array.isArray(roofFootprint?.polygon)
    ? roofFootprint.polygon as Array<Record<string, unknown>>
    : [];
  const mappedTarget = mappedBuildings.find((building) => building.containsTarget) ?? null;
  const actualRoofPolygon = roofPolygon.length >= 3
    ? roofPolygon
    : (mappedTarget?.polygon ?? []);
  const roofLat = numberValue(roofFootprint?.latitude);
  const roofLon = numberValue(roofFootprint?.longitude);
  const mapX = 55, mapY = 315, mapW = 502, mapH = 360;
  const centerLat =
    roofLat ??
    numberValue((actualRoofPolygon[0] ?? {}).latitude) ??
    0;
  const centerLon =
    roofLon ??
    numberValue((actualRoofPolygon[0] ?? {}).longitude) ??
    0;
  const satelliteZoom = 18;
  const centerPixel = webMercatorPixel(centerLat, centerLon, satelliteZoom);
  const startTileX = Math.floor(centerPixel.x / 256) - 1;
  const startTileY = Math.floor(centerPixel.y / 256) - 1;
  const project = (lat: number, lon: number) => {
    const pixel = webMercatorPixel(lat, lon, satelliteZoom);
    const relativeX = pixel.x - startTileX * 256;
    const relativeY = pixel.y - startTileY * 256;
    return {
      x: mapX + (relativeX / 1024) * mapW,
      y: mapY + mapH - (relativeY / 768) * mapH,
    };
  };
  const clampPoint = (p: { x: number; y: number }) => ({
    x: Math.max(mapX + 8, Math.min(mapX + mapW - 8, p.x)),
    y: Math.max(mapY + 8, Math.min(mapY + mapH - 8, p.y)),
  });
  const commands: string[] = [
    "0.96 0.97 0.98 rg", mapX + " " + mapY + " " + mapW + " " + mapH + " re f",
  ];
  if (satelliteTiles.length) {
    commands.push(
      "q",
      mapX + " " + mapY + " " + mapW + " " + mapH + " re W n",
    );
    for (const tile of satelliteTiles) {
      commands.push(
        "q",
        tile.w.toFixed(1) + " 0 0 " + tile.h.toFixed(1) + " " + (mapX + tile.x).toFixed(1) + " " + (mapY + tile.y).toFixed(1) + " cm",
        "/" + tile.name + " Do",
        "Q",
      );
    }
    commands.push("Q");
  }
  commands.push(
    "0.95 0.95 0.95 RG", "1 w", mapX + " " + mapY + " " + mapW + " " + mapH + " re S",
  );

  const mappedNeighborhood = mappedBuildings.filter((building) => building !== mappedTarget);
  for (const building of mappedNeighborhood) {
    const points = building.polygon.map((point) => clampPoint(project(point.latitude, point.longitude)));
    if (points.length < 3) continue;
    commands.push("0.72 0.74 0.78 rg", points[0].x.toFixed(1) + " " + points[0].y.toFixed(1) + " m");
    for (let i = 1; i < points.length; i += 1) commands.push(points[i].x.toFixed(1) + " " + points[i].y.toFixed(1) + " l");
    commands.push("h f", "0.45 0.48 0.52 RG", "0.7 w", points[0].x.toFixed(1) + " " + points[0].y.toFixed(1) + " m");
    for (let i = 1; i < points.length; i += 1) commands.push(points[i].x.toFixed(1) + " " + points[i].y.toFixed(1) + " l");
    commands.push("h S");
  }

  const sortedObstacles = [...obstacles]
    .filter((item) => numberValue(item.distanceMeters) !== null)
    .sort((a, b) => (numberValue(a.distanceMeters) ?? 9999) - (numberValue(b.distanceMeters) ?? 9999))
    .slice(0, 12);

  for (const obstacle of sortedObstacles) {
    const lat = numberValue(obstacle.latitude);
    const lon = numberValue(obstacle.longitude);
    if (lat === null || lon === null) continue;
    const p = clampPoint(project(lat, lon));
    const height = numberValue(obstacle.heightMeters) ?? 6;
    const radius = Math.max(7, Math.min(22, 7 + height * 0.9));
    commands.push("0.72 0.74 0.78 rg", (p.x - radius).toFixed(1) + " " + (p.y - radius).toFixed(1) + " " + (radius * 2).toFixed(1) + " " + (radius * 2).toFixed(1) + " re f");
    commands.push("0.45 0.48 0.52 RG", "0.8 w", (p.x - radius).toFixed(1) + " " + (p.y - radius).toFixed(1) + " " + (radius * 2).toFixed(1) + " " + (radius * 2).toFixed(1) + " re S");
  }

  const roofPoints = actualRoofPolygon
    .map((point) => {
      const lat = numberValue(point.latitude);
      const lon = numberValue(point.longitude);
      return lat !== null && lon !== null ? project(lat, lon) : null;
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));

  if (roofPoints.length >= 3) {
    commands.push("0.10 0.55 0.95 RG", "3 w", roofPoints[0].x.toFixed(1) + " " + roofPoints[0].y.toFixed(1) + " m");
    for (let i = 1; i < roofPoints.length; i += 1) commands.push(roofPoints[i].x.toFixed(1) + " " + roofPoints[i].y.toFixed(1) + " l");
    commands.push("h S");
    for (let i = 1; i < roofPoints.length; i += 1) commands.push(roofPoints[i].x.toFixed(1) + " " + roofPoints[i].y.toFixed(1) + " l");
    commands.push("h S");
  }

  const minX = roofPoints.length ? Math.min(...roofPoints.map((p) => p.x)) : mapX + 150;
  const maxX = roofPoints.length ? Math.max(...roofPoints.map((p) => p.x)) : mapX + 350;
  const minY = roofPoints.length ? Math.min(...roofPoints.map((p) => p.y)) : mapY + 120;
  const maxY = roofPoints.length ? Math.max(...roofPoints.map((p) => p.y)) : mapY + 270;
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, safePanels))));
  const rows = Math.max(1, Math.ceil(safePanels / cols));
  const pad = 10;
  const pw = Math.max(5, (maxX - minX - pad * 2 - (cols - 1) * 3) / cols);
  const ph = Math.max(5, (maxY - minY - pad * 2 - (rows - 1) * 3) / rows);
  for (let i = 0; i < safePanels; i += 1) {
    const row = Math.floor(i / cols), col = i % cols;
    const x = minX + pad + col * (pw + 3);
    const y = maxY - pad - (row + 1) * ph - row * 3;
    commands.push("0.08 0.25 0.50 rg", x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re f");
    commands.push("0.65 0.80 0.98 RG", "0.6 w", x.toFixed(1) + " " + y.toFixed(1) + " " + pw.toFixed(1) + " " + ph.toFixed(1) + " re S");
  }

  const cycle = Array.isArray((sunCycle ?? {}).next12Hours)
    ? (sunCycle as { next12Hours: Array<Record<string, unknown>> }).next12Hours
    : [];
  const houseCenter = roofPoints.length
    ? { x: roofPoints.reduce((a, p) => a + p.x, 0) / roofPoints.length, y: roofPoints.reduce((a, p) => a + p.y, 0) / roofPoints.length }
    : { x: mapX + mapW / 2, y: mapY + mapH / 2 };
  const sunRadius = 95;
  const sunPoints = cycle
    .filter((sample) => sample.aboveHorizon !== false && numberValue(sample.azimuthDeg) !== null)
    .slice(0, 8)
    .map((sample) => {
      const az = (numberValue(sample.azimuthDeg) ?? 0) * Math.PI / 180;
      const el = Math.max(0.15, Math.min(1, (numberValue(sample.elevationDeg) ?? 10) / 90));
      return { x: houseCenter.x + Math.sin(az) * sunRadius, y: houseCenter.y + Math.cos(az) * sunRadius * el };
    });
  if (sunPoints.length >= 2) {
    commands.push("0.95 0.55 0.05 RG", "2 w", sunPoints[0].x.toFixed(1) + " " + sunPoints[0].y.toFixed(1) + " m");
    for (let i = 1; i < sunPoints.length; i += 1) commands.push(sunPoints[i].x.toFixed(1) + " " + sunPoints[i].y.toFixed(1) + " l");
    commands.push("S");
  }
  for (const point of sunPoints) commands.push("0.98 0.60 0.05 rg", (point.x - 5).toFixed(1) + " " + (point.y - 5).toFixed(1) + " 10 10 re f");

  commands.push("0 0 0 RG", "1 w",
    houseCenter.x.toFixed(1) + " " + (houseCenter.y + 20).toFixed(1) + " m " + houseCenter.x.toFixed(1) + " " + (houseCenter.y - 45).toFixed(1) + " l S",
    houseCenter.x.toFixed(1) + " " + (houseCenter.y - 45).toFixed(1) + " m " + (houseCenter.x - 5).toFixed(1) + " " + (houseCenter.y - 37).toFixed(1) + " l S",
    houseCenter.x.toFixed(1) + " " + (houseCenter.y - 45).toFixed(1) + " m " + (houseCenter.x + 5).toFixed(1) + " " + (houseCenter.y - 37).toFixed(1) + " l S");

  const buildingLines = sortedObstacles.slice(0, 5).map((o, index) => {
    const h = numberValue(o.heightMeters), d = numberValue(o.distanceMeters);
    return "#" + (index + 1) + " " + String(o.type ?? "building") + " ~" + (h !== null ? h.toFixed(1) : "?") + "m, " + (d !== null ? d.toFixed(0) : "?") + "m away";
  });

  return [
    ...commands,
    "BT /F2 14 Tf 55 700 Td (REAL LOCATION ROOF + SUN + SHADING MAP) Tj ET",
    "BT /F1 8 Tf 55 687 Td (Mapped roof footprint and nearby obstacles from OpenStreetMap at the detected coordinates.) Tj ET",
    "BT /F2 9 Tf 55 295 Td (LEGEND) Tj ET",
    "BT /F1 8 Tf 55 282 Td (Blue target roof | Dark blue panels | Grey nearby buildings | Orange calculated sun path) Tj ET",
    "BT /F2 9 Tf 55 268 Td (Panel direction) Tj ET",
    "BT /F1 8 Tf 125 268 Td (" + text(direction || "Unavailable") + " | Tilt " + (slopeDeg !== null ? slopeDeg + " deg" : "Unavailable") + ") Tj ET",
    "BT /F2 9 Tf 55 254 Td (Roof input) Tj ET",
    "BT /F1 8 Tf 125 254 Td (" + (roofAreaSqFt !== null ? Math.round(roofAreaSqFt) + " sq ft" : "Unavailable") + " | " + text(roofType || "Unavailable") + ") Tj ET",
    "BT /F2 9 Tf 55 240 Td (Panels) Tj ET",
    "BT /F1 8 Tf 125 240 Td (" + (safePanels || "Unavailable") + " x " + (panelPowerW ?? 450) + " W) Tj ET",
    "BT /F2 9 Tf 55 226 Td (Nearby mapped buildings) Tj ET",
    ...buildingLines.flatMap((line, i) => ["BT /F1 8 Tf 125 " + (226 - i * 11) + " Td (" + text(line) + ") Tj ET"]),
    "BT /F1 8 Tf 55 150 Td (North is upward. Sun positions use the detected coordinates and current analysis time.) Tj ET",
    "BT /F1 8 Tf 55 138 Td (Mapped footprint is not a survey-grade roof measurement; unmapped buildings may be absent.) Tj ET",
    "BT /F1 8 Tf 55 126 Td (Source: " + text(roofFootprint?.attribution ?? "OpenStreetMap contributors") + ".) Tj ET",
  ];
}

function buildPdf(lines: string[], visual: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
  roofFootprint: Record<string, unknown> | null;
  obstacles: Array<Record<string, unknown>>;
  sunCycle: Record<string, unknown> | null;
  mappedBuildings: MappedBuilding[];
  satelliteTiles: SatelliteTile[];
}): Uint8Array {
  const pageWidth = 612, pageHeight = 792, margin = 48, lineHeight = 16, linesPerPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(["RoofRay Solar Feasibility Report"]);

  const visualPageIndex = pages.length;
  const totalPages = pages.length + 1;
  const imageObjects = visual.satelliteTiles.map((_, index) => 5 + index);
  const pageObjectStart = 5 + visual.satelliteTiles.length;
  const objects: Array<string | Buffer> = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" +
    Array.from({ length: totalPages }, (_, i) => (pageObjectStart + i * 2) + " 0 R").join(" ") +
    "] /Count " + totalPages + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (let i = 0; i < visual.satelliteTiles.length; i += 1) {
    const tile = visual.satelliteTiles[i];
    objects.push(
      Buffer.concat([
        Buffer.from(
          "<< /Type /XObject /Subtype /Image /Width 256 /Height 256 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          tile.bytes.length +
          " >>\nstream\n",
          "ascii",
        ),
        Buffer.from(tile.bytes),
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  for (let i = 0; i < totalPages; i += 1) {
    const pageObject = pageObjectStart + i * 2;
    const contentObject = pageObject + 1;
    const xObjectEntries = i === visualPageIndex && visual.satelliteTiles.length
      ? " /XObject << " +
        visual.satelliteTiles.map((tile) => "/" + tile.name + " " + (5 + visual.satelliteTiles.indexOf(tile)) + " 0 R").join(" ") +
        " >>"
      : "";
    const contentLines = i === visualPageIndex
      ? ["BT /F2 18 Tf 48 742 Td (RoofRay Roof + Sun Direction Plan) Tj ET", ...roofVisualCommands(visual)]
      : ["BT", "/F2 18 Tf", margin + " " + (pageHeight - 58) + " Td", "(RoofRay Solar Feasibility Report) Tj", "/F1 10 Tf", "0 -28 Td",
        ...pages[i].flatMap((line, index) => ["(" + text(line) + ") Tj", ...(index === pages[i].length - 1 ? [] : ["0 -" + lineHeight + " Td"])]), "ET"];

    const stream = contentLines.join("\n");
    objects[pageObject - 1] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight +
      "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>" + xObjectEntries +
      " >> /Contents " + contentObject + " 0 R >>";
    objects[contentObject - 1] = Buffer.from(
      "<< /Length " + Buffer.byteLength(stream, "utf8") + " >>\nstream\n" +
      stream + "\nendstream",
      "utf8",
    );
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (let i = 0; i < objects.length; i += 1) {
    offsets[i + 1] = byteOffset;
    const objectHeader = Buffer.from((i + 1) + " 0 obj\n", "ascii");
    const objectBody = typeof objects[i] === "string"
      ? Buffer.from(objects[i] as string, "utf8")
      : objects[i] as Buffer;
    const objectEnd = Buffer.from("\nendobj\n", "ascii");
    chunks.push(objectHeader, objectBody, objectEnd);
    byteOffset += objectHeader.length + objectBody.length + objectEnd.length;
  }

  const xrefOffset = byteOffset;
  const xrefParts: string[] = [
    "xref",
    "0 " + (objects.length + 1),
    "0000000000 65535 f ",
  ];
  for (let i = 1; i <= objects.length; i += 1) {
    xrefParts.push(String(offsets[i]).padStart(10, "0") + " 00000 n ");
  }
  xrefParts.push(
    "trailer",
    "<< /Size " + (objects.length + 1) + " /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  chunks.push(Buffer.from(xrefParts.join("\n") + "\n", "ascii"));
  return new Uint8Array(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfBody;
    const context = body.solarContext ?? {};
    const planning = (context.planningEstimate ?? {}) as Record<string, unknown>;
    const weather = (context.weather ?? {}) as Record<string, any>;
    const currentWeather = (weather.current ?? {}) as Record<string, unknown>;
    const dailyWeather = (weather.daily ?? {}) as Record<string, unknown>;
    const inputs = body.userInputs ?? {};

    const size = numberValue(planning.systemSizeKw);
    const panels = numberValue(planning.panelCount);
    const monthly = numberValue(planning.averageMonthlyGenerationKwh);
    const annual = numberValue(planning.annualGenerationAfterEstimatedShadingKwh);
    const shade = numberValue(planning.estimatedShadingPercent);
    const roof = numberValue(planning.roofAreaSqFt);
    const bill = numberValue(inputs.monthlyBillInr);
    const lat = numberValue((planning.location as Record<string, unknown> | undefined)?.latitude);
    const lon = numberValue((planning.location as Record<string, unknown> | undefined)?.longitude);
    const mappedBuildings =
      lat !== null && lon !== null
        ? await fetchMappedBuildings(lat, lon)
        : [];
    const satelliteTiles =
      lat !== null && lon !== null
        ? await fetchSatelliteTiles(lat, lon)
        : [];
    const reportText = String(body.report ?? "");
    const reportSize = reportNumber(reportText, /Recommended capacity:\s*~?([\d,.]+)\s*kW/i);
    const reportPanels = reportNumber(reportText, /Panels:\s*([\d,.]+)\s*[×x]/i);
    const reportMonthly = reportNumber(reportText, /Expected generation:\s*~?([\d,.]+)\s*kWh\/month/i);
    const reportAnnual = reportNumber(reportText, /\|\s*~?([\d,.]+)\s*kWh\/year/i);
    const reportShade = reportNumber(reportText, /Estimated shading:\s*~?([\d,.]+)%/i);
    const dailyGeneration = numberValue(planning.averageDailyGenerationKwh);
    const monthlyGeneration = Array.isArray(planning.monthlyGenerationKwh)
      ? planning.monthlyGenerationKwh as Array<Record<string, unknown>>
      : [];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const lines = [
      "Generated from the final RoofRay site analysis.",
      "",
      ...wrap(`Customer: ${inputs.name ?? "Not provided"}`),
      ...wrap(`Location: ${lat !== null && lon !== null ? lat.toFixed(5) + ", " + lon.toFixed(5) : "Detected location"}`),
      ...wrap(`Roof area: ${roof !== null ? roof + " sq ft" : "Not available"}`),
      ...wrap(`Roof type: ${inputs.roofType ?? "Not provided"}`),
      ...wrap(`Monthly electricity bill: ${bill !== null ? "Rs. " + Math.round(bill) : "Not provided"}`),
      "",
      "Solar feasibility",
      ...wrap(`Recommended system size: ${(reportSize ?? size) !== null ? (reportSize ?? size)!.toFixed(2) + " kW" : "Unavailable"}`),
      ...wrap(`Estimated panels: ${(reportPanels ?? panels) !== null ? Math.round(reportPanels ?? panels) : "Unavailable"}`),
      ...wrap(`Estimated generation: ${(reportMonthly ?? monthly) !== null ? (reportMonthly ?? monthly) + " kWh/month" : "Unavailable"}${(reportAnnual ?? annual) !== null ? " | " + (reportAnnual ?? annual) + " kWh/year" : ""}`),
      ...wrap(`Average expected generation: ${dailyGeneration !== null ? dailyGeneration.toFixed(1) + " kWh/day" : "Unavailable"}`),
      ...wrap(`Estimated shading: ${(reportShade ?? shade) !== null ? (reportShade ?? shade)!.toFixed(1) + "%" : "Unavailable"}`),
      "",
      "Expected monthly generation",
      ...monthlyGeneration.map((item) => {
        const month = numberValue(item.month);
        const expected = numberValue(item.expectedKwh);
        const averageDaily = numberValue(item.averageDailyKwh);
        if (month === null || expected === null) return "";
        const label = monthNames[Math.max(1, Math.min(12, Math.round(month))) - 1];
        return `${label}: ~${Math.round(expected)} kWh/month${averageDaily !== null ? ` (~${averageDaily.toFixed(1)} kWh/day)` : ""}`;
      }).filter(Boolean),
      ...wrap(`Solar direction: ${planning.recommendedDirection ?? "Unavailable"}`),
      ...wrap(`Recommended slope: ${numberValue(planning.recommendedSlopeDeg) !== null ? numberValue(planning.recommendedSlopeDeg) + " deg" : "Unavailable"}`),
      "",
      "Weather and solar conditions",
      ...wrap(`Current temperature: ${numberValue(currentWeather.temperatureC) !== null ? currentWeather.temperatureC + " C" : "Unavailable"}`),
      ...wrap(`Cloud cover: ${numberValue(currentWeather.cloudCoverPercent) !== null ? currentWeather.cloudCoverPercent + "%" : "Unavailable"}`),
      ...wrap(`Current solar radiation: ${numberValue(currentWeather.shortwaveRadiationWm2) !== null ? currentWeather.shortwaveRadiationWm2 + " W/m2" : "Unavailable"}`),
      ...wrap(`Direct normal irradiance: ${numberValue(currentWeather.directNormalIrradianceWm2) !== null ? currentWeather.directNormalIrradianceWm2 + " W/m2" : "Unavailable"}`),
      ...wrap(`Sunrise: ${dailyWeather.sunrise ?? "Unavailable"}`),
      ...wrap(`Sunset: ${dailyWeather.sunset ?? "Unavailable"}`),
      ...wrap(`Daylight duration: ${dailyWeather.daylightDurationHours ?? "Unavailable"} hours`),
      "",
      "Report summary",
      ...wrap(body.report ?? "RoofRay report unavailable."),
      "",
      "Planning note: These are location-based planning estimates. Final panel layout, structure, electrical design and shading assessment require a physical site assessment.",
      "Data sources: OpenStreetMap Overpass, RoofRay sun-position calculation, Open-Meteo and PVGIS.",
    ];

    const pdf = buildPdf(lines, {
      roofAreaSqFt: roof,
      roofType: String(inputs.roofType ?? "Roof type unavailable"),
      panelCount: panels,
      panelPowerW: numberValue(planning.panelPowerW),
      direction: String(planning.recommendedDirection ?? "Unavailable"),
      slopeDeg: numberValue(planning.recommendedSlopeDeg),
      roofFootprint: (context.roof ?? null) as Record<string, unknown> | null,
      obstacles: Array.isArray((context.obstacles as Record<string, unknown> | undefined)?.obstacles)
        ? ((context.obstacles as Record<string, unknown>).obstacles as Array<Record<string, unknown>>)
        : [],
      sunCycle: (context.sunCycle ?? null) as Record<string, unknown> | null,
      mappedBuildings,
      satelliteTiles,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="RoofRay-Solar-Report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[RoofRay] PDF generation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to generate the PDF report." }, { status: 500 });
  }
}
