"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectProgressDTO } from "@/features/projects/schemas";
import { useProjectProgress } from "@/features/projects/hooks";
import { DueText } from "@/components/task/due-text";
import { ProgressMeter } from "./progress-meter";

/** Project progress from GET /projects/:id/progress (docs/07). */
export function ProgressHeader({ projectId, name }: { projectId: string; name: string }) {
  const progress = useProjectProgress(projectId);
  if (progress.isPending) return <Skeleton className="h-20 w-full" aria-busy="true" />;
  if (progress.isError) {
    return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  }
  return <ProgressSummaryView progress={progress.data} name={name} />;
}

export function ProgressSummaryView({
  progress,
  name,
}: {
  progress: ProjectProgressDTO;
  name: string;
}) {
  const t = useTranslations("Progress");
  return (
    <section aria-label={t("label")} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <ProgressMeter summary={progress} name={name} />
      <p className="text-sm text-muted-foreground">
        {t("summary", { done: progress.done, total: progress.total })}
      </p>
      {progress.overdue.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{t("overdueTitle")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {progress.overdue.slice(0, 5).map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-x-2">
                <span className="min-w-0 break-words">{task.title}</span>
                <span className="text-xs">
                  <DueText task={task} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
