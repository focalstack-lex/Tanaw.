import { create } from "zustand";

// Whether the side panel is shown is session state; its width and active tab
// persist through settings.
interface PanelState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const usePanel = create<PanelState>((set) => ({
  open: true,
  toggle: () => set((state) => ({ open: !state.open })),
  setOpen: (open) => set({ open }),
}));
