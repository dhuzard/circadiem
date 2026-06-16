import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type ThemeMode } from "../lib/constants";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (
        savedTheme === "system" ||
        savedTheme === "light" ||
        savedTheme === "dark"
      ) {
        setTheme(savedTheme);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  return { theme, setTheme };
}
