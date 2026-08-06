"use client";

import { useEffect } from "react";

export type ColorTheme = "dark" | "light";

const STORAGE_KEY = "raronexus-theme";

export function applyColorTheme(theme: ColorTheme) {
  document.body.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
}

export function getStoredColorTheme(): ColorTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function storeColorTheme(theme: ColorTheme) {
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeBootstrap() {
  useEffect(() => {
    applyColorTheme(getStoredColorTheme());
  }, []);

  return null;
}
