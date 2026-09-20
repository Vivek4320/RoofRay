const PVGIS_BASE_URL = "https://re.jrc.ec.europa.eu/api/v5_3";

export type PVGISMonthlyResult = {
  month: number;
  energyKwh: number;
  irradiationKwhM2: number;
  averageDailyEnergyKwh: number;
  averageDailyIrradiationKwhM2: number;
};

export type PVGISAnalysis = {
  provider: "PVGIS";
  apiVersion: "5.3";
  location: {
    latitude: number;
    longitude: number;
    elevationMeters: number | null;
    radiationDatabase: string | null;
    yearMin: number | null;
    yearMax: number | null;
  };
  system: {
    peakPowerKw: number;
    lossesPercent: number;
    technology: string;
    mounting: string;
  };
  optimalOrientation: {
    slopeDeg: number | null;
    azimuthDeg: number | null;
    direction: string | null;
  };
  annual: {
    energyKwh: number | null;
    specificYieldKwhPerKwp: number | null;
    irradiationKwhM2: number | null;
    averageDailyEnergyKwh: number | null;
  };
  monthly: PVGISMonthlyResult[];
  notes: string[];
};

type PVGISResponse = {
  inputs?: {
    location?: {
      latitude?: number;
      longitude?: number;
      elevation?: number;
    };
    meteo_data?: {
      radiation_db?: string;
      year_min?: number;
      year_max?: number;
    };
    mounting_system?: {
      fixed?: {
        slope?: { value?: number | string };
        azimuth?: { value?: number | string };
        type?: string;
      };
    };
    pv_module?: {
      technology?: string;
      peak_power?: number;
      system_loss?: number;
    };
  };
  outputs?: {
    monthly?: {
      fixed?: Array<{
        month?: number;
        E_d?: number;
        E_m?: number;
        "H(i)_d"?: number;
        "H(i)_m"?: number;
      }>;
    };
    totals?: {
      fixed?: {
        E_d?: number;
        E_m?: number;
        E_y?: number;
        "H(i)_d"?: number;
        "H(i)_m"?: number;
        "H(i)_y"?: number;
      };
    };
  };
  error?: string;
  message?: string;
};

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function directionFromPVGISAzimuth(azimuth: number | null): string | null {
  if (azimuth === null) return null;

  // PVGIS azimuth is relative to South:
  // -90° = East, 0° = South, +90° = West, ±180° = North.
  const normalized = ((azimuth + 180) % 360 + 360) % 360 - 180;

  if (normalized >= -22.5 && normalized < 22.5) return "South";
  if (normalized >= 22.5 && normalized < 67.5) return "South-West";
  if (normalized >= 67.5 && normalized < 112.5) return "West";
  if (normalized >= 112.5 && normalized < 157.5) return "North-West";
  if (normalized >= 157.5 || normalized < -157.5) return "North";
  if (normalized >= -157.5 && normalized < -112.5) return "North-East";
  if (normalized >= -112.5 && normalized < -67.5) return "East";
  return "South-East";
}

export async function getPVGISAnalysis({
  latitude,
  longitude,
  peakPowerKw = 1,
  lossPercent = 14,
}: {
  latitude: number;
  longitude: number;
  peakPowerKw?: number;
  lossPercent?: number;
}): Promise<PVGISAnalysis> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    peakpower: String(peakPowerKw),
    loss: String(lossPercent),
    pvtechchoice: "crystSi",
    mountingplace: "building",
    optimalangles: "1",
    usehorizon: "1",
    raddatabase: "PVGIS-SARAH3",
    outputformat: "json",
  });

  const response = await fetch(`${PVGIS_BASE_URL}/PVcalc?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();

  let data: PVGISResponse;
  try {
    data = JSON.parse(text) as PVGISResponse;
  } catch {
    throw new Error(`PVGIS returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok || data.error || data.message) {
    throw new Error(data.error || data.message || `PVGIS request failed (HTTP ${response.status}).`);
  }

  const fixed = data.outputs?.totals?.fixed;
  const monthly = data.outputs?.monthly?.fixed ?? [];

  const slope = asNumber(data.inputs?.mounting_system?.fixed?.slope?.value);
  const azimuth = asNumber(data.inputs?.mounting_system?.fixed?.azimuth?.value);

  const annualEnergy = asNumber(fixed?.E_y);
  const annualIrradiation = asNumber(fixed?.["H(i)_y"]);

  return {
    provider: "PVGIS",
    apiVersion: "5.3",
    location: {
      latitude: data.inputs?.location?.latitude ?? latitude,
      longitude: data.inputs?.location?.longitude ?? longitude,
      elevationMeters: asNumber(data.inputs?.location?.elevation),
      radiationDatabase: data.inputs?.meteo_data?.radiation_db ?? null,
      yearMin: asNumber(data.inputs?.meteo_data?.year_min),
      yearMax: asNumber(data.inputs?.meteo_data?.year_max),
    },
    system: {
      peakPowerKw,
      lossesPercent: lossPercent,
      technology: data.inputs?.pv_module?.technology ?? "c-Si",
      mounting: data.inputs?.mounting_system?.fixed?.type ?? "building",
    },
    optimalOrientation: {
      slopeDeg: slope,
      azimuthDeg: azimuth,
      direction: directionFromPVGISAzimuth(azimuth),
    },
    annual: {
      energyKwh: annualEnergy,
      specificYieldKwhPerKwp:
        annualEnergy === null || peakPowerKw <= 0
          ? null
          : Number((annualEnergy / peakPowerKw).toFixed(2)),
      irradiationKwhM2: annualIrradiation,
      averageDailyEnergyKwh: asNumber(fixed?.E_d),
    },
    monthly: monthly.map((item) => ({
      month: item.month ?? 0,
      energyKwh: item.E_m ?? 0,
      irradiationKwhM2: item["H(i)_m"] ?? 0,
      averageDailyEnergyKwh: item.E_d ?? 0,
      averageDailyIrradiationKwhM2: item["H(i)_d"] ?? 0,
    })),
    notes: [
      "PVGIS estimates solar-resource and PV-system performance from long-term radiation and meteorological data.",
      "The optimal direction is the solar-resource optimum for a fixed system; it is not a building-specific roof-face recommendation.",
      "Nearby buildings, trees, roof geometry, and temporary shadows require a separate roof/obstacle analysis layer.",
    ],
  };
}
