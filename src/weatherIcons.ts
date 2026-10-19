import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  type LucideIcon,
} from "@lucide/vue";

// Same WMO weather_code values CONDITION_TEXT (weatherApi.ts) already maps
// to text — this maps them to an icon component instead. Kept as its own
// lookup (not merged into CONDITION_TEXT) since text and icon are used in
// different places and don't need to change together.
//
// Only "clear-ish" codes (0/1/2) actually have a different look at night —
// a sun (or sun-behind-cloud) makes no sense after dark. Fog/rain/snow/etc.
// look the same regardless of time of day, so those codes have one icon,
// not a day/night pair.
const DAY_ICON: Record<number, LucideIcon> = {
  0: Sun,
  1: CloudSun,
  2: CloudSun,
  3: Cloud,
  45: CloudFog,
  48: CloudFog,
  51: CloudDrizzle,
  53: CloudDrizzle,
  55: CloudDrizzle,
  61: CloudRain,
  63: CloudRain,
  65: CloudRain,
  71: CloudSnow,
  73: CloudSnow,
  75: CloudSnow,
  80: CloudRain,
  81: CloudRain,
  82: CloudRain,
  95: CloudLightning,
};

const NIGHT_ICON: Record<number, LucideIcon> = {
  0: Moon,
  1: CloudMoon,
  2: CloudMoon,
};

export function iconFor(code: number, isDay: boolean): LucideIcon {
  if (!isDay && NIGHT_ICON[code]) return NIGHT_ICON[code];
  return DAY_ICON[code] ?? Cloud;
}
