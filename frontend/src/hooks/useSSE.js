import { useEffect, useRef, useState } from "react";
import { useAtlasStore } from "../store/atlasStore.js";
import { API_BASE_PATH } from "../api/client.js";

/**
 * Connects to the job SSE stream via fetch + ReadableStream (not EventSource,
 * since EventSource can't send an Authorization header). Dispatches parsed
 * events to the caller via onEvent.
 */
export function useSSE(jobId, onEvent) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!jobId) return undefined;

    const controller = new AbortController();
    const token = useAtlasStore.getState().accessToken;

    async function connect() {
      try {
        const response = await fetch(`${API_BASE_PATH}/jobs/${jobId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.body) return;

        setConnected(true);
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
              onEventRef.current?.(payload);
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("SSE stream error", err);
        }
      } finally {
        setConnected(false);
      }
    }

    connect();
    return () => controller.abort();
  }, [jobId]);

  return { connected };
}
