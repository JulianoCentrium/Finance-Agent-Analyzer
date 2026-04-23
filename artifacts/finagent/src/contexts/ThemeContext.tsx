import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "theme-dark-blue" | "theme-dark-green" | "theme-light-blue" | "theme-light-green";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("finagent_theme") as Theme) || "theme-dark-blue";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark-blue", "theme-dark-green", "theme-light-blue", "theme-light-green", "dark");
    root.classList.add(theme);
    if (theme.includes("dark")) {
      root.classList.add("dark");
    }
    localStorage.setItem("finagent_theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
