import { create } from "zustand";

export const useAtlasStore = create((set) => ({
  accessToken: null,
  user: null,

  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),

  login: (accessToken, user) => set({ accessToken, user }),
  logout: () => set({ accessToken: null, user: null }),
}));
