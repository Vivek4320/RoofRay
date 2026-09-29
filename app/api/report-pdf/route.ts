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

function buildPdf(lines: string[]): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const lineHeight = 16;
  const linesPerPage = 42;
  const pages: string[][] = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(["RoofRay Solar Feasibility Report"]);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" + pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ") + "] /Count " + pages.length + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (let i = 0; i < pages.length; i++) {
    const pageObject = 5 + i * 2;
    const contentObject = pageObject + 1;
    const contentLines = [
      "BT",
      "/F2 18 Tf",
      `${margin} ${pageHeight - 58} Td`,
      "(RoofRay Solar Feasibility Report) Tj",
      "/F1 10 Tf",
      "0 -28 Td",
      ...pages[i].flatMap((line, index) => [
        `(${text(line)}) Tj`,
        ...(index === pages[i].length - 1 ? [] : [`0 -${lineHeight} Td`]),
      ]),
      "ET",
    ];
    const stream = contentLines.join("\n");
    objects[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
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

    const pdf = buildPdf(lines);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="RoofRay-Solar-Report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[RoofRay] PDF generation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to generate the PDF report." }, { status: 500 });
  }
}
