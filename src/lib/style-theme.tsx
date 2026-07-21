import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type BrandStyle = "crimson" | "ocean" | "violet" | "emerald" | "amber" | "mono";

export const BRAND_STYLES: { id: BrandStyle; label: string; swatch: string }[] = [
  { id: "crimson", label: "Crimson", swatch: "#FF0033" },
  { id: "ocean", label: "Ocean", swatch: "#2F80ED" },
  { id: "violet", label: "Violet", swatch: "#7C3AED" },
  { id: "emerald", label: "Emerald", swatch: "#10B981" },
  { id: "amber", label: "Amber", swatch: "#F59E0B" },
  { id: "mono", label: "Mono", swatch: "#E5E7EB" },
];

type Ctx = { style: BrandStyle; setStyle: (s: BrandStyle) => void };
const StyleContext = createContext<Ctx | null>(null);
const KEY = "klaro:style";

function apply(style: BrandStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-style", style);
}

export function StyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<BrandStyle>("crimson");

  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY) as BrandStyle | null;
      const initial: BrandStyle = s && BRAND_STYLES.some((b) => b.id === s) ? s : "crimson";
      setStyleState(initial);
      apply(initial);
    } catch {
      apply("crimson");
    }
  }, []);

  const setStyle = useCallback((s: BrandStyle) => {
    setStyleState(s);
    apply(s);
    try {
      window.localStorage.setItem(KEY, s);
    } catch {
      // ignore
    }
  }, []);

  return <StyleContext.Provider value={{ style, setStyle }}>{children}</StyleContext.Provider>;
}

export function useBrandStyle() {
  const ctx = useContext(StyleContext);
  if (!ctx) throw new Error("useBrandStyle must be used within StyleProvider");
  return ctx;
}
