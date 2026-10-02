import { NextResponse } from "next/server";

type PdfBody = {
  report?: unknown;
  solarContext?: Record<string, unknown> | null;
  userInputs?: Record<string, unknown> | null;
};

function pdfText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[^ -~]/g, "")
    .replace(/[()\\]/g, (char) => "\\" + char);
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validCoordinate(value: unknown, min: number, max: number): number | null {
  const n = numberValue(value);
  return n !== null && n >= min && n <= max ? n : null;
}

function resolveReportLocation(
  context: Record<string, unknown>,
  planning: Record<string, unknown>,
): { latitude: number; longitude: number } | null {
  const candidates = [
    planning.location as Record<string, unknown> | undefined,
    context.location as Record<string, unknown> | undefined,
    context.roof as Record<string, unknown> | undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const latitude = validCoordinate(candidate.latitude, -90, 90);
    const longitude = validCoordinate(candidate.longitude, -180, 180);
    if (latitude === null || longitude === null) continue;
    if (latitude === 0 && longitude === 0) continue;
    return { latitude, longitude };
  }

  return null;
}

type ApplianceLoadBreakdown = {
  bulbs: number;
  fans: number;
  acs: number;
  refrigerators: number;
  tvs: number;
  pumps: number;
  watts: number;
  kw: number;
};

function parseApplianceLoad(applianceDetails: unknown): ApplianceLoadBreakdown {
  const value = String(applianceDetails ?? "").toLowerCase();

  const quantity = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) return Number(match[1]);
    }
    return 0;
  };

  const bulbs = quantity([
    /(?:bulb|bulbs|light|lights)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:bulb|bulbs|light|lights)/i,
  ]);
  const fans = quantity([
    /(?:fan|fans)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:fan|fans)/i,
  ]);
  const acs = quantity([
    /(?:ac|acs|air\s*conditioner|air\s*conditioners)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:ac|acs|air\s*conditioner|air\s*conditioners)/i,
  ]);
  const refrigerators = quantity([
    /(?:refrigerator|refrigerators|fridge|fridges)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:refrigerator|refrigerators|fridge|fridges)/i,
  ]);
  const tvs = quantity([
    /(?:tv|tvs|television|televisions)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:tv|tvs|television|televisions)/i,
  ]);
  const pumps = quantity([
    /(?:water\s*pump|water\s*pumps|pump|pumps)\s*:\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:water\s*pump|water\s*pumps|pump|pumps)/i,
  ]);

  const watts =
    bulbs * 10 +
    fans * 75 +
    acs * 1500 +
    refrigerators * 200 +
    tvs * 100 +
    pumps * 750;

  return {
    bulbs,
    fans,
    acs,
    refrigerators,
    tvs,
    pumps,
    watts,
    kw: watts / 1000,
  };
}

type SummaryData = {
  locationLabel: string;
  roofAreaSqFt: number | null;
  roofType: string;
  monthlyBillInr: number | null;
  direction: string;
  slopeDeg: number | null;
  systemSizeKw: number | null;
  panelCount: number | null;
  panelPowerW: number;
  averageDailyGenerationKwh: number | null;
  annualGenerationKwh: number | null;
  shadingPercent: number | null;
  monthlyGenerationKwh: Array<Record<string, unknown>>;
  applianceLoad: ApplianceLoadBreakdown;
};

function wrapLines(value: string, width = 94): string[] {
  const source = value.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function headerCommands(title: string, subtitle: string): string[] {
  return [
    "0.02 0.07 0.14 rg",
    "0 535 842 60 re f",
    "0.10 0.58 0.95 rg",
    "0 533 842 2 re f",
    "BT /F2 20 Tf 0.98 0.98 0.98 rg 42 563 Td (RoofRay) Tj ET",
    "BT /F1 8 Tf 0.68 0.82 0.93 rg 42 548 Td (" + pdfText(subtitle) + ") Tj ET",
    "BT /F2 18 Tf 0.02 0.07 0.14 rg 42 508 Td (" + pdfText(title) + ") Tj ET",
  ];
}

function footerCommands(): string[] {
  return [
    "0.10 0.58 0.95 rg",
    "42 34 758 1 re f",
    "BT /F1 6.5 Tf 0.45 0.52 0.60 rg 42 22 Td (RoofRay | Solar planning estimate | Final installation requires site assessment) Tj ET",
  ];
}

function sectionTitleCommands(x: number, y: number, title: string): string[] {
  return [
    "0.02 0.07 0.14 rg",
    x + " " + (y - 18) + " 330 22 re f",
    "BT /F2 10 Tf 0.98 0.98 0.98 rg " + (x + 10) + " " + (y - 12) + " Td (" + pdfText(title) + ") Tj ET",
  ];
}

function cardCommands(
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  note?: string,
): string[] {
  const commands = [
    "0.96 0.98 1 rg",
    x + " " + y + " " + w + " " + h + " re f",
    "0.84 0.88 0.92 RG",
    "0.8 w",
    x + " " + y + " " + w + " " + h + " re S",
    "BT /F1 7 Tf 0.35 0.43 0.52 rg " + (x + 12) + " " + (y + h - 18) + " Td (" + pdfText(title) + ") Tj ET",
    "BT /F2 16 Tf 0.02 0.07 0.14 rg " + (x + 12) + " " + (y + h - 42) + " Td (" + pdfText(value) + ") Tj ET",
  ];

  if (note) {
    commands.push(
      "BT /F1 6.5 Tf 0.45 0.52 0.60 rg " +
        (x + 12) + " " + (y + 14) + " Td (" + pdfText(note) + ") Tj ET",
    );
  }

  return commands;
}

function applianceRow(
  x: number,
  y: number,
  w: number,
  label: string,
  count: number,
  watts: number,
): string[] {
  const total = Math.round(count * watts);
  return [
    "0.98 0.99 1 rg",
    x + " " + (y - 4) + " " + w + " 22 re f",
    "0.90 0.93 0.96 RG",
    "0.4 w",
    x + " " + (y - 4) + " " + w + " 22 re S",
    "BT /F1 7.5 Tf 0.18 0.24 0.30 rg " + (x + 10) + " " + y + " Td (" + pdfText(label) + ") Tj ET",
    "BT /F1 7.5 Tf 0.18 0.24 0.30 rg " + (x + w - 150) + " " + y + " Td (" + count + " × " + watts + "W) Tj ET",
    "BT /F2 7.5 Tf 0.02 0.07 0.14 rg " + (x + w - 58) + " " + y + " Td (~" + total + "W) Tj ET",
  ];
}

function generationBarChartCommands(
  monthly: Array<Record<string, unknown>>,
  x: number,
  y: number,
  width: number,
  height: number,
): string[] {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const points = monthly
    .map((item) => ({
      month: numberValue(item.month),
      monthly: numberValue(item.expectedKwh),
      daily: numberValue(item.averageDailyKwh),
    }))
    .filter((item) => item.month !== null && item.monthly !== null);

  if (!points.length) {
    return [
      "BT /F1 9 Tf 0.35 0.43 0.52 rg " +
        (x + 22) + " " + (y + height / 2) +
        " Td (Monthly generation data is unavailable.) Tj ET",
    ];
  }

  const maxValue = Math.max(...points.map((point) => point.monthly ?? 0), 1);
  const left = x + 54;
  const right = x + width - 18;
  const bottom = y + 72;
  const top = y + height - 42;
  const plotWidth = right - left;
  const plotHeight = top - bottom;
  const gap = 7;
  const barWidth = Math.max(18, (plotWidth - gap * (points.length - 1)) / points.length);

  const commands: string[] = [
    "0.96 0.98 1 rg",
    x + " " + y + " " + width + " " + height + " re f",
    "0.84 0.88 0.92 RG",
    "0.7 w",
    left + " " + bottom + " m " + left + " " + top + " l S",
    left + " " + bottom + " m " + right + " " + bottom + " l S",
    "BT /F2 11 Tf 0.02 0.07 0.14 rg " +
      (x + 20) + " " + (y + height - 18) +
      " Td (Monthly Solar Generation) Tj ET",
    "BT /F1 7 Tf 0.35 0.43 0.52 rg " +
      (x + 20) + " " + (y + height - 31) +
      " Td (Bar height = kWh/month  |  Daily label = month-average kWh/day) Tj ET",
  ];

  for (let i = 0; i <= 4; i += 1) {
    const gy = bottom + (plotHeight * i) / 4;
    const value = (maxValue * i) / 4;
    commands.push(
      "0.90 0.93 0.96 RG",
      "0.45 w",
      left + " " + gy.toFixed(1) + " m " + right + " " + gy.toFixed(1) + " l S",
      "BT /F1 6 Tf 0.42 0.49 0.56 rg " +
        (left - 42) + " " + (gy - 2).toFixed(1) +
        " Td (" + Math.round(value) + ") Tj ET",
    );
  }

  points.forEach((point, index) => {
    const barX = left + index * (barWidth + gap);
    const barH = ((point.monthly ?? 0) / maxValue) * plotHeight;
    const label = months[Math.max(1, Math.min(12, Math.round(point.month ?? 1))) - 1];

    commands.push(
      "0.10 0.58 0.95 rg",
      barX.toFixed(1) + " " + bottom + " " + barWidth.toFixed(1) + " " + barH.toFixed(1) + " re f",
      "0.05 0.20 0.34 RG",
      "0.6 w",
      barX.toFixed(1) + " " + bottom + " " + barWidth.toFixed(1) + " " + barH.toFixed(1) + " re S",
      "BT /F2 6.2 Tf 0.15 0.21 0.28 rg " +
        (barX + Math.max(0, barWidth / 2 - 12)).toFixed(1) + " " + (bottom + barH + 6).toFixed(1) +
        " Td (" + Math.round(point.monthly ?? 0) + ") Tj ET",
      "BT /F2 7 Tf 0.15 0.21 0.28 rg " +
        (barX + Math.max(0, barWidth / 2 - 8)).toFixed(1) + " " + (bottom - 15) +
        " Td (" + label + ") Tj ET",
    );

    if (point.daily !== null) {
      commands.push(
        "BT /F1 5.5 Tf 0.35 0.43 0.52 rg " +
          (barX + Math.max(0, barWidth / 2 - 14)).toFixed(1) + " " + (bottom - 28) +
          " Td (" + point.daily.toFixed(1) + "/day) Tj ET",
      );
    }
  });

  commands.push(
    "BT /F1 7 Tf 0.35 0.43 0.52 rg " +
      (x + 20) + " " + (y + 12) +
      " Td (Monthly totals are modeled outputs; daily values are monthly averages, not fixed guarantees.) Tj ET",
  );

  return commands;
}

function buildPdf(data: SummaryData): Uint8Array {
  const pages = 2;
  const pageWidth = 842;
  const pageHeight = 595;
  const objects: Array<string | Buffer> = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    "<< /Type /Pages /Kids [" +
      Array.from({ length: pages }, (_, i) => (5 + i * 2) + " 0 R").join(" ") +
      "] /Count " + pages + " >>",
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const pageObject = 5 + pageIndex * 2;
    const contentObject = pageObject + 1;
    const commands: string[] = [];

    if (pageIndex === 0) {
      commands.push(...headerCommands("Solar System Recommendation", "ROOFRAY | MAXIMUM ROOF CAPACITY + APPLIANCE LOAD"));
      commands.push(
        "BT /F1 8 Tf 0.35 0.43 0.52 rg 42 482 Td (This page replaces the previous narrative report summary.) Tj ET",
      );

      const maxPanelCount = data.panelCount ?? 0;
      const maxSystemKw = data.systemSizeKw ?? (maxPanelCount * data.panelPowerW / 1000);
      const daily = data.averageDailyGenerationKwh;
      const monthly = data.monthlyGenerationKwh.length
        ? Math.round(
            data.monthlyGenerationKwh.reduce((sum, item) => sum + (numberValue(item.expectedKwh) ?? 0), 0) /
              data.monthlyGenerationKwh.length,
          )
        : null;

      commands.push(...cardCommands(
        42, 392, 244, 70,
        "MAXIMUM PLANNING PANELS",
        data.panelCount !== null ? String(Math.round(maxPanelCount)) + " panels" : "Unavailable",
        data.panelCount !== null ? (String(Math.round(maxPanelCount)) + " × " + Math.round(data.panelPowerW) + "W") : undefined,
      ));
      commands.push(...cardCommands(
        300, 392, 244, 70,
        "SOLAR DC SIZE",
        data.systemSizeKw !== null ? maxSystemKw.toFixed(2) + " kW" : "Unavailable",
        "Roof-area based planning size",
      ));
      commands.push(...cardCommands(
        558, 392, 242, 70,
        "EXPECTED OUTPUT",
        daily !== null ? daily.toFixed(1) + " kWh/day" : monthly !== null ? monthly + " kWh/month" : "Unavailable",
        data.annualGenerationKwh !== null ? Math.round(data.annualGenerationKwh) + " kWh/year" : undefined,
      ));

      commands.push(...sectionTitleCommands(42, 362, "APPLIANCE USAGE → CONNECTED LOAD"));
      let y = 330;
      commands.push(...applianceRow(42, y, 758, "Bulbs / lights", data.applianceLoad.bulbs, 10)); y -= 26;
      commands.push(...applianceRow(42, y, 758, "Fans", data.applianceLoad.fans, 75)); y -= 26;
      commands.push(...applianceRow(42, y, 758, "ACs", data.applianceLoad.acs, 1500)); y -= 26;
      commands.push(...applianceRow(42, y, 758, "Refrigerators", data.applianceLoad.refrigerators, 200)); y -= 26;
      commands.push(...applianceRow(42, y, 758, "TVs", data.applianceLoad.tvs, 100)); y -= 26;
      commands.push(...applianceRow(42, y, 758, "Water pumps", data.applianceLoad.pumps, 750)); y -= 34;

      commands.push(
        "0.02 0.07 0.14 rg",
        "42 " + (y + 2) + " 758 44 re f",
        "BT /F1 8 Tf 0.70 0.82 0.93 rg 54 " + (y + 29) + " Td (ESTIMATED CONNECTED LOAD) Tj ET",
        "BT /F2 13 Tf 0.98 0.98 0.98 rg 54 " + (y + 12) + " Td (~" + data.applianceLoad.kw.toFixed(2) + " kW) Tj ET",
        "BT /F1 7 Tf 0.70 0.82 0.93 rg 210 " + (y + 14) + " Td (Planning load from appliance quantities; actual energy depends on usage time.) Tj ET",
      );

      commands.push(...sectionTitleCommands(42, 132, "SITE + SIZING CONTEXT"));
      const contextLines = [
        data.roofAreaSqFt !== null ? "Roof area: ~" + Math.round(data.roofAreaSqFt) + " sq ft" : "Roof area: unavailable",
        data.roofType ? "Roof type: " + data.roofType : "",
        data.monthlyBillInr !== null ? "Monthly bill: Rs. " + Math.round(data.monthlyBillInr) : "",
        "Location: " + data.locationLabel,
        data.direction ? "Solar direction: " + data.direction + (data.slopeDeg !== null ? " | tilt ~" + data.slopeDeg.toFixed(0) + "°" : "") : "",
        data.shadingPercent !== null ? "Estimated shading: ~" + data.shadingPercent.toFixed(1) + "%" : "",
      ].filter(Boolean);

      let cy = 100;
      for (const line of contextLines) {
        commands.push("BT /F1 7.5 Tf 0.18 0.24 0.30 rg 42 " + cy + " Td (" + pdfText(line) + ") Tj ET");
        cy -= 13;
      }

      commands.push(
        "BT /F1 6.5 Tf 0.45 0.52 0.60 rg 430 92 Td (Roof maximum is a planning capacity. Final panel count, setbacks and inverter design require site verification.) Tj ET",
        "BT /F1 6.5 Tf 0.45 0.52 0.60 rg 430 79 Td (The appliance load is an instantaneous connected-load estimate, not daily energy consumption.) Tj ET",
      );
    } else {
      commands.push(...headerCommands("Solar Generation — Month & Day", "ROOFRAY | PVGIS-BACKED GENERATION PLANNING"));
      commands.push(
        "BT /F1 8 Tf 0.35 0.43 0.52 rg 42 482 Td (Bars show modeled monthly units. The label below each month shows the month-average daily units.) Tj ET",
      );
      commands.push(...generationBarChartCommands(data.monthlyGenerationKwh, 24, 96, 794, 360));
      if (data.annualGenerationKwh !== null) {
        commands.push(
          "BT /F2 9 Tf 0.02 0.07 0.14 rg 42 70 Td (Annual modeled generation: ~" + Math.round(data.annualGenerationKwh) + " kWh/year) Tj ET",
        );
      }
    }

    commands.push(...footerCommands());
    if (pageIndex === 1) {
      commands.push(
        "BT /F1 6 Tf 0.42 0.49 0.56 rg 500 48 Td (* Note: Report may contain estimation errors. Manual testing is recommended.) Tj ET",
      );
    }

    const stream = commands.join("\n");
    objects[pageObject - 1] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight +
      "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentObject + " 0 R >>";
    objects[contentObject - 1] = Buffer.from(
      "<< /Length " + Buffer.byteLength(stream, "utf8") + " >>\nstream\n" + stream + "\nendstream",
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
  const xrefParts = [
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
    const inputs = body.userInputs ?? {};
    const location = resolveReportLocation(context, planning);

    if (!location) {
      return NextResponse.json(
        {
          ok: false,
          error: "Real roof location is missing from the report data. Please run Location Analysis again before generating the PDF.",
        },
        { status: 422 },
      );
    }

    const monthlyGenerationKwh = Array.isArray(planning.monthlyGenerationKwh)
      ? planning.monthlyGenerationKwh as Array<Record<string, unknown>>
      : [];

    const data: SummaryData = {
      locationLabel: location.latitude.toFixed(5) + "°N, " + location.longitude.toFixed(5) + "°E",
      roofAreaSqFt: numberValue(planning.roofAreaSqFt) ?? numberValue(inputs.roofAreaSqFt),
      roofType: String(inputs.roofType ?? ""),
      monthlyBillInr: numberValue(inputs.monthlyBillInr),
      direction: String(planning.recommendedDirection ?? ""),
      slopeDeg: numberValue(planning.recommendedSlopeDeg),
      systemSizeKw: numberValue(planning.systemSizeKw),
      panelCount: numberValue(planning.panelCount),
      panelPowerW: numberValue(planning.panelPowerW) ?? 450,
      averageDailyGenerationKwh: numberValue(planning.averageDailyGenerationKwh),
      annualGenerationKwh: numberValue(planning.annualGenerationAfterEstimatedShadingKwh),
      shadingPercent: numberValue(planning.estimatedShadingPercent),
      monthlyGenerationKwh,
      applianceLoad: parseApplianceLoad(inputs.applianceDetails),
    };

    const pdf = buildPdf(data);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="RoofRay-Solar-Planning-Report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[RoofRay] PDF generation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to generate the PDF report." }, { status: 500 });
  }
}
