import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

/**
 * Renders the correct state for a react-query result: skeleton while loading,
 * an explicit error card (with retry) on failure, an empty-state card when the
 * request genuinely succeeded but returned nothing.
 *
 * Exists because the naive `isLoading ? ... : !data?.length ? "No items"` pattern
 * renders a *failed* request identically to an empty account -- which actively
 * misleads: during deployment we hit exactly that, where a CORS-blocked call
 * showed "No demo data seeded yet" instead of surfacing the real error.
 */
export function QueryState({ query, emptyMessage, emptyIcon: EmptyIcon = Inbox, skeletonRows = 3, children }) {
  if (query.isLoading) {
    return <SkeletonList rows={skeletonRows} />;
  }

  if (query.isError) {
    return <ErrorCard error={query.error} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  const isEmpty = Array.isArray(data) ? data.length === 0 : data == null;
  if (isEmpty) {
    return (
      <div className="atlas-card p-10 text-center text-gray-500">
        <EmptyIcon className="w-8 h-8 mx-auto mb-3 opacity-50" aria-hidden="true" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return children;
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="atlas-card p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-atlas-border rounded w-1/3" />
            <div className="h-3 bg-atlas-border/60 rounded w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="atlas-card p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-atlas-border rounded w-2/3" />
            <div className="h-3 bg-atlas-border/60 rounded w-full" />
            <div className="h-3 bg-atlas-border/60 rounded w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Turns an axios error into something a user can act on. */
export function describeError(error) {
  if (!error) return "Something went wrong.";
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (!error.response) {
    return "Could not reach the server. It may still be starting up — check your connection and try again.";
  }
  if (error.response.status === 403) return "You do not have access to this resource.";
  if (error.response.status === 404) return "Not found.";
  if (error.response.status >= 500) return "The server hit an unexpected error. Please try again.";
  return error.message || "Something went wrong.";
}

export function ErrorCard({ error, onRetry, className = "" }) {
  return (
    <div className={`atlas-card p-6 border-red-900/60 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-atlas-critical shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium text-sm mb-1">Could not load this data</p>
          <p className="text-sm text-gray-400">{describeError(error)}</p>
          {onRetry && (
            <button onClick={onRetry} className="atlas-btn-secondary text-sm py-1.5 mt-4 inline-flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
