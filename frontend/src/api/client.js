import axios from "axios";
import { useAtlasStore } from "../store/atlasStore.js";
import { markReachable, markUnreachable, markWaking } from "./backendStatus.js";

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
  timeout: 70_000, // must exceed Render free-tier cold start (~50s) or we'd abort a booting backend
});

// Render's free tier spins the service down after ~15min idle; the next request
// then either hangs while the container boots or gets a 502/503/504 from Render's
// edge proxy. Both mean "the request never reached the app", so retrying is safe
// even for POSTs -- there is no risk of double-applying a mutation.
const COLD_START_STATUSES = new Set([502, 503, 504]);
const MAX_COLD_START_RETRIES = 4;
const RETRY_BACKOFF_MS = [2_000, 5_000, 10_000, 15_000];

function isColdStartFailure(error) {
  if (error.response) return COLD_START_STATUSES.has(error.response.status);
  // No response at all: network error or timeout. Ignore explicit cancellations.
  return error.code !== "ERR_CANCELED" && error.name !== "CanceledError";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

apiClient.interceptors.request.use((config) => {
  const token = useAtlasStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => {
    markReachable();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // --- Cold-start / transient-unreachable retry (runs before auth handling,
    // since a booting backend can't answer an auth refresh either) ---
    if (originalRequest && isColdStartFailure(error)) {
      originalRequest._coldStartRetries = originalRequest._coldStartRetries || 0;

      if (originalRequest._coldStartRetries < MAX_COLD_START_RETRIES) {
        const attempt = ++originalRequest._coldStartRetries;
        markWaking(attempt, MAX_COLD_START_RETRIES);
        await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 15_000);
        return apiClient(originalRequest);
      }

      markUnreachable();
      return Promise.reject(error);
    }

    // Got a real HTTP answer, so the backend is up even if this call failed.
    if (error.response) markReachable();

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
