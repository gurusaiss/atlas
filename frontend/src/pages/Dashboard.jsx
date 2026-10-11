import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FolderGit2, ListTodo, Plus, Trash2 } from "lucide-react";
import { useCreateProject, useDeleteProject, useJobs, useProjects } from "../hooks/useAtlas.js";
import { useAuth } from "../hooks/useAuth.js";
import { QueryState, describeError } from "../components/QueryState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import Contour from "../components/Contour.jsx";
import { toast } from "../store/toastStore.js";
import { confirm } from "../store/confirmStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { firstName, formatDate, greeting, humanize, timeAgo } from "../utils/format.js";

const ACTIVE = new Set(["queued", "parsing", "running"]);

function Stat({ label, value }) {
  return (
    <div className="flex-1 px-5 py-4 first:pl-0">
      <p className="display text-4xl tabular-nums">{value}</p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

function ProjectCard({ project, index, onDelete }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="panel panel-hover group rise relative block overflow-hidden"
      style={{ "--i": index }}
    >
      <div className="relative h-28 overflow-hidden border-b border-rule bg-sunk">
        <Contour
          seed={project.id}
          cols={40}
          rows={14}
          levels={10}
          className="h-full w-full scale-105 text-ink/30 transition-transform duration-700 ease-out group-hover:scale-125"
        />
        {project.is_demo && <span className="chip absolute left-3 top-3 bg-card">Demo</span>}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl leading-snug text-ink">{project.name}</h3>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink-3 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-ink" />
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-ink-2">
          {project.description || "No description yet."}
        </p>
        {project.created_at && <p className="num mt-4 text-xs text-ink-3">Opened {formatDate(project.created_at)}</p>}
      </div>
      {!project.is_demo && (
        <button
          onClick={(e) => onDelete(project, e)}
          aria-label={`Delete ${project.name}`}
          className="icon-btn absolute right-2.5 top-2.5 bg-card/90 opacity-0 backdrop-blur transition-opacity hover:!text-crit focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </Link>
  );
}

export default function Dashboard() {
  usePageTitle("Projects");
  const { user } = useAuth();
  const projectsQuery = useProjects();
  const jobsQuery = useJobs();
  const projects = projectsQuery.data;
  const jobs = jobsQuery.data;
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const projectNames = new Map((projects || []).map((p) => [p.id, p.name]));
  const activeJobs = jobs?.filter((j) => ACTIVE.has(j.status)).length ?? 0;
  const name1 = firstName(user);

  async function handleCreate(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createProject.mutateAsync({ name: trimmed, description });
      toast.success(`Created “${trimmed}”.`);
      setName("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDeleteProject(project, event) {
    event.preventDefault();
    event.stopPropagation();
    const ok = await confirm({
      title: `Delete “${project.name}”?`,
      message: "Its repositories, analysis jobs and findings will be removed permanently.",
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteProject.mutateAsync(project.id);
      toast.success(`Deleted “${project.name}”.`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="rise flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="display text-4xl sm:text-5xl">
            {greeting()}
            {name1 ? <>, <span className="italic text-accent-ink">{name1}</span></> : null}.
          </h1>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary" aria-expanded={showForm}>
          <Plus className={`h-4 w-4 transition-transform duration-200 ${showForm ? "rotate-45" : ""}`} />
          New project
        </button>
      </header>

      <div className="rise mt-10 flex divide-x divide-rule border-y border-rule" style={{ "--i": 1 }}>
        <Stat label="Projects" value={projects?.length ?? "–"} />
        <Stat label="Analyses" value={jobs?.length ?? "–"} />
        <Stat label="Running now" value={jobsQuery.isSuccess ? activeJobs : "–"} />
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel mt-8 animate-pop p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Project name</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} />
            </label>
            <label className="block">
              <span className="field-label">What is it? (optional)</span>
              <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </label>
          </div>
          <div className="mt-7 flex gap-2">
            <button type="submit" disabled={createProject.isPending || !name.trim()} className="btn btn-primary">
              {createProject.isPending ? "Creating…" : "Create project"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-quiet">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="mt-14">
        <h2 className="eyebrow mb-4">Projects</h2>
        <QueryState
          query={projectsQuery}
          emptyIcon={FolderGit2}
          emptyTitle="A blank map."
          emptyMessage="Create a project, then add a repository to see its architecture, tests and security findings."
          emptyAction={
            <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" />
              New project
            </button>
          }
          skeletonRows={3}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onDelete={handleDeleteProject} />
            ))}
          </div>
        </QueryState>
      </section>

      <section className="mt-16">
        <h2 className="eyebrow mb-4">Recent analyses</h2>
        <QueryState
          query={jobsQuery}
          emptyIcon={ListTodo}
          emptyTitle="Nothing analysed yet."
          emptyMessage="Once you run an analysis it will show up here with live progress."
          skeletonRows={2}
        >
          <ul className="panel divide-y divide-rule">
            {jobs?.slice(0, 10).map((job) => (
              <li key={job.id}>
                <Link
                  to={ACTIVE.has(job.status) ? `/jobs/${job.id}` : job.status === "completed" ? `/jobs/${job.id}/results` : `/jobs/${job.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-sunk/60 sm:grid-cols-[1fr_9rem_8rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink transition-transform duration-200 group-hover:translate-x-0.5">
                      {projectNames.get(job.project_id) || "Untitled project"}
                    </p>
                    <p className="num mt-0.5 text-xs text-ink-3">
                      {humanize(job.job_type)} · {timeAgo(job.created_at)}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex" aria-label={`${job.progress ?? 0} percent`}>
                    <span className="h-[3px] flex-1 overflow-hidden bg-rule">
                      <span className="block h-full bg-accent transition-[width] duration-500" style={{ width: `${job.progress ?? 0}%` }} />
                    </span>
                    <span className="num w-9 text-right text-xs text-ink-3">{job.progress ?? 0}%</span>
                  </div>
                  <div className="justify-self-end">
                    <StatusPill status={job.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </QueryState>
      </section>
    </div>
  );
}
