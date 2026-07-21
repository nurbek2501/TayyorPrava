import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { Toaster } from "./components/ui/toast";
import "./lib/i18n";
import { initTheme } from "./store/ui";
import { queryClient } from "./lib/queryClient";
import "./index.css";

initTheme();

// PWA: offline ishlash + internetga ulangach avtomatik yangilanish.
registerSW({ immediate: true });

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
