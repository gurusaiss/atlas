import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import Contour from "./Contour.jsx";

/**
 * Renders the right state for a react-query result: skeleton while loading, an
 * explicit error (with retry) on failure, an empty state when the request
 * genuinely succeeded but returned nothing. A failed request must never look
 * like an empty account -- during deployment a CORS-blocked call once showed
 * "No demo data seeded yet" instead of the real error.
 */
export function QueryState({ query, emptyMessage, emptyTitle, emptyIcon, emptyAction, skeletonRows = 3, children }) {
  if (query.isLoading) {
    return <SkeletonList rows={skeletonRows} />;
  }

  if (query.isError) {
    return <ErrorCard error={query.error} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  const isEmpty = Array.isArray(data) ? data.length === 0 : data == null;
  if (isEmpty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return children;
}

export function EmptyState({ icon: Icon = Inbox, title, message, action, seed = "empty" }) {
  return (
    <div className="panel relative overflow-hidden px-6 py-14 text-center">
      <Contour seed={seed} cols={50} rows={24} levels={9} className="absolute inset-0 h-full w-full text-ink/[0.07]" />
      <div className="relative">
        <Icon className="mx-auto mb-4 h-6 w-6 text-ink-3" aria-hidden="true" strokeWidth={1.5} />
        {title && <h3 className="mb-1 text-xl text-ink">{title}</h3>}
        <p className="mx-auto max-w-sm text-sm leading-6 text-ink-2">{message}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="panel divide-y divide-rule" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-2/3" />
          </div>
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel overflow-hidden">
          <div className="skeleton h-24 !rounded-none" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Turns an axios error into something a person can act on. */
export function describeError(error) {
  if (!error) return "Something went wrong.";
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (!error.response) {
    return "Could not reach the server. It may still be starting up — check your connection and try again.";
  }
  if (error.response.status === 403) return "You do not have access to this resource.";
  if (error.response.status === 404) return "Not found.";
  if (error.response.status === 429) return "Too many requests. Give it a minute and try again.";
  if (error.response.status >= 500) return "The server hit an unexpected error. Please try again.";
  return error.message || "Something went wrong.";
}

export function ErrorCard({ error, onRetry, className = "" }) {
  return (
    <div className={`panel border-l-2 !border-l-crit p-6 ${className}`} role="alert">
      <div className="flex items-start gap-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-crit" aria-hidden="true" strokeWidth={1.75} />
        <div className="flex-1">
          <p className="font-display text-lg text-ink">That didn't load</p>
          <p className="mt-1 text-sm leading-6 text-ink-2">{describeError(error)}</p>
          {onRetry && (
            <button onClick={onRetry} className="btn btn-outline btn-sm mt-4">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
