import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <Compass className="w-10 h-10 mx-auto mb-4 text-atlas-accent" aria-hidden="true" />
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-gray-400 mb-8">
        That route doesn’t exist in Atlas. It may have been a stale link or a typo.
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/" className="atlas-btn-primary">
          Go home
        </Link>
        <Link to="/demo" className="atlas-btn-secondary">
          Try the demo
        </Link>
      </div>
    </div>
  );
}
