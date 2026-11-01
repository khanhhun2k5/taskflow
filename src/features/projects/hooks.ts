"use client";

import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { useOptimisticMutation } from "@/features/optimistic";
import { LIST_LIMIT, queryKeys, tempId } from "@/features/query-keys";
import { apiFetch, toQuery } from "@/lib/api-client";
import type { Page } from "@/lib/pagination";
import { DEFAULT_PROJECT_COLOR } from "./domain/palette";
import type {
  createProjectSchema,
  ProjectDTO,
  ProjectListItemDTO,
  ProjectProgressDTO,
  UpdateProjectInput,
} from "./schemas";

// TanStack Query hooks for projects (docs/05 sections 2.3, 2.4).

export type ProjectStatus = ProjectDTO["status"];
export type CreateProjectBody = z.input<typeof createProjectSchema>;
type ProjectPage = Page<ProjectListItemDTO>;

export function useProjects(status: ProjectStatus) {
  return useQuery({
    queryKey: queryKeys.projects.list(status),
    queryFn: ({ signal }) =>
      apiFetch<ProjectPage>(`/projects${toQuery({ status, limit: LIST_LIMIT })}`, { signal }),
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? ""),
    queryFn: ({ signal }) => apiFetch<ProjectDTO>(`/projects/${id}`, { signal }),
    enabled: id !== null,
  });
}

export function useProjectProgress(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.progress(id),
    queryFn: ({ signal }) => apiFetch<ProjectProgressDTO>(`/projects/${id}/progress`, { signal }),
  });
}

function draftProject(id: string, body: CreateProjectBody, nowIso: string): ProjectListItemDTO {
  return {
    id,
    name: body.name,
    description: body.description ?? null,
    color: body.color ?? DEFAULT_PROJECT_COLOR,
    workflow: body.workflow ?? "KANBAN",
    estimateUnit: body.estimateUnit ?? "POINTS",
    status: "ACTIVE",
    startDate: null,
    endDate: null,
    boardId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    progress: 0,
    weightedReliable: false,
    overdueCount: 0,
  };
}

/** New projects show first (list is newest first, docs/05 section 2.3). */
export function useCreateProject(onCreated?: (project: ProjectDTO) => void) {
  const mutation = useOptimisticMutation({
    mutationFn: ({ body }: { id: string; body: CreateProjectBody }) =>
      apiFetch<ProjectDTO>("/projects", { method: "POST", body }),
    affects: [queryKeys.projects.all],
    apply: (qc, { id, body }) =>
      qc.setQueryData<ProjectPage>(queryKeys.projects.list("ACTIVE"), (page) =>
        page
          ? { ...page, items: [draftProject(id, body, new Date().toISOString()), ...page.items] }
          : page,
      ),
    rollback: (qc, { id }) =>
      qc.setQueryData<ProjectPage>(queryKeys.projects.list("ACTIVE"), (page) =>
        page ? { ...page, items: page.items.filter((project) => project.id !== id) } : page,
      ),
    onSuccess: (_qc, project) => onCreated?.(project),
  });
  return {
    ...mutation,
    create: (body: CreateProjectBody) => mutation.mutate({ id: tempId(), body }),
  };
}

/** Edits a project; archiving/unarchiving moves it between the two filtered lists. */
export function useUpdateProject() {
  return useOptimisticMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      apiFetch<ProjectDTO>(`/projects/${id}`, { method: "PATCH", body: input }),
    affects: [queryKeys.projects.all],
    invalidate: [queryKeys.tasks.all, queryKeys.boards.all],
    apply: (qc, { id, input }) => {
      qc.setQueriesData<ProjectPage>({ queryKey: queryKeys.projects.lists }, (page) =>
        page
          ? {
              ...page,
              items: page.items
                .map((project) => (project.id === id ? { ...project, ...input } : project))
                .filter((project) => !input.status || project.id !== id),
            }
          : page,
      );
      qc.setQueryData<ProjectDTO>(queryKeys.projects.detail(id), (project) =>
        project ? { ...project, ...input } : project,
      );
    },
  });
}
