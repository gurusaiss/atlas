import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BackendStatusBanner from "./components/BackendStatusBanner.jsx";
import Toaster from "./components/Toaster.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProjectView from "./pages/ProjectView.jsx";
import JobMonitor from "./pages/JobMonitor.jsx";
import Results from "./pages/Results.jsx";
import Demo from "./pages/Demo.jsx";
import CallGraph from "./pages/CallGraph.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-atlas-bg flex flex-col">
      <BackendStatusBanner />
      <NavBar />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/demo" element={<Demo />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId"
              element={
                <ProtectedRoute>
                  <JobMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId/results"
              element={
                <ProtectedRoute>
                  <Results />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repositories/:repositoryId/graph"
              element={
                <ProtectedRoute>
                  <CallGraph />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  );
}
