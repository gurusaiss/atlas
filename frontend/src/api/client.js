import axios from "axios";
import { useAtlasStore } from "../store/atlasStore.js";

// In local dev this is unset, so requests go to the relative "/api/v1" path,
// which Vite's dev-server proxy (vite.config.js) forwards to localhost:8000.
// In production (Vercel) there is no such proxy -- VITE_API_BASE_URL must be
// set to the deployed backend's origin (e.g. https://atlas-backend.onrender.com),
// or every API call 404s against Vercel's own static-file origin.
export const API_ROOT = import.meta.env.VITE_API_BASE_URL || "";
export const API_BASE_PATH = `${API_ROOT}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_PATH,
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
