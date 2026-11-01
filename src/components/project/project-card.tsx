"use client";

import { CircleAlert, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateProject } from "@/features/projects/hooks";
import type { ProjectListItemDTO } from "@/features/projects/schemas";
import { isTempId } from "@/features/query-keys";
import { ProgressMeter } from "./progress-meter";

/** docs/06 section 3 /projects: color, name, progress bar, overdue count, archive menu. */
export function ProjectCard({ project }: { project: ProjectListItemDTO }) {
  const t = useTranslations("Projects");
  const update = useUpdateProject();
  const saving = isTempId(project.id);
  const archived = project.status === "ARCHIVED";
  // The list sends one number: P_w when reliable, otherwise P (docs/05 section 2.3).
  const summary = {
    count: project.progress,
    weighted: project.progress,
    weightedReliable: project.weightedReliable,
  };

  return (
    <li
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      aria-busy={saving || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 font-medium">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          {saving ? (
            <span className="break-words">{project.name}</span>
          ) : (
            <Link
              href={`/projects/${project.id}`}
              className="rounded-sm break-words outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {project.name}
            </Link>
          )}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={saving}>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t("actions", { name: project.name })}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                update.mutate({
                  id: project.id,
                  input: { status: archived ? "ACTIVE" : "ARCHIVED" },
                })
              }
            >
              {archived ? t("unarchive") : t("archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs text-muted-foreground">{t(project.workflow)}</p>
      <ProgressMeter summary={summary} name={project.name} />
      {project.overdueCount > 0 && (
        <p className="inline-flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-400">
          <CircleAlert aria-hidden className="size-4" />
          {t("overdue", { count: project.overdueCount })}
        </p>
      )}
    </li>
  );
}
