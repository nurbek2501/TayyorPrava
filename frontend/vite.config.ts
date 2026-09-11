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
        // Eslatma: "no-image-car.webp" endi ishlatilmaydi — rasmi yo'q savollarda
        // mashina fotosi o'rniga aniq "rasm yo'q" holati ko'rsatiladi
        // (components/ui/QuestionImage.tsx). Fayl public/ da qolgan, lekin
        // oldindan keshlashning hojati yo'q.
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
            //
            // NEGA StaleWhileRevalidate (ilgari CacheFirst edi):
            // rasmlar boshqa domendan (api.tayyorprava.uz) keladi, shuning uchun
            // <img> javoblari OPAQUE va statusi 0 bo'ladi. Muvaffaqiyatsiz opaque
            // javob ham 0 — ya'ni rasm 404 bo'lgan paytda XATO keshlanib qolgan va
            // CacheFirst uni 60 kungacha qaytaraverar edi (server tuzalgandan keyin
            // ham savol rasmsiz ko'rinardi). SWR keshdan darhol beradi, lekin orqa
            // fonda yangilaydi — bunday xato o'z-o'zidan tuzaladi.
            //
            // cacheName ham yangilandi: eski "pp-images" dagi buzuq yozuvlar
            // ishlatilmaydi (eskisi main.tsx da bir marta o'chiriladi).
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/static/") || url.pathname.includes("/uploads/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pp-images-v2",
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
