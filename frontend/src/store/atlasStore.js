import { create } from "zustand";

export const useAtlasStore = create((set) => ({
  accessToken: null,
  user: null,
  authReady: false,

  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setAuthReady: (authReady) => set({ authReady }),

  login: (accessToken, user) => set({ accessToken, user }),
  logout: () => set({ accessToken: null, user: null }),
}));
