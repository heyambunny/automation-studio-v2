"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Theme, getCurrentTheme, defaultTheme } from "@/lib/themes";

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    setTheme(getCurrentTheme());
    // Check every hour
    const interval = setInterval(() => {
      setTheme(getCurrentTheme());
    }, 3600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
