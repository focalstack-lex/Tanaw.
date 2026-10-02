import type { Theme } from "../types";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

const QUERY = "(prefers-color-scheme: dark)";
let stopFollowing: (() => void) | null = null;

/** Sets `data-theme` on the html element and keeps following the system when asked. */
export function applyTheme(theme: Theme): void {
  stopFollowing?.();
  stopFollowing = null;
  const media = window.matchMedia(QUERY);
  const paint = () => {
    document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
  };
  paint();
  if (theme === "system") {
    media.addEventListener("change", paint);
    stopFollowing = () => media.removeEventListener("change", paint);
  }
}
