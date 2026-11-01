"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/error-state";
import { ListRowsSkeleton } from "@/components/common/list-skeleton";
import { TaskRow } from "@/components/task/task-row";
import { useBoard } from "@/features/boards/hooks";

/**
 * Read-only columns of a project board. The real KanbanBoard with drag and drop replaces
 * this in MVP-1 c2; status changes go through TaskDialog's column select meanwhile.
 */
export function StaticBoard({
  boardId,
  onOpen,
}: {
  boardId: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("Project");
  const board = useBoard(boardId);

  if (board.isPending) return <ListRowsSkeleton rows={4} />;
  if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {board.data.columns.map((column) => {
        const headingId = `column-${column.id}`;
        return (
          <section
            key={column.id}
            aria-labelledby={headingId}
            className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3"
          >
            <h2
              id={headingId}
              className="flex items-baseline justify-between gap-2 text-sm font-medium"
            >
              <span className="break-words">{column.name}</span>
              <span className="font-normal text-muted-foreground">
                {t("columnTasks", { count: column.tasks.length })}
                {column.wipLimit !== null &&
                  ` · ${t("wip", { count: column.tasks.length, limit: column.wipLimit })}`}
              </span>
            </h2>
            {column.tasks.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t("columnEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {column.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={onOpen} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
