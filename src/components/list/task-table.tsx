"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskListParams } from "@/features/query-keys";
import type { TaskDTO } from "@/features/tasks/schemas";
import { TaskTableRow } from "./task-table-row";

export const VIRTUAL_FROM = 100; // docs/06 section 4.5
const ROW_HEIGHT = 52;

type Sort = TaskListParams["sort"];

type Props = {
  tasks: TaskDTO[];
  statusOf: (task: TaskDTO) => string;
  selected: ReadonlySet<string>;
  selectable: boolean;
  sort: Sort;
  hasMore: boolean;
  loadMore: () => void;
  onSort: (sort: Sort) => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpen: (id: string) => void;
};

/** Click cycles: title A–Z; priority urgent first; due soonest ↔ latest. */
const SORTABLE: { key: string; sorts: Sort[] }[] = [
  { key: "title", sorts: ["title"] },
  { key: "priority", sorts: ["priority"] },
  { key: "due", sorts: ["dueAt", "-dueAt"] },
];

export function TaskTable(props: Props) {
  const { tasks, selected, selectable, sort, hasMore, loadMore } = props;
  const t = useTranslations("List");
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const virtual = tasks.length > VIRTUAL_FROM;
  // TanStack Virtual returns non-memoizable functions; React Compiler skips this component
  // on purpose (react-hooks/incompatible-library), which is what the library expects.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: virtual,
  });

  // Infinite scroll: load the next page when the end of the list comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && loadMore(),
      {
        root: scroller.current,
        rootMargin: "200px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, tasks.length]);

  const items = virtual ? virtualizer.getVirtualItems() : null;
  const rows = items
    ? items.map((item) => ({ task: tasks[item.index], index: item.index }))
    : tasks.map((task, index) => ({ task, index }));
  const padTop = items?.[0]?.start ?? 0;
  const padBottom = items ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0) : 0;
  const allSelected = tasks.length > 0 && tasks.every((task) => selected.has(task.id));
  const colSpan = selectable ? 7 : 6;

  function header(key: string, label: string) {
    const column = SORTABLE.find((c) => c.key === key);
    if (!column)
      return (
        <th scope="col" className="px-3 py-2 text-left font-medium">
          {label}
        </th>
      );
    const at = column.sorts.indexOf(sort);
    const next = column.sorts[(at + 1) % column.sorts.length];
    const ariaSort = at === -1 ? "none" : sort?.startsWith("-") ? "descending" : "ascending";
    return (
      <th scope="col" aria-sort={ariaSort} className="px-3 py-2 text-left font-medium">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => props.onSort(next)}
        >
          {label}
          {ariaSort === "ascending" && <ArrowUp aria-hidden className="size-3.5" />}
          {ariaSort === "descending" && <ArrowDown aria-hidden className="size-3.5" />}
        </button>
      </th>
    );
  }

  return (
    <div
      ref={scroller}
      className="max-h-[calc(100dvh-16rem)] min-h-40 overflow-auto rounded-lg border"
    >
      <table aria-rowcount={tasks.length + 1} className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr aria-rowindex={1} className="border-b">
            {selectable && (
              <th scope="col" className="w-10 px-3">
                <Checkbox
                  checked={allSelected}
                  aria-label={t("selectAll")}
                  onCheckedChange={(checked) => props.onSelectAll(checked === true)}
                />
              </th>
            )}
            {header("title", t("title"))}
            {header("status", t("status"))}
            {header("priority", t("priority"))}
            {header("due", t("due"))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("estimate")}
            </th>
            {header("labels", t("labels"))}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden style={{ height: padTop }}>
              <td colSpan={colSpan} />
            </tr>
          )}
          {rows.map(({ task, index }) => (
            <TaskTableRow
              key={task.id}
              task={task}
              rowIndex={index + 2}
              status={props.statusOf(task)}
              selected={selected.has(task.id)}
              selectable={selectable}
              onSelect={props.onSelect}
              onOpen={props.onOpen}
            />
          ))}
          {padBottom > 0 && (
            <tr aria-hidden style={{ height: padBottom }}>
              <td colSpan={colSpan} />
            </tr>
          )}
        </tbody>
      </table>
      <div ref={sentinel} aria-hidden className="h-1" />
    </div>
  );
}
