import { useEffect, useState } from "react";
import { subscribeBackendStatus } from "../api/backendStatus.js";

/**
 * Explains the free-tier cold start instead of letting the UI just hang. Without
 * this, the first request after ~15 minutes idle looks like a broken site for up
 * to a minute.
 */
export default function BackendStatusBanner() {
  const [status, setStatus] = useState({ waking: false, unreachable: false, attempt: 0, maxAttempts: 0 });

  useEffect(() => subscribeBackendStatus(setStatus), []);

  if (!status.waking && !status.unreachable) return null;

  const isWaking = status.waking;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-fade border-b px-4 py-2.5 text-center text-[0.8125rem] ${
        isWaking ? "border-ochre/30 bg-ochre/10 text-ink" : "border-crit/30 bg-crit/10 text-ink"
      }`}
    >
      {isWaking ? (
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-ochre" style={{ animationDelay: `${i * 180}ms` }} />
            ))}
          </span>
          <span>
            <strong className="font-semibold">Waking the server.</strong> It sleeps when idle and takes up to a minute to start.
          </span>
          {status.maxAttempts > 0 && (
            <span className="font-mono text-xs text-ink-3">
              try {status.attempt}/{status.maxAttempts}
            </span>
          )}
        </span>
      ) : (
        <span>
          <strong className="font-semibold">Can't reach the server right now.</strong> It may be restarting — try again in a moment.
        </span>
      )}
    </div>
  );
}
