import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    // PWA — ilova (offline + onlaynда avtomatik yangilanish + ekranga o'rnatish).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "logo.png",
        "apple-touch-icon.png",
        "no-image-car.webp",
        "exam-no-image.svg",
      ],
      manifest: {
        name: "TayyorPrava — Avtotest",
        short_name: "TayyorPrava",
        description:
          "Haydovchilik guvohnomasi uchun avtotest — 3 tilda, real imtihon simulyatori, offline mashq.",
        lang: "uz",
        dir: "ltr",
        theme_color: "#0B1120",
        background_color: "#0B1120",
        display: "standalone",
        orientation: "portrait",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/static\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Backend API: onlaynда yangi ma'lumot, offline'da oxirgi nusxa.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pp-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Savol/belgi rasmlari — offline uchun saqlanadi.
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/static/") || url.pathname.includes("/uploads/"),
            handler: "CacheFirst",
            options: {
              cacheName: "pp-images",
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "pp-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
