"use client";

import { ListTodo, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListRowsSkeleton } from "@/components/common/list-skeleton";
import { useRegisterShortcuts } from "@/components/shortcuts/shortcuts-provider";
import { Button } from "@/components/ui/button";
import type { BoardDTO } from "@/features/boards/schemas";
import { allItems } from "@/features/infinite";
import type { TaskScope } from "@/features/query-keys";
import { hasFilters } from "@/features/tasks/list-params";
import { useBulkUpdate, useTaskList } from "@/features/tasks/list-hooks";
import { BULK_MAX, type TaskDTO } from "@/features/tasks/schemas";
import { BulkBar } from "./bulk-bar";
import { ListFilters } from "./list-filters";
import { TaskTable } from "./task-table";
import { useListParams } from "./use-list-params";

type Props = {
  scope: TaskScope;
  /** The project's board (column names, bulk "move"); null in the inbox. */
  board: BoardDTO | null;
  readOnly: boolean;
  onOpen: (id: string) => void;
};

/** docs/06 section 4.5 + US-19: filters in the URL, infinite scroll, bulk edit (BR-31). */
export function ListView({ scope, board, readOnly, onOpen }: Props) {
  const t = useTranslations();
  const { params, setParams } = useListParams();
  const list = useTaskList(scope, params);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const clear = useCallback(() => setSelected(new Set()), []);
  const bulk = useBulkUpdate(clear);
  const tasks = useMemo(() => allItems(list.data), [list.data]);
  const columnNames = useMemo(
    () => new Map(board?.columns.map((c) => [c.id, c.name]) ?? []),
    [board],
  );
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const select = useCallback(
    (id: string, on: boolean) =>
      setSelected((current) => {
        if (on && current.size >= BULK_MAX) {
          toast.warning(t("Bulk.max", { max: BULK_MAX }));
          return current;
        }
        const next = new Set(current);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [t],
  );
  useRegisterShortcuts(readOnly ? {} : { toggleSelect: (id) => select(id, !selected.has(id)) });

  const statusOf = (task: TaskDTO) =>
    (task.columnId && columnNames.get(task.columnId)) || t(`Status.${task.statusCategory}`);

  let content;
  if (list.isPending) content = <ListRowsSkeleton />;
  else if (list.isError)
    content = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  else if (tasks.length === 0) {
    content = hasFilters(params) ? (
      <EmptyState
        icon={SearchX}
        title={t("List.emptyFiltered")}
        description={t("List.emptyFilteredHint")}
        action={
          <Button variant="outline" className="h-11" onClick={() => setParams({})}>
            {t("Filters.clear")}
          </Button>
        }
      />
    ) : (
      <EmptyState icon={ListTodo} title={t("List.empty")} description={t("List.emptyHint")} />
    );
  } else {
    content = (
      <>
        <TaskTable
          tasks={tasks}
          statusOf={statusOf}
          selected={selected}
          selectable={!readOnly}
          sort={params.sort}
          hasMore={hasNextPage}
          loadMore={loadMore}
          onSort={(sort) => setParams({ ...params, sort })}
          onSelect={select}
          onSelectAll={(on) =>
            setSelected(on ? new Set(tasks.slice(0, BULK_MAX).map((task) => task.id)) : new Set())
          }
          onOpen={onOpen}
        />
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t("List.loaded", { count: tasks.length })}</span>
          {hasNextPage && (
            <Button
              variant="outline"
              className="h-11"
              disabled={isFetchingNextPage}
              onClick={loadMore}
            >
              {isFetchingNextPage ? t("List.loadingMore") : t("List.loadMore")}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListFilters
        params={params}
        onChange={(next) => {
          clear();
          setParams(next);
        }}
      />
      {content}
      {selected.size > 0 && !readOnly && (
        <BulkBar
          ids={[...selected]}
          columns={board?.columns ?? null}
          onClear={clear}
          onAction={(vars) => bulk.mutate({ ...vars, ids: [...selected] })}
        />
      )}
    </div>
  );
}
