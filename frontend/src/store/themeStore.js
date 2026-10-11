import { create } from "zustand";

const KEY = "atlas-theme";

function readInitial() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode / storage disabled: the toggle still works for this session.
  }
}

export const useThemeStore = create((set, get) => ({
  theme: typeof document === "undefined" ? "light" : readInitial(),
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
}));
