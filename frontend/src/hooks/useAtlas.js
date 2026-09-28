import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client.js";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await apiClient.get("/projects")).data,
  });
}

export function useProject(projectId) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await apiClient.get(`/projects/${projectId}`)).data,
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }) => (await apiClient.post("/projects", { name, description })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRepositories(projectId) {
  return useQuery({
    queryKey: ["repositories", projectId],
    queryFn: async () => (await apiClient.get(`/projects/${projectId}/repositories`)).data,
    enabled: Boolean(projectId),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "pending") ? 3000 : false),
  });
}

export function useUploadRepository(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return (
        await apiClient.post(`/projects/${projectId}/repositories/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories", projectId] }),
  });
}

export function useAddGithubRepository(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ githubUrl, branch }) =>
      (
        await apiClient.post(`/projects/${projectId}/repositories/github`, {
          github_url: githubUrl,
          branch: branch || "main",
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories", projectId] }),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ repositoryId, jobType }) =>
      (await apiClient.post("/jobs", { repository_id: repositoryId, job_type: jobType || "full_analysis" })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useJob(jobId, options = {}) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}`)).data,
    enabled: Boolean(jobId),
    ...options,
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => (await apiClient.get("/jobs")).data,
  });
}

export function useJobResults(jobId) {
  return useQuery({
    queryKey: ["job-results", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/results`)).data,
    enabled: Boolean(jobId),
  });
}

export function useDocumentation(jobId) {
  return useQuery({
    queryKey: ["job-docs", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/documentation`)).data,
    enabled: Boolean(jobId),
    retry: false,
  });
}

export function useDecomposition(jobId) {
  return useQuery({
    queryKey: ["job-decomposition", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/decomposition`)).data,
    enabled: Boolean(jobId),
    retry: false,
  });
}

export function useSecurityFindings(jobId) {
  // Uses the Findings API (real DB rows with real IDs) rather than
  // /jobs/{id}/security (a raw AgentResult JSON dump with no `id` field) --
  // false-positive marking needs a real Finding.id to PATCH against.
  return useQuery({
    queryKey: ["job-security", jobId],
    queryFn: async () => (await apiClient.get("/findings", { params: { job_id: jobId, finding_type: "security" } })).data,
    enabled: Boolean(jobId),
    retry: false,
  });
}

export function useTests(jobId) {
  return useQuery({
    queryKey: ["job-tests", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/tests`)).data,
    enabled: Boolean(jobId),
    retry: false,
  });
}

export function useTestFile(jobId, testFile) {
  return useQuery({
    queryKey: ["job-test-file", jobId, testFile],
    // The backend route uses a `:path` converter, so slashes in testFile must stay
    // literal (not percent-encoded) for FastAPI's path matching to work.
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/tests/${testFile}`)).data,
    enabled: Boolean(jobId && testFile),
  });
}

export function useQuality(jobId) {
  return useQuery({
    queryKey: ["job-quality", jobId],
    queryFn: async () => (await apiClient.get(`/jobs/${jobId}/quality`)).data,
    enabled: Boolean(jobId),
    retry: false,
  });
}

export function useRepository(repositoryId) {
  return useQuery({
    queryKey: ["repository", repositoryId],
    queryFn: async () => (await apiClient.get(`/repositories/${repositoryId}`)).data,
    enabled: Boolean(repositoryId),
  });
}

export function useCallGraph(repositoryId) {
  return useQuery({
    queryKey: ["call-graph", repositoryId],
    queryFn: async () => (await apiClient.get(`/repositories/${repositoryId}/call-graph`)).data,
    enabled: Boolean(repositoryId),
  });
}

export function useMarkFalsePositive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ findingId, reason }) =>
      (await apiClient.patch(`/findings/${findingId}`, { is_false_positive: true, false_positive_reason: reason })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-security"] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId) => (await apiClient.delete(`/projects/${projectId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteRepository(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repositoryId) => (await apiClient.delete(`/repositories/${repositoryId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories", projectId] }),
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId) => (await apiClient.delete(`/jobs/${jobId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useAnalyticsDashboard() {
  return useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => (await apiClient.get("/analytics/dashboard")).data,
    staleTime: 60_000,
  });
}

export function useAnalyticsGuardrails() {
  return useQuery({
    queryKey: ["analytics-guardrails"],
    queryFn: async () => (await apiClient.get("/analytics/guardrails")).data,
    staleTime: 60_000,
  });
}

export function useAnalyticsTokens() {
  return useQuery({
    queryKey: ["analytics-tokens"],
    queryFn: async () => (await apiClient.get("/analytics/tokens")).data,
    staleTime: 60_000,
  });
}

export function useDemoRepositories() {
  return useQuery({
    queryKey: ["demo-repositories"],
    queryFn: async () => (await apiClient.get("/demo/repositories")).data,
  });
}

export function useLoadDemo() {
  return useMutation({
    mutationFn: async (repoName) => (await apiClient.post(`/demo/load/${repoName}`)).data,
  });
}
