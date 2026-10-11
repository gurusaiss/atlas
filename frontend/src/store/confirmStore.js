import { create } from "zustand";

export const useConfirmStore = create((set, get) => ({
  request: null,

  ask: (options) =>
    new Promise((resolve) => {
      // A second prompt while one is open resolves the first as "cancelled".
      get().request?.resolve(false);
      set({ request: { ...options, resolve } });
    }),

  answer: (value) => {
    get().request?.resolve(value);
    set({ request: null });
  },
}));

/** Promise-based replacement for window.confirm(). */
export function confirm({ title, message, confirmLabel = "Confirm", tone = "default" }) {
  return useConfirmStore.getState().ask({ title, message, confirmLabel, tone });
}
