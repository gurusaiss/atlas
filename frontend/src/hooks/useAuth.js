import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client.js";
import { useAtlasStore } from "../store/atlasStore.js";

export function useAuth() {
  const navigate = useNavigate();
  const { accessToken, user, login, logout, setUser } = useAtlasStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // On page load there's no access token in memory yet -- try a silent refresh
    // using the httpOnly cookie before deciding the user is logged out.
    async function bootstrap() {
      if (accessToken) {
        setInitializing(false);
        return;
      }
      try {
        const { data } = await apiClient.post("/auth/refresh");
        useAtlasStore.getState().setAccessToken(data.access_token);
        const me = await apiClient.get("/auth/me");
        setUser(me.data);
      } catch {
        // Not logged in -- that's fine, just proceed unauthenticated.
      } finally {
        setInitializing(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    initializing,
    login: doLogin,
    register: doRegister,
    logout: doLogout,
  };
}
