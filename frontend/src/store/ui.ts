import { create } from "zustand";
import { setUiLanguage } from "@/lib/i18n";
import type { ContentLang, Theme, UiLang } from "@/lib/types";

const THEME_KEY = "pp_theme";
const UI_LANG_KEY = "pp_ui_lang";
const CONTENT_LANG_KEY = "pp_content_lang";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
}

interface UiState {
  theme: Theme;
  uiLang: UiLang;
  contentLang: ContentLang;
  setTheme: (t: Theme) => void;
  setUiLang: (l: UiLang) => void;
  setContentLang: (l: ContentLang) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: (localStorage.getItem(THEME_KEY) as Theme) || "dark",
  uiLang: (localStorage.getItem(UI_LANG_KEY) as UiLang) || "kr",
  contentLang: (localStorage.getItem(CONTENT_LANG_KEY) as ContentLang) || "uz",
  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    set({ theme: t });
  },
  setUiLang: (l) => {
    setUiLanguage(l);
    set({ uiLang: l });
  },
  setContentLang: (l) => {
    localStorage.setItem(CONTENT_LANG_KEY, l);
    set({ contentLang: l });
  },
}));

export function initTheme() {
  applyTheme((localStorage.getItem(THEME_KEY) as Theme) || "dark");
}
