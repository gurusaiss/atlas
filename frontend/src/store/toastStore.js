import { create } from "zustand";

const DEFAULT_DURATION_MS = 5_000;

let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = nextId++;
    const duration = toast.duration ?? DEFAULT_DURATION_MS;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, ...toast, duration }] }));
    if (duration !== 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message) => useToastStore.getState().push({ type: "success", message }),
  error: (message) => useToastStore.getState().push({ type: "error", message, duration: 8_000 }),
  info: (message) => useToastStore.getState().push({ type: "info", message }),
};
