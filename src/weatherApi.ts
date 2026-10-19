export interface LocationConfig {
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherAppConfig {
  location: LocationConfig;
  unit: "C" | "F";
  range: "Today" | "5-Day" | "7-Day";
  time: "12h" | "24h";
}

export interface ForecastDay {
  label: string;
  hiText: string;
  loText: string;
  code: number;
  // Daily (3-Day/7-Day) entries summarize a whole day, so day/night
  // doesn't apply — always true for those. Hourly (Today) entries use the
  // API's own real is_day value for that hour.
  isDay: boolean;
}

export interface WeatherData {
  currentTempText: string;
  conditionText: string;
  conditionCode: number;
  isDay: boolean;
  localDateText: string;
  localTimeText: string;
  // Today's high/low — shown next to the current condition on the "Today"
  // range (the daily ranges already show hi/lo per forecast card instead).
  todayHiText: string | null;
  todayLoText: string | null;
  // "Today" -> next few hours (loText empty, only one temp per entry).
  // "5-Day"/"7-Day" -> daily highs/lows. null only if the API call failed.
  forecast: ForecastDay[] | null;
}

// WMO weather codes -> short text. Real icons are deferred (kept simple
// for v1, see z-files/app-future.md) — this is just enough to make the
// condition readable.
const CONDITION_TEXT: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
};

function conditionTextFor(code: number): string {
  return CONDITION_TEXT[code] ?? "Unknown";
}

// Builds the actual Open-Meteo request URL from the app's config.
// `timezone=auto` is what makes the API return times in the LOCATION's own
// local time, not whatever timezone the physical screen happens to be in —
// confirmed as the correct behavior (a screen in a different timezone from
// its configured city should still show that city's local time).
export function buildForecastUrl(config: WeatherAppConfig): string {
  const { lat, lon } = config.location;
  const unitParam = config.unit === "F" ? "fahrenheit" : "celsius";
  const days = config.range === "Today" ? 1 : config.range === "5-Day" ? 5 : 7;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    // Only actually used for the "Today" range (see mapWeatherResponse),
    // but it's cheap/harmless to always request — forecast_hours keeps the
    // response small instead of pulling a full week of hourly data.
    hourly: "temperature_2m,weather_code,is_day",
    forecast_hours: "12",
    timezone: "auto",
    temperature_unit: unitParam,
    forecast_days: String(days),
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

// `raw` is whatever Open-Meteo actually returns — typed loosely as `any`
// since only a handful of known fields are read here; not worth writing a
// full response type for an external API this app doesn't control.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapWeatherResponse(raw: any, config: WeatherAppConfig): WeatherData {
  const current = raw.current;
  // The mock never shows the unit letter (F/C) anywhere, just the degree
  // symbol — matched exactly, not a simplification.
  const unitSymbol = "°";

  const localTime = new Date(current.time);
  const localTimeText =
    config.time === "24h"
      ? localTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : localTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  const localDateText = localTime.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  let forecast: ForecastDay[] | null = null;
  if (config.range === "Today" && raw.hourly) {
    // raw.hourly.time is naive local-time strings for the configured
    // location (same as current.time) — comparing them as plain strings
    // works fine here since ISO-8601 sorts lexically in time order, no
    // need to parse into Date objects just to find "now onward".
    const hours: string[] = raw.hourly.time;
    const fromIndex = hours.findIndex((h) => h >= current.time);
    const startAt = fromIndex === -1 ? 0 : fromIndex;

    forecast = hours.slice(startAt, startAt + 6).map((iso, offset) => {
      const i = startAt + offset;
      const hourLabel =
        config.time === "24h"
          ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", hour12: false })
          : new Date(iso).toLocaleTimeString([], { hour: "numeric", hour12: true });
      return {
        label: hourLabel,
        hiText: `${Math.round(raw.hourly.temperature_2m[i])}${unitSymbol}`,
        loText: "",
        code: raw.hourly.weather_code[i],
        // Optional chaining + default-to-day: a stale cached response from
        // before is_day was added to this request would otherwise crash
        // here. Defaulting to day (not night) is the safer guess when it's
        // genuinely unknown — a sun icon at night is less jarring than a
        // moon icon at noon.
        isDay: raw.hourly.is_day?.[i] !== 0,
      };
    });
  } else if (raw.daily) {
    const days: string[] = raw.daily.time;
    forecast = days.map((iso, i) => ({
      label: i === 0 ? "Today" : new Date(iso).toLocaleDateString([], { weekday: "short" }),
      hiText: `${Math.round(raw.daily.temperature_2m_max[i])}${unitSymbol}`,
      loText: `${Math.round(raw.daily.temperature_2m_min[i])}${unitSymbol}`,
      code: raw.daily.weather_code[i],
      isDay: true,
    }));
  }

  // daily[0] is always "today", regardless of which range is selected
  // (daily is requested unconditionally) — so this is available even when
  // the forecast strip above is showing hourly data instead.
  const todayHiText = raw.daily
    ? `${Math.round(raw.daily.temperature_2m_max[0])}${unitSymbol}`
    : null;
  const todayLoText = raw.daily
    ? `${Math.round(raw.daily.temperature_2m_min[0])}${unitSymbol}`
    : null;

  return {
    currentTempText: `${Math.round(current.temperature_2m)}${unitSymbol}`,
    conditionText: conditionTextFor(current.weather_code),
    conditionCode: current.weather_code,
    isDay: current.is_day !== 0,
    localDateText,
    localTimeText,
    todayHiText,
    todayLoText,
    forecast,
  };
}
