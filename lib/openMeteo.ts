export type OpenMeteoSolarWeather = {
  provider: "Open-Meteo";
  timezone: string;
  current: {
    time: string;
    temperatureC: number | null;
    cloudCoverPercent: number | null;
    shortwaveRadiationWm2: number | null;
    directRadiationWm2: number | null;
    diffuseRadiationWm2: number | null;
    directNormalIrradianceWm2: number | null;
    windSpeedKmh: number | null;
    weatherCode: number | null;
  };
  daily: {
    sunrise: string | null;
    sunset: string | null;
    daylightDurationHours: number | null;
    sunshineDurationHours: number | null;
  };
  hourly: {
    time: string[];
    cloudCoverPercent: Array<number | null>;
    shortwaveRadiationWm2: Array<number | null>;
    directRadiationWm2: Array<number | null>;
    diffuseRadiationWm2: Array<number | null>;
    directNormalIrradianceWm2: Array<number | null>;
  };
  attribution: "Open-Meteo weather and solar radiation data";
};

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function first<T>(value: unknown): T | null {
  return Array.isArray(value) && value.length > 0 ? (value[0] as T) : null;
}

export async function getOpenMeteoSolarWeather(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoSolarWeather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "cloud_cover",
      "shortwave_radiation",
      "direct_radiation",
      "diffuse_radiation",
      "direct_normal_irradiance",
      "wind_speed_10m",
      "weather_code",
    ].join(","),
    hourly: [
      "cloud_cover",
      "shortwave_radiation",
      "direct_radiation",
      "diffuse_radiation",
      "direct_normal_irradiance",
    ].join(","),
    daily: [
      "sunrise",
      "sunset",
      "daylight_duration",
      "sunshine_duration",
    ].join(","),
    forecast_days: "7",
    timezone: "auto",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as Record<string, any>;
  const current = (data.current ?? {}) as Record<string, unknown>;
  const daily = (data.daily ?? {}) as Record<string, unknown>;
  const hourly = (data.hourly ?? {}) as Record<string, unknown>;

  return {
    provider: "Open-Meteo",
    timezone: String(data.timezone ?? "auto"),
    current: {
      time: String(current.time ?? new Date().toISOString()),
      temperatureC: finite(current.temperature_2m),
      cloudCoverPercent: finite(current.cloud_cover),
      shortwaveRadiationWm2: finite(current.shortwave_radiation),
      directRadiationWm2: finite(current.direct_radiation),
      diffuseRadiationWm2: finite(current.diffuse_radiation),
      directNormalIrradianceWm2: finite(current.direct_normal_irradiance),
      windSpeedKmh: finite(current.wind_speed_10m),
      weatherCode: finite(current.weather_code),
    },
    daily: {
      sunrise: first<string>(daily.sunrise),
      sunset: first<string>(daily.sunset),
      daylightDurationHours:
        finite(first<number>(daily.daylight_duration)) !== null
          ? Number((Number(first<number>(daily.daylight_duration)) / 3600).toFixed(2))
          : null,
      sunshineDurationHours:
        finite(first<number>(daily.sunshine_duration)) !== null
          ? Number((Number(first<number>(daily.sunshine_duration)) / 3600).toFixed(2))
          : null,
    },
    hourly: {
      time: Array.isArray(hourly.time) ? hourly.time.map(String) : [],
      cloudCoverPercent: Array.isArray(hourly.cloud_cover)
        ? hourly.cloud_cover.map(finite)
        : [],
      shortwaveRadiationWm2: Array.isArray(hourly.shortwave_radiation)
        ? hourly.shortwave_radiation.map(finite)
        : [],
      directRadiationWm2: Array.isArray(hourly.direct_radiation)
        ? hourly.direct_radiation.map(finite)
        : [],
      diffuseRadiationWm2: Array.isArray(hourly.diffuse_radiation)
        ? hourly.diffuse_radiation.map(finite)
        : [],
      directNormalIrradianceWm2: Array.isArray(hourly.direct_normal_irradiance)
        ? hourly.direct_normal_irradiance.map(finite)
        : [],
    },
    attribution: "Open-Meteo weather and solar radiation data",
  };
};
