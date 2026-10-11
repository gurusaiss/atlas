import { Component } from "react";

/**
 * Catches render-time crashes below it so a single bad component (a malformed
 * diagram, an unexpected null in an agent's JSON) degrades to a recoverable
 * panel instead of a blank page. Must be a class: React only exposes
 * componentDidCatch there.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled render error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Navigating to another route should clear a previous crash.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <p className="eyebrow mb-3 !text-crit">Unexpected error</p>
        <h1 className="display text-4xl">This page tripped over itself.</h1>
        <p className="mt-4 text-sm leading-6 text-ink-2">
          The rest of Atlas is fine. Retry this view, or head back to your projects.
        </p>
        <pre className="panel mt-6 overflow-x-auto p-3 text-xs text-ink-3">
          {this.state.error?.message || String(this.state.error)}
        </pre>
        <div className="mt-6 flex gap-3">
          <button onClick={() => this.setState({ error: null })} className="btn btn-primary">
            Retry
          </button>
          <a href="/dashboard" className="btn btn-outline">
            Back to projects
          </a>
        </div>
      </div>
    );
  }
}
