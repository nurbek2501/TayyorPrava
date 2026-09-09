import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { Toaster } from "./components/ui/toast";
import "./lib/i18n";
// MUHIM: React'gacha import qilinadi — `beforeinstallprompt` sahifa yuklangan
// zahoti keladi, kechikilsa ushlanmay qoladi (o'rnatish tugmasi ishlamay qolardi).
import "./lib/pwaInstall";
import { initTheme } from "./store/ui";
import { queryClient } from "./lib/queryClient";
import "./index.css";

initTheme();

// PWA: offline ishlash + internetga ulangach avtomatik yangilanish.
registerSW({ immediate: true });

// Bir martalik tozalash: eski "pp-images" keshida savol rasmlarining MUVAFFAQIYATSIZ
// javoblari qolib ketgan (rasmlar bir muddat 404 bo'lgan, CacheFirst esa ularni
// keshlagan). Endi rasmlar "pp-images-v2" da saqlanadi — eskisi keraksiz.
if (typeof caches !== "undefined") {
  caches.delete("pp-images").catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
