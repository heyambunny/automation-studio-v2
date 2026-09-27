"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({
  dark: false,
  toggle: () => {},
});

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init from the DOM, not a hardcoded default: the inline script in
  // layout.tsx already applied the correct "dark" class to <html> before
  // this component ever mounts (to avoid a flash of the wrong theme on
  // first paint). Starting this state at `false` and correcting it in an
  // effect meant this provider would briefly re-remove that class on every
  // load before flipping it back, causing a real flash.
  const [dark, setDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("dark_mode", String(dark));
  }, [dark]);

  const toggle = () => setDark(!dark);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useDarkMode() {
  return useContext(ThemeContext);
}
