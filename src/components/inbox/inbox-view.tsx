"use client";

import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListRowsSkeleton } from "@/components/common/list-skeleton";
import { PageHeader } from "@/components/common/page-header";
import { QuickAdd } from "@/components/task/quick-add";
import { TaskDialog } from "@/components/task/task-dialog";
import { TaskRow } from "@/components/task/task-row";
import { useTaskParam } from "@/components/task/use-task-param";
import { LIST_LIMIT } from "@/features/query-keys";
import { useCreateTask, useInboxTasks, useSetTaskStatus } from "@/features/tasks/hooks";

/** /inbox (US-10): top-level tasks without a project, QuickAdd, TaskDialog. */
export function InboxView() {
  const t = useTranslations();
  const tasks = useInboxTasks();
  const { create } = useCreateTask({ kind: "inbox" });
  const setStatus = useSetTaskStatus();
  const { open } = useTaskParam();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("Inbox.title")} description={t("Inbox.description")} />
      <QuickAdd
        label={t("QuickAdd.label")}
        placeholder={t("QuickAdd.placeholder")}
        onSubmit={create}
      />
      {tasks.isPending ? (
        <ListRowsSkeleton />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("Inbox.emptyTitle")}
          description={t("Inbox.emptyDescription")}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label={t("Inbox.title")}>
            {tasks.data.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={open}
                onToggle={(id, status) => setStatus.mutate({ id, status })}
              />
            ))}
          </ul>
          {tasks.data.nextCursor && (
            <p className="text-sm text-muted-foreground">
              {t("Common.truncated", { count: LIST_LIMIT })}
            </p>
          )}
        </>
      )}
      <TaskDialog />
    </div>
  );
}
