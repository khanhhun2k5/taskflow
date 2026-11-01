"use client";

import { FolderKanban, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateProject, useProjects, type ProjectStatus } from "@/features/projects/hooks";
import { projectStatusFromParam } from "@/features/projects/schemas";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";

const STATUSES: ProjectStatus[] = ["ACTIVE", "ARCHIVED"];

/** /projects (US-14, US-18): filter Active/Archived, cards with progress, create dialog. */
export function ProjectsView() {
  const t = useTranslations("Projects");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = projectStatusFromParam(params.get("status")); // filter lives in the URL
  const creating = params.get("new") === "1";
  const projects = useProjects(status);
  const { create } = useCreateProject((project) => router.push(`/projects/${project.id}`));

  function setParams(next: { status?: ProjectStatus; new?: boolean }) {
    const search = new URLSearchParams(params.toString());
    if (next.status) search.set("status", next.status);
    if (next.new !== undefined) {
      if (next.new) search.set("new", "1");
      else search.delete("new");
    }
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const newButton = (
    <Button className="h-11 px-4" onClick={() => setParams({ new: true })}>
      <Plus aria-hidden />
      {t("new")}
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("title")} actions={newButton} />
      <div role="group" aria-label={t("filterLabel")} className="flex gap-2">
        {STATUSES.map((value) => (
          <Button
            key={value}
            variant={value === status ? "secondary" : "ghost"}
            aria-pressed={value === status}
            className="h-11 px-4"
            onClick={() => setParams({ status: value })}
          >
            {t(value)}
          </Button>
        ))}
      </div>
      {projects.isPending ? (
        <ProjectGridSkeleton />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : projects.data.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={status === "ACTIVE" ? t("emptyActiveTitle") : t("emptyArchivedTitle")}
          description={
            status === "ACTIVE" ? t("emptyActiveDescription") : t("emptyArchivedDescription")
          }
          action={status === "ACTIVE" ? newButton : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
      <CreateProjectDialog
        open={creating}
        onOpenChange={(open) => setParams({ new: open })}
        onCreate={(body) => {
          create(body);
          setParams({ new: false, status: "ACTIVE" });
        }}
      />
    </div>
  );
}

export function ProjectGridSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <Skeleton className="h-36 rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
