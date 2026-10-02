import { create } from "zustand";
import type { AppInfo } from "../types";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

interface UiState {
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, detail?: string) => void;
  dismiss: (id: number) => void;
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  confirm: PendingConfirm | null;
  /** Shows the confirm dialog and resolves with the user's answer. */
  ask: (request: ConfirmRequest) => Promise<boolean>;
  answer: (ok: boolean) => void;
  appInfo: AppInfo | null;
  setAppInfo: (info: AppInfo) => void;
}

const TOAST_MS: Record<ToastKind, number> = { info: 6000, success: 6000, error: 10000 };
let nextToastId = 0;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (kind, title, detail) => {
    nextToastId += 1;
    const id = nextToastId;
    set((state) => ({ toasts: [...state.toasts, { id, kind, title, detail }] }));
    setTimeout(() => get().dismiss(id), TOAST_MS[kind]);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),

  confirm: null,
  ask: (request) =>
    new Promise<boolean>((resolve) => {
      // A second question replaces the first; the first is answered "no".
      get().confirm?.resolve(false);
      set({ confirm: { ...request, resolve } });
    }),
  answer: (ok) => {
    const pending = get().confirm;
    set({ confirm: null });
    pending?.resolve(ok);
  },

  appInfo: null,
  setAppInfo: (appInfo) => set({ appInfo }),
}));
