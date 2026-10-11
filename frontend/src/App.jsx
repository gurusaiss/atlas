import { Suspense, lazy } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute, { PageLoader } from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BackendStatusBanner from "./components/BackendStatusBanner.jsx";
import Toaster from "./components/Toaster.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";

// Route-level code splitting: the results, graph and analytics views pull in
// Monaco, Mermaid, React Flow and d3, which the landing page never needs.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ProjectView = lazy(() => import("./pages/ProjectView.jsx"));
const JobMonitor = lazy(() => import("./pages/JobMonitor.jsx"));
const Results = lazy(() => import("./pages/Results.jsx"));
const Demo = lazy(() => import("./pages/Demo.jsx"));
const CallGraph = lazy(() => import("./pages/CallGraph.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));

const protectedRoute = (element) => <ProtectedRoute>{element}</ProtectedRoute>;
const NO_FOOTER = new Set(["/login", "/register"]);

export default function App() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-[70] bg-ink px-4 py-2 text-sm text-paper focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <BackendStatusBanner />
      <NavBar />
      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/dashboard" element={protectedRoute(<Dashboard />)} />
              <Route path="/projects/:projectId" element={protectedRoute(<ProjectView />)} />
              <Route path="/jobs/:jobId" element={protectedRoute(<JobMonitor />)} />
              <Route path="/jobs/:jobId/results" element={protectedRoute(<Results />)} />
              <Route path="/repositories/:repositoryId/graph" element={protectedRoute(<CallGraph />)} />
              <Route path="/analytics" element={protectedRoute(<Analytics />)} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!NO_FOOTER.has(pathname) && <Footer />}
      <Toaster />
      <ConfirmDialog />
    </div>
  );
}
