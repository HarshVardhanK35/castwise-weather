import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import legacyCss from './postcss-legacy-css.mjs'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), viteSingleFile()],

  // Older TV browsers (a 2022 Samsung runs Chromium 85, older ones Chromium 79): plain
  // ES2019 output (no ?. or ??) and CSS fallbacks for container units and container
  // queries; src/legacyShims.ts finishes the job at run time.
  build: { target: 'es2019' },
  css: { postcss: { plugins: [legacyCss()] } },

  server: {
    // host:true,
    port: 5174,
    strictPort: true,
  },
})
