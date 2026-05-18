import { createContext, useContext, useEffect } from "react";

type ThemeProviderState = {
  theme: "dark";
};

const ThemeProviderContext = createContext<ThemeProviderState>({ theme: "dark" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <ThemeProviderContext.Provider value={{ theme: "dark" }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
