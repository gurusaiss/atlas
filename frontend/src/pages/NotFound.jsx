import { Link } from "react-router-dom";
import Contour from "../components/Contour.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function NotFound() {
  usePageTitle("Off the map");
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      <Contour seed="404" cols={70} rows={40} levels={14} className="absolute inset-0 h-full w-full text-ink/[0.08]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <p className="eyebrow rise mb-4">Error 404</p>
        <h1 className="display rise text-6xl sm:text-8xl" style={{ "--i": 1 }}>
          Off the <span className="italic text-accent-ink">map.</span>
        </h1>
        <p className="rise mt-6 max-w-md text-lg leading-8 text-ink-2" style={{ "--i": 2 }}>
          There's nothing at this address. The link may be stale, or the page may have moved.
        </p>
        <div className="rise mt-9 flex gap-3" style={{ "--i": 3 }}>
          <Link to="/" className="btn btn-primary">
            Back to the start
          </Link>
          <Link to="/demo" className="btn btn-outline">
            Try the demo
          </Link>
        </div>
      </div>
    </section>
  );
}
