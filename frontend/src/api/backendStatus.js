/**
 * Tracks whether the backend is currently unreachable / cold-starting, so the UI
 * can explain the wait instead of just spinning.
 *
 * This matters specifically because Render's free tier spins a service down after
 * ~15 minutes of inactivity, and the next request then blocks for up to ~50s while
 * the container boots. Without this, the first visit after an idle period looks
 * indistinguishable from a broken site.
 *
 * Deliberately a tiny pub/sub rather than React state: the axios interceptor that
 * detects the condition lives outside the component tree.
 */

const listeners = new Set();

let state = {
  waking: false, // a request is being retried because the backend didn't answer
  attempt: 0, // which retry we're on (1-based), for "still waking (2/4)" copy
  maxAttempts: 0,
  unreachable: false, // every retry was exhausted -- treat as genuinely down
};

function emit() {
  for (const listener of listeners) listener(state);
}

export function subscribeBackendStatus(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getBackendStatus() {
  return state;
}

export function markWaking(attempt, maxAttempts) {
  state = { waking: true, attempt, maxAttempts, unreachable: false };
  emit();
}

export function markReachable() {
  if (!state.waking && !state.unreachable) return; // avoid redundant re-renders on the happy path
  state = { waking: false, attempt: 0, maxAttempts: 0, unreachable: false };
  emit();
}

export function markUnreachable() {
  state = { waking: false, attempt: 0, maxAttempts: 0, unreachable: true };
  emit();
}
