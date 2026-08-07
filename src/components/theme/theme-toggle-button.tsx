"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  applyColorTheme,
  getStoredColorTheme,
  storeColorTheme,
} from "@/components/theme/theme-bootstrap";

const THEME_CHANGE_EVENT = "raronexus-theme-change";

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getStoredColorTheme, () => "dark");

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    storeColorTheme(nextTheme);
    applyColorTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const label = theme === "light" ? "Ativar modo escuro" : "Ativar modo claro";

  return (
    <button
      className={`btn-secondary min-h-10 px-3 ${className}`}
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
    </button>
  );
}
