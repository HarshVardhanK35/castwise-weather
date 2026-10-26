<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { init, updateConfig, watchHostConfig, VERSION as IGNITION_VERSION } from "@castwise/ignition";
import { buildForecastUrl, mapWeatherResponse, type WeatherAppConfig, type WeatherData } from "./weatherApi";
import WeatherStateMessage from "./components/WeatherStateMessage.vue";
import WeatherBackgroundIcon from "./components/WeatherBackgroundIcon.vue";
import WeatherHeader from "./components/WeatherHeader.vue";
import WeatherMain from "./components/WeatherMain.vue";
import WeatherForecast from "./components/WeatherForecast.vue";

interface FullAppConfig extends WeatherAppConfig {
  font: string;
  refresh: "5 min" | "15 min" | "30 min" | "1 hour";
}

// Real config comes from DFM over postMessage, not a shared global — DFM
// and this app run on different ports (different origins) while both are
// in dev, and a real deployed app will be on a different origin too, so a
// plain `window.__APP_CONFIG__` global wouldn't be reachable from inside
// this iframe at all. Handshake: this app says "I'm ready" as soon as it's
// listening; DFM replies with the actual config once it sees that.
const DEFAULT_CONFIG: FullAppConfig = {
  location: { name: "New York", lat: 40.7128, lon: -74.006 },
  unit: "C",
  range: "Today",
  time: "12h",
  font: "Inter",
  refresh: "15 min",
};

// Own console prefix, distinct from Ignition's own "[IGNITION]" logs — so
// devtools makes it obvious which layer (this app vs. the engine) a given
// line came from.
const log = (...args: unknown[]) => console.log("[WEATHER]", ...args);

// Mirrors the real company's own "bootstrap:mounted" milestone log (see
// weatherappv2/src/main.js), including their "E<engine version>" tag —
// theirs reports the ENGINE's version (not the app's own), so this does
// too: IGNITION_VERSION, not this app's package.json version.
let usedHostConfig = false;

const appConfig = ref<FullAppConfig>(DEFAULT_CONFIG);

const REFRESH_MS: Record<FullAppConfig["refresh"], number> = {
  "5 min": 5 * 60_000,
  "15 min": 15 * 60_000,
  "30 min": 30 * 60_000,
  "1 hour": 60 * 60_000,
};

// "Assistant ExtraBold" is a font-weight choice, not a real font-family
// name — Google Fonts only ships one "Assistant" family, at weight 800.
// The mock applies two different weight ROLES (a "medium" weight for
// headings/labels, a "light" weight for the big temp) that both collapse
// to 800 for ExtraBold, and to normal medium/light otherwise.
const mediumWeight = computed(() => (appConfig.value.font === "Assistant ExtraBold" ? 800 : 500));
const lightWeight = computed(() => (appConfig.value.font === "Assistant ExtraBold" ? 800 : 300));

const status = ref<"loading" | "ready" | "error">("loading");
const weather = ref<WeatherData | null>(null);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let hasLoadedOnce = false;
// Guards against an OLDER request resolving after a NEWER one (e.g. the
// user flips Today -> 7-Day -> 5-Day quickly — three fetches fire, but
// network timing doesn't guarantee they resolve in the same order they
// were sent). Each call to loadWeather() claims the next number; a result
// only gets applied if its number is still the latest one issued, so a
// late-arriving stale response is silently dropped instead of overwriting
// a newer, already-applied one.
let latestRequestId = 0;

// Same config shape every time (first load, a DFM live-edit, and every
// periodic refresh) — kept in one place so those call sites can't drift.
function buildIgnitionConfig() {
  const c = appConfig.value;
  return {
    appName: "weather",
    ...c,
    api: {
      url: buildForecastUrl(c),
      cacheKey: `weather-${c.location.lat}-${c.location.lon}-${c.unit}-${c.range}`,
      maxAgeMs: REFRESH_MS[c.refresh],
      fallbackData: null,
    },
  };
}

// `data` is null whenever the fetch failed (see fallbackData above) — that
// becomes the error state, not a crash. Either way (ready or error),
// something real is now on screen instead of a blank frame.
function applyResult(data: unknown) {
  if (!data) {
    status.value = "error";
    weather.value = null;
    log("no data returned — showing error state");
    return;
  }
  weather.value = mapWeatherResponse(data, appConfig.value);
  status.value = "ready";
  log("rendered", { location: appConfig.value.location.name, unit: appConfig.value.unit });
}

function resetRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  log(`scheduling next refresh in ${appConfig.value.refresh}`);
  refreshTimer = setInterval(async () => {
    log("refresh timer fired");
    const requestId = ++latestRequestId;
    const updated = await updateConfig(buildIgnitionConfig());
    if (requestId !== latestRequestId) {
      log("refresh result superseded by a newer request — discarding");
      return;
    }
    applyResult(updated.data);
  }, REFRESH_MS[appConfig.value.refresh]);
}

// Loads (or re-loads) the weather data for whatever's currently in
// appConfig. Every call fires APP_LOAD once it settles (so DFM's preview
// spinner stops), and every RELOAD (not the first load — the preview
// frame already defaults to its spinner until the first APP_LOAD) fires
// APP_LOADING first, so changing a setting that forces a refetch shows
// that same spinner again instead of sitting on stale content meanwhile.
async function loadWeather() {
  log(hasLoadedOnce ? "config changed — reloading" : "loading for the first time");
  if (hasLoadedOnce) {
    window.parent?.postMessage({ type: "APP_LOADING" }, "*");
  }
  const requestId = ++latestRequestId;
  const payload = hasLoadedOnce
    ? await updateConfig(buildIgnitionConfig())
    : await init(buildIgnitionConfig());
  if (requestId !== latestRequestId) {
    log("load result superseded by a newer request — discarding");
    return;
  }
  applyResult(payload.data);

  const firstLoad = !hasLoadedOnce;
  hasLoadedOnce = true;
  // Tells whatever's embedding this iframe (DFM's settings-screen preview
  // today, the real player once deployed) that the app has actually
  // rendered something — success or failure both count, since either way
  // the loading spinner on the other side should stop.
  log("posting APP_LOAD to parent");
  window.parent?.postMessage({ type: "APP_LOAD" }, "*");

  if (firstLoad) {
    console.info(`[WEATHER | E${IGNITION_VERSION}] bootstrap:mounted`, {
      embedded: window.parent !== window,
      hasHostConfig: usedHostConfig,
      status: status.value,
    });
  }

  resetRefreshTimer();
}

let unwatchHostConfig: (() => void) | null = null;

onMounted(() => {
  log("mounted");

  // The actual postMessage handshake (APP_READY, then every DFM_CONFIG
  // that arrives — first load AND every later live-edit) now lives inside
  // Ignition itself (watchHostConfig) — not hand-rolled here. Never calls
  // back at all when opened directly (e.g. localhost:5174, not embedded),
  // in which case DEFAULT_CONFIG (already in appConfig) is used as-is.
  unwatchHostConfig = watchHostConfig((config) => {
    log("received config from host", config);
    usedHostConfig = true;
    appConfig.value = config as unknown as FullAppConfig;
    loadWeather();
  });

  // Opened directly (not embedded) means watchHostConfig will never call
  // back — nothing to wait for, so load the demo config right away.
  if (window.parent === window) {
    log("not embedded — using default config");
    loadWeather();
  } else {
    log("embedded — sent APP_READY, waiting for host config");
  }
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  unwatchHostConfig?.();
});
</script>

<template>
  <div class="weather-app" :style="{ fontFamily: appConfig.font }">
    <WeatherStateMessage v-if="status !== 'ready'" :status="status" />
    <div v-else-if="weather" class="weather-card">
      <WeatherBackgroundIcon :condition-code="weather.conditionCode" :is-day="weather.isDay" />
      <WeatherHeader
        :location-name="appConfig.location.name"
        :date-text="weather.localDateText"
        :time-text="weather.localTimeText"
        :font-weight="mediumWeight"
      />
      <WeatherMain :weather="weather" :medium-weight="mediumWeight" :light-weight="lightWeight" />
      <WeatherForecast v-if="weather.forecast" :forecast="weather.forecast" :medium-weight="mediumWeight" />
    </div>
  </div>
</template>

<style scoped>
/* Light-blue accent tint (the mock's own --color-accent-200/300 tokens, re-
   derived here from this app's actual background blue since it's a
   standalone app with no access to DFM's design tokens). */
.weather-app {
  --accent-200: #bcd8ff;
  --accent-300: #8fc0ff;

  width: 100%;
  height: 100%;
  /* Lets everything below use cqw units sized relative to THIS box, not
     the browser window — matches the mock's own approach exactly, and is
     what keeps proportions consistent at any iframe/preview size. */
  container-type: size;
  position: relative;
  overflow: hidden;
  background: linear-gradient(165deg, #2f81f7, #0d1f45 55%, #0d1117);
  color: #fff;
  box-sizing: border-box;
}
.weather-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 4.5cqw 5cqw 4cqw;
  box-sizing: border-box;
}
</style>
