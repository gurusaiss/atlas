import { Component } from "react";
import { AlertOctagon } from "lucide-react";

/**
 * Catches render-time crashes anywhere below it so a single bad component
 * (a malformed Mermaid diagram, an unexpected null in an agent's JSON output)
 * degrades to a recoverable panel instead of a blank white page.
 *
 * Must be a class component -- React only exposes componentDidCatch there.
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
    // Kept as console output rather than shipped to a service: there's no error
    // -tracking backend wired up, and silently swallowing it would make field
    // bugs undiagnosable.
    console.error("Unhandled render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <AlertOctagon className="w-10 h-10 mx-auto mb-4 text-atlas-critical" aria-hidden="true" />
        <h1 className="text-xl font-semibold mb-2">Something broke on this page</h1>
        <p className="text-sm text-gray-400 mb-6">
          The rest of Atlas is still fine. You can retry this view, or head back to the dashboard.
        </p>
        <pre className="atlas-card p-3 text-left text-xs text-gray-500 overflow-x-auto mb-6">
          {this.state.error?.message || String(this.state.error)}
        </pre>
        <div className="flex gap-3 justify-center">
          <button onClick={this.handleReset} className="atlas-btn-primary">
            Retry
          </button>
          <a href="/dashboard" className="atlas-btn-secondary">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }
}
