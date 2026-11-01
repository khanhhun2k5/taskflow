"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/common/page-header";
import { ListView } from "@/components/list/list-view";
import { useRegisterShortcuts } from "@/components/shortcuts/shortcuts-provider";
import { QuickAdd } from "@/components/task/quick-add";
import { TaskDialog } from "@/components/task/task-dialog";
import { useTaskParam } from "@/components/task/use-task-param";
import { useCreateTask, useSetTaskStatus } from "@/features/tasks/hooks";

/** /inbox (US-10, US-19): top-level tasks without a project in ListView, QuickAdd, TaskDialog. */
export function InboxView() {
  const t = useTranslations();
  const { create } = useCreateTask({ kind: "inbox" });
  const setStatus = useSetTaskStatus();
  const { open } = useTaskParam();
  useRegisterShortcuts({ open, markDone: (id) => setStatus.mutate({ id, status: "DONE" }) });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("Inbox.title")} description={t("Inbox.description")} />
      <QuickAdd
        shortcutTarget
        label={t("QuickAdd.label")}
        placeholder={t("QuickAdd.placeholder")}
        onSubmit={create}
      />
      <ListView scope={{ inbox: true }} board={null} readOnly={false} onOpen={open} />
      <TaskDialog />
    </div>
  );
}
