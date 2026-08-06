"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyColorTheme,
  getStoredColorTheme,
  storeColorTheme,
  type ColorTheme,
} from "@/components/theme/theme-bootstrap";

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ColorTheme>(() => getStoredColorTheme());

  useEffect(() => {
    applyColorTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      storeColorTheme(nextTheme);
      return nextTheme;
    });
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
