"use client";

import { CalendarX, Tags, Trash2, X } from "lucide-react";
import { useTimeZone, useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ColumnDTO } from "@/features/boards/schemas";
import { useLabels } from "@/features/labels/hooks";
import type { BulkVars } from "@/features/tasks/list-hooks";
import { BULK_MAX, prioritySchema, statusCategorySchema } from "@/features/tasks/schemas";
import { zonedToUtcIso } from "@/lib/dates";
import { FilterSelect } from "./filter-select";

type Props = {
  ids: string[];
  /** Board columns for "move" in a project; null in the inbox ("status" instead, BR-02). */
  columns: ColumnDTO[] | null;
  onAction: (vars: Omit<BulkVars, "ids">) => void;
  onClear: () => void;
};

/** Floating bulk actions (BR-31): column/status, priority, labels, due date, delete. */
export function BulkBar({ ids, columns, onAction, onClear }: Props) {
  const t = useTranslations("Bulk");
  const ts = useTranslations("Status");
  const tp = useTranslations("Priority");
  const tz = useTimeZone() ?? "UTC";
  const labels = useLabels().data?.items ?? [];
  const dueId = useId();
  const tooMany = ids.length > BULK_MAX;

  return (
    <section
      aria-label={t("label")}
      className="fixed inset-x-4 bottom-20 z-30 flex flex-wrap items-end gap-3 rounded-xl border bg-popover p-3 shadow-lg md:inset-x-auto md:right-6 md:bottom-6 md:left-auto md:max-w-[calc(100%-18rem)]"
    >
      <p role="status" className="min-h-11 self-center text-sm font-medium">
        {t("selected", { count: ids.length })}
        {tooMany && (
          <span className="block text-xs font-normal text-red-700 dark:text-red-400">
            {t("max", { max: BULK_MAX })}
          </span>
        )}
      </p>
      {columns ? (
        <FilterSelect
          label={t("move")}
          anyLabel="—"
          value={undefined}
          options={columns.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(columnId) => {
            const column = columns.find((c) => c.id === columnId);
            if (column)
              onAction({
                action: { type: "move", columnId: column.id },
                columnStatus: column.statusCategory,
              });
          }}
        />
      ) : (
        <FilterSelect
          label={t("status")}
          anyLabel="—"
          value={undefined}
          options={statusCategorySchema.options.map((value) => ({ value, label: ts(value) }))}
          onChange={(status) => status && onAction({ action: { type: "setStatus", status } })}
        />
      )}
      <FilterSelect
        label={t("priority")}
        anyLabel="—"
        value={undefined}
        options={prioritySchema.options.map((value) => ({ value, label: tp(value) }))}
        onChange={(priority) => priority && onAction({ action: { type: "setPriority", priority } })}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-11" disabled={labels.length === 0}>
            <Tags aria-hidden />
            {t("labels")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{t("addLabel")}</DropdownMenuLabel>
          {labels.map((label) => (
            <DropdownMenuItem
              key={`add-${label.id}`}
              onSelect={() => onAction({ action: { type: "addLabel", labelId: label.id }, label })}
            >
              {label.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("removeLabel")}</DropdownMenuLabel>
          {labels.map((label) => (
            <DropdownMenuItem
              key={`remove-${label.id}`}
              onSelect={() => onAction({ action: { type: "removeLabel", labelId: label.id } })}
            >
              {label.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex flex-col gap-1">
        <label htmlFor={dueId} className="text-xs font-medium text-muted-foreground">
          {t("due")}
        </label>
        {/* Bulk setDue sets the date only: 00:00 of that day in User.timezone (NFR-32). */}
        <Input
          id={dueId}
          type="date"
          className="h-11 w-40"
          onChange={(e) =>
            e.target.value &&
            onAction({ action: { type: "setDue", dueAt: zonedToUtcIso(e.target.value, null, tz) } })
          }
        />
      </div>
      <Button
        variant="outline"
        className="h-11"
        onClick={() => onAction({ action: { type: "setDue", dueAt: null } })}
      >
        <CalendarX aria-hidden />
        {t("clearDue")}
      </Button>
      <Button
        variant="outline"
        className="h-11 text-red-700 dark:text-red-400"
        onClick={() => onAction({ action: { type: "delete" } })}
      >
        <Trash2 aria-hidden />
        {t("delete")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={t("clear")}
        onClick={onClear}
      >
        <X aria-hidden />
      </Button>
    </section>
  );
}
