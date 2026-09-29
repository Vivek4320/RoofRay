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


function roofVisualCommands({
  roofAreaSqFt,
  roofType,
  panelCount,
  panelPowerW,
  direction,
  slopeDeg,
}: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
}): string[] {
  const safePanels = Math.max(0, Math.min(40, Math.round(panelCount ?? 0)));
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, safePanels))));
  const rows = Math.max(1, Math.ceil(safePanels / cols));
  const roofX = 86, roofY = 300, roofW = 440, roofH = 250, gap = 7;
  const panelW = Math.max(24, Math.min(70, (roofW - 36 - (cols - 1) * gap) / cols));
  const panelH = Math.max(24, Math.min(55, (roofH - 36 - (rows - 1) * gap) / rows));
  const usedW = cols * panelW + (cols - 1) * gap;
  const usedH = rows * panelH + (rows - 1) * gap;
  const startX = roofX + (roofW - usedW) / 2;
  const startY = roofY + (roofH - usedH) / 2;
  const commands: string[] = [
    "0.10 0.18 0.30 rg",
    roofX + " " + roofY + " " + roofW + " " + roofH + " re f",
    "0.35 0.55 0.90 RG", "2 w",
    roofX + " " + roofY + " " + roofW + " " + roofH + " re S",
    "0.18 0.35 0.65 rg",
  ];
  for (let i = 0; i < safePanels; i += 1) {
    const row = Math.floor(i / cols), col = i % cols;
    const x = startX + col * (panelW + gap);
    const y = startY + (rows - row - 1) * (panelH + gap);
    commands.push(x.toFixed(1) + " " + y.toFixed(1) + " " + panelW.toFixed(1) + " " + panelH.toFixed(1) + " re f");
    commands.push("0.55 0.75 1.0 RG", "0.7 w", x.toFixed(1) + " " + y.toFixed(1) + " " + panelW.toFixed(1) + " " + panelH.toFixed(1) + " re S");
    commands.push("0.18 0.35 0.65 rg");
  }
  commands.push(
    "0 0 0 RG", "1 w",
    "455 620 m 500 680 545 620 590 620 c S",
    "500 660 m 500 590 l S",
    "500 660 m 492 648 l S",
    "500 660 m 508 648 l S",
    "0.95 0.65 0.10 rg", "495 675 10 10 re f", "0 0 0 RG",
  );
  return [
    ...commands,
    "BT /F2 11 Tf 86 570 Td (CONCEPTUAL ROOF PLAN) Tj ET",
    "BT /F1 9 Tf 86 552 Td (Top view based on entered roof area and planning panel count.) Tj ET",
    "BT /F1 8 Tf 86 538 Td (Planning diagram only - not a satellite-measured roof footprint.) Tj ET",
    "BT /F2 10 Tf 86 285 Td (Panels) Tj ET",
    "BT /F1 9 Tf 130 285 Td (" + (safePanels || "Unavailable") + " x " + (panelPowerW ?? 450) + " W) Tj ET",
    "BT /F2 10 Tf 86 268 Td (Roof) Tj ET",
    "BT /F1 9 Tf 130 268 Td (" + (roofAreaSqFt !== null ? Math.round(roofAreaSqFt) + " sq ft" : "Unavailable") + " | " + text(roofType || "Roof type unavailable") + ") Tj ET",
    "BT /F2 10 Tf 86 650 Td (SUN PATH) Tj ET",
    "BT /F1 9 Tf 86 635 Td (Sun rises East, crosses the southern sky, and sets West.) Tj ET",
    "BT /F1 9 Tf 86 620 Td (Exact daily path changes with date and location.) Tj ET",
    "BT /F2 10 Tf 455 555 Td (EAST) Tj ET",
    "BT /F2 10 Tf 545 555 Td (WEST) Tj ET",
    "BT /F2 10 Tf 487 695 Td (SOUTH) Tj ET",
    "BT /F1 9 Tf 455 540 Td (Recommended panel direction) Tj ET",
    "BT /F2 10 Tf 455 525 Td (" + text(direction || "Unavailable") + ") Tj ET",
    "BT /F1 9 Tf 455 510 Td (Tilt: " + (slopeDeg !== null ? slopeDeg + " deg" : "Unavailable") + ") Tj ET",
  ];
}

function buildPdf(lines: string[], visual: {
  roofAreaSqFt: number | null;
  roofType: string;
  panelCount: number | null;
  panelPowerW: number | null;
  direction: string;
  slopeDeg: number | null;
}): Uint8Array {
  const pageWidth = 612, pageHeight = 792, margin = 48, lineHeight = 16, linesPerPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(["RoofRay Solar Feasibility Report"]);
  const visualPageIndex = pages.length;
  const totalPages = pages.length + 1;
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" + Array.from({ length: totalPages }, (_, i) => (5 + i * 2) + " 0 R").join(" ") + "] /Count " + totalPages + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  for (let i = 0; i < totalPages; i++) {
    const pageObject = 5 + i * 2, contentObject = pageObject + 1;
    const contentLines = i === visualPageIndex
      ? ["BT /F2 18 Tf 48 742 Td (RoofRay Roof + Sun Direction Plan) Tj ET", ...roofVisualCommands(visual)]
      : ["BT", "/F2 18 Tf", margin + " " + (pageHeight - 58) + " Td", "(RoofRay Solar Feasibility Report) Tj", "/F1 10 Tf", "0 -28 Td",
        ...pages[i].flatMap((line, index) => ["(" + text(line) + ") Tj", ...(index === pages[i].length - 1 ? [] : ["0 -" + lineHeight + " Td"])]), "ET"];
    const stream = contentLines.join("\n");
    objects[pageObject - 1] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentObject + " 0 R >>";
    objects[contentObject - 1] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
  }
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = pdf.length;
    pdf += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = pdf.length;
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return new TextEncoder().encode(pdf);
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
