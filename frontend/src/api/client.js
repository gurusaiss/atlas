import axios from "axios";
import { useAtlasStore } from "../store/atlasStore.js";

const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // send the httpOnly refresh_token cookie
});

apiClient.interceptors.request.use((config) => {
  const token = useAtlasStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes("/auth/")) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = apiClient.post("/auth/refresh").finally(() => {
            refreshPromise = null;
          });
        }
        const { data } = await refreshPromise;
        useAtlasStore.getState().setAccessToken(data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        useAtlasStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
