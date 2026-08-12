import { fileURLToPath, URL } from "node:url";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import manifest from "./public/manifest.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    wasm(),
    vue(),
    // The devtools overlay paints a floating button at the bottom centre
    // of the viewport, which lands on top of the popup in every captured
    // store screenshot (it was covering the "Continue" CTA). Snapshot and
    // store runs set VITE_UI_SNAPSHOT, so drop the plugin for those.
    ...(process.env.VITE_UI_SNAPSHOT ? [] : [vueDevTools()]),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
  define: {
    __DEV__: JSON.stringify(mode === "development"),
    // Sourced from the manifest, which is what the Chrome Web Store and
    // the browser report. The settings footer used to carry a hardcoded
    // string and had drifted three versions behind.
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
}));
