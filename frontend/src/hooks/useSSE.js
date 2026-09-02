import { useEffect, useRef, useState } from "react";
import { useAtlasStore } from "../store/atlasStore.js";
import { API_BASE_PATH } from "../api/client.js";

const MAX_RECONNECT_ATTEMPTS = 6;
const RECONNECT_BACKOFF_MS = [2_000, 5_000, 10_000, 15_000, 20_000, 30_000];

/**
 * Connects to the job SSE stream via fetch + ReadableStream (not EventSource,
 * since EventSource can't send an Authorization header). Dispatches parsed
 * events to the caller via onEvent.
 *
 * Reconnects with backoff on a dropped connection -- Render's free tier can
 * both cold-start (the fetch just never resolves for up to ~50s) and restart
 * mid-request during a redeploy, either of which would otherwise strand a
 * running job's UI silently with no further updates and no indication anything
 * is wrong.
 */
export function useSSE(jobId, onEvent) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!jobId) return undefined;

    const controller = new AbortController();
    const token = useAtlasStore.getState().accessToken;
    let attempt = 0;
    let stopped = false;
    let sawTerminalEvent = false;

    async function connectOnce() {
      const response = await fetch(`${API_BASE_PATH}/jobs/${jobId}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed (${response.status})`);
      }

      setConnected(true);
      setReconnecting(false);
      attempt = 0; // a successful connection resets the backoff

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.type === "complete" || payload.type === "error") {
              sawTerminalEvent = true;
            }
            onEventRef.current?.(payload);
          } catch {
            // ignore malformed frame
          }
        }
      }
    }

    async function connectWithRetry() {
      while (!stopped && !sawTerminalEvent) {
        try {
          await connectOnce();
          // The stream ended (server closed it). If that was a clean finish
          // (complete/error already dispatched), stop; otherwise treat it like
          // a drop and reconnect.
          if (sawTerminalEvent || stopped) return;
        } catch (err) {
          if (err.name === "AbortError") return;
          console.error("SSE stream error", err);
        }

        setConnected(false);
        if (stopped || sawTerminalEvent) return;

        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          setGaveUp(true);
          return;
        }
        setReconnecting(true);
        const delay = RECONNECT_BACKOFF_MS[attempt] ?? 30_000;
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    connectWithRetry();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [jobId]);

  return { connected, reconnecting, gaveUp };
}
