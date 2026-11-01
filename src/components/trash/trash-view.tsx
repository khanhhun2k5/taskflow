"use client";

import { FileText, FolderKanban, RotateCcw, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListRowsSkeleton } from "@/components/common/list-skeleton";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { LIST_LIMIT } from "@/features/query-keys";
import { useRestore, useTrash } from "@/features/tasks/hooks";
import type { TrashItemDTO } from "@/features/tasks/schemas";

/**
 * /trash (US-13): deleted projects and tasks, newest first, with "Restore". PARENT_DELETED
 * is explained by its message in messages/*.json (Errors.PARENT_DELETED), with no Retry.
 */
export function TrashView() {
  const t = useTranslations("Trash");
  const tc = useTranslations("Common");
  const trash = useTrash();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("title")} description={t("description")} />
      {trash.isPending ? (
        <ListRowsSkeleton />
      ) : trash.isError ? (
        <ErrorState error={trash.error} onRetry={() => void trash.refetch()} />
      ) : trash.data.items.length === 0 ? (
        <EmptyState icon={Trash2} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label={t("title")}>
            {trash.data.items.map((item) => (
              <TrashRow key={`${item.type}-${item.id}`} item={item} />
            ))}
          </ul>
          {trash.data.nextCursor && (
            <p className="text-sm text-muted-foreground">
              {tc("truncated", { count: LIST_LIMIT })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TrashRow({ item }: { item: TrashItemDTO }) {
  const t = useTranslations("Trash");
  const format = useFormatter();
  const restore = useRestore();
  const Icon = item.type === "project" ? FolderKanban : FileText;
  const deletedAt = format.dateTime(new Date(item.deletedAt), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="break-words">{item.title}</span>
        <span className="text-xs text-muted-foreground">
          {t(item.type)} · {t("deletedAt", { date: deletedAt })}
        </span>
      </div>
      <Button
        variant="outline"
        className="h-11 shrink-0 px-3"
        aria-label={t("restoreItem", { title: item.title })}
        onClick={() => restore.mutate(item)}
      >
        <RotateCcw aria-hidden />
        <span className="hidden sm:inline">{t("restore")}</span>
      </Button>
    </li>
  );
}
