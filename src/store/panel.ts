import { create } from "zustand";

/** Below this window width the panel overlays the content (styles.css, max-width 1099px). */
export const OVERLAY_BREAKPOINT = 1100;
export const OVERLAY_QUERY = `(max-width: ${OVERLAY_BREAKPOINT - 1}px)`;

/** Docked open where it fits beside the content; closed where it would cover it. */
export function initialPanelOpen(windowWidth: number): boolean {
  return windowWidth >= OVERLAY_BREAKPOINT;
}

// Whether the side panel is shown is session state; its width and active tab
// persist through settings.
interface PanelState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const usePanel = create<PanelState>((set) => ({
  open: initialPanelOpen(typeof window === "undefined" ? OVERLAY_BREAKPOINT : window.innerWidth),
  toggle: () => set((state) => ({ open: !state.open })),
  setOpen: (open) => set({ open }),
}));
