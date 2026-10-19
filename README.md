# Weather

A self-contained digital signage app that shows current conditions and a
forecast for a configured location — built to run inside Castwise app, but standalone enough to open directly in a
browser for development.

## Stack

- Vue 3 (`<script setup>`) + TypeScript
- Vite, built via `vite-plugin-singlefile` — the whole app compiles down
  to one self-contained `dist/index.html` (JS/CSS inlined), so it can be
  dropped into an iframe or hosted anywhere with zero asset-path handling.
- [`@castwise/ignition`](https://www.npmjs.com/package/@castwise/ignition)
  for config resolution, cached data fetching, and the host handshake.
- [Open-Meteo](https://open-meteo.com/) for the forecast data.

## How it gets its config

This app never hardcodes a location or set of display options — those
come from DFM at runtime, over `postMessage` (the two run on different
origins, so there's no shared global to read from):

1. On mount, the app sends `{ type: "APP_READY" }` to its parent window
   (handled by Ignition's `watchHostConfig`).
2. DFM replies with `{ type: "DFM_CONFIG", config }` — once on initial
   load, and again on every later live edit (e.g. someone changing the
   unit or font in DFM's settings screen).
3. Each time a config arrives, the app rebuilds its Open-Meteo request and
   re-renders.
4. Once it's rendered something real (success or failure both count), it
   posts `{ type: "APP_LOAD" }` back — DFM uses this to know the app is
   actually ready, not just mounted.

Opened directly outside DFM (e.g. `localhost:5174` during development),
none of this handshake happens — the app just uses its own built-in demo
config (New York, Celsius, etc.).

## Project layout

```
src/
  App.vue              orchestration: config state, the handshake, data
                        loading/refresh, composes the components below
  components/
    WeatherStateMessage.vue    loading / error text
    WeatherBackgroundIcon.vue  decorative background condition icon
    WeatherHeader.vue          location + date/time
    WeatherMain.vue            current temp, condition, hi/lo
    WeatherForecast.vue        hourly/daily forecast strip
  weatherApi.ts          Open-Meteo request building + response mapping
  weatherIcons.ts         weather-code -> icon mapping
  ignition.d.ts          type declarations for @castwise/ignition
                        (which ships as plain JS, no types of its own)
```

Each component keeps its own co-located `<style scoped>` block, standard
Vue SFC convention — not pulled into a shared stylesheet.

## Scripts

```
npm run dev      # local dev server
npm run build    # vue-tsc -b && vite build -> dist/index.html
npm run preview  # preview the production build locally
```

## Deployment

Two GitHub Actions workflows handle releases — build once, promote the
same artifact, no environment ever rebuilds from source after staging has:

- **`build-and-release.yml`** — every push to `master` builds the app,
  zips `dist/`, and publishes it to a `staging` GitHub Release
  (`weather.zip`), replacing the previous staging build.
- **`promote-to-prod.yml`** — pushing a version tag (`v1.0.0`, etc.)
  downloads that exact already-tested staging zip and republishes it to a
  `prod` GitHub Release — no rebuild, so what staging tested is exactly
  what goes to production.

The resulting URLs (`.../releases/download/staging/weather.zip` and
`.../releases/download/prod/weather.zip`) are what DFM's app registry
points at for this app.
