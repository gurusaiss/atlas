import { useEffect, useState } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { subscribeBackendStatus } from "../api/backendStatus.js";

/**
 * Explains the Render free-tier cold start instead of letting the UI just hang.
 * Without this, the first request after ~15min of inactivity looks like a broken
 * site for up to ~50 seconds.
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
      className={`px-6 py-2.5 text-sm flex items-center justify-center gap-2 border-b ${
        isWaking
          ? "bg-amber-950/40 border-amber-900/60 text-amber-200"
          : "bg-red-950/40 border-red-900/60 text-red-200"
      }`}
    >
      {isWaking ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            Waking up the backend — free-tier hosting sleeps when idle and can take up to a minute to start.
            {status.maxAttempts > 0 && (
              <span className="text-amber-300/70"> (attempt {status.attempt} of {status.maxAttempts})</span>
            )}
          </span>
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Can’t reach the backend right now. It may be down or still restarting — retry in a moment.</span>
        </>
      )}
    </div>
  );
}
