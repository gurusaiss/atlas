import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client.js";
import { useAtlasStore } from "../store/atlasStore.js";

// Many components call useAuth(); the silent session restore must run exactly
// once per page load, otherwise each mount races its own /auth/refresh and the
// rotating refresh cookie gets consumed by whichever request lands first.
let bootstrapPromise = null;

function bootstrapSession() {
  if (!bootstrapPromise) {
    const { accessToken, setAccessToken, setUser, setAuthReady } = useAtlasStore.getState();
    bootstrapPromise = (async () => {
      if (accessToken) return;
      try {
        const { data } = await apiClient.post("/auth/refresh");
        setAccessToken(data.access_token);
        const me = await apiClient.get("/auth/me");
        setUser(me.data);
      } catch {
        // No valid refresh cookie -- the visitor is simply signed out.
      }
    })().finally(() => setAuthReady(true));
  }
  return bootstrapPromise;
}

export function useAuth() {
  const navigate = useNavigate();
  const { accessToken, user, authReady, login, logout, setUser } = useAtlasStore();

  useEffect(() => {
    bootstrapSession();
  }, []);

  const doLogin = useCallback(
    async (email, password) => {
      const { data } = await apiClient.post("/auth/login", { email, password });
      login(data.access_token, null);
      const me = await apiClient.get("/auth/me");
      setUser(me.data);
      return me.data;
    },
    [login, setUser]
  );

  const doRegister = useCallback(async (email, password, fullName) => {
    await apiClient.post("/auth/register", { email, password, full_name: fullName });
  }, []);

  const doLogout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      logout();
      navigate("/login");
    }
  }, [logout, navigate]);

  return {
    accessToken,
    user,
    isAuthenticated: Boolean(accessToken),
    initializing: !authReady,
    login: doLogin,
    register: doRegister,
    logout: doLogout,
  };
}
