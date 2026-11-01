"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useDebouncedSave } from "@/components/task/use-autosave";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/features/labels/hooks";
import type { TaskListParams } from "@/features/query-keys";
import { hasFilters } from "@/features/tasks/list-params";
import { prioritySchema, statusCategorySchema, TASK_SORTS } from "@/features/tasks/schemas";
import { FilterSelect } from "./filter-select";

type Props = { params: TaskListParams; onChange: (params: TaskListParams) => void };

/** Filter bar of ListView (docs/06 section 4.5, US-19); every value goes to the URL. */
export function ListFilters({ params, onChange }: Props) {
  const t = useTranslations("Filters");
  const ts = useTranslations("Status");
  const tp = useTranslations("Priority");
  const labels = useLabels();
  const ids = { q: useId(), from: useId(), to: useId(), overdue: useId() };
  const [q, setQ] = useState(params.q ?? "");
  const { schedule } = useDebouncedSave(
    (value: string) => onChange({ ...params, q: value.trim() || undefined }),
    300,
  );
  const set = (patch: Partial<TaskListParams>) => onChange({ ...params, ...patch });

  return (
    <div role="search" aria-label={t("label")} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor={ids.q} className="text-xs font-medium text-muted-foreground">
          {t("search")}
        </label>
        <Input
          id={ids.q}
          type="search"
          value={q}
          className="h-11"
          onChange={(e) => {
            setQ(e.target.value);
            schedule(e.target.value);
          }}
        />
      </div>
      <FilterSelect
        label={t("status")}
        anyLabel={t("any")}
        value={params.status}
        options={statusCategorySchema.options.map((value) => ({ value, label: ts(value) }))}
        onChange={(status) => set({ status })}
      />
      <FilterSelect
        label={t("priority")}
        anyLabel={t("any")}
        value={params.priority}
        options={prioritySchema.options.map((value) => ({ value, label: tp(value) }))}
        onChange={(priority) => set({ priority })}
      />
      <FilterSelect
        label={t("labelFilter")}
        anyLabel={t("any")}
        value={params.labelId}
        options={(labels.data?.items ?? []).map((label) => ({
          value: label.id,
          label: label.name,
        }))}
        onChange={(labelId) => set({ labelId })}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.from} className="text-xs font-medium text-muted-foreground">
          {t("from")}
        </label>
        <Input
          id={ids.from}
          type="date"
          className="h-11 w-40"
          value={params.from ?? ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.to} className="text-xs font-medium text-muted-foreground">
          {t("to")}
        </label>
        <Input
          id={ids.to}
          type="date"
          className="h-11 w-40"
          value={params.to ?? ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
        />
      </div>
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox
          id={ids.overdue}
          checked={params.overdue === true}
          onCheckedChange={(checked) => set({ overdue: checked === true ? true : undefined })}
        />
        <label htmlFor={ids.overdue} className="text-sm">
          {t("overdue")}
        </label>
      </div>
      <FilterSelect
        label={t("sort")}
        anyLabel={t("sorts.order")}
        value={params.sort === "order" ? undefined : params.sort}
        options={TASK_SORTS.filter((sort) => sort !== "order").map((value) => ({
          value,
          label: t(`sorts.${value}`),
        }))}
        onChange={(sort) => set({ sort })}
      />
      {hasFilters(params) && (
        <Button
          variant="ghost"
          className="h-11"
          onClick={() => {
            setQ("");
            onChange(params.sort ? { sort: params.sort } : {});
          }}
        >
          <X aria-hidden />
          {t("clear")}
        </Button>
      )}
    </div>
  );
}
