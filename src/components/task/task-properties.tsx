"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectDTO } from "@/features/projects/schemas";
import { prioritySchema, type PriorityInput, type TaskDTO } from "@/features/tasks/schemas";
import { PriorityIcon } from "./priority-icon";
import { useDebouncedSave, type SaveTask } from "./use-autosave";

type PropertyProps = { task: TaskDTO; save: SaveTask };

export function PriorityField({ task, save }: PropertyProps) {
  const t = useTranslations("Priority");
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {t("label")}
      </label>
      <Select
        value={task.priority}
        onValueChange={(value) => {
          const priority = value as PriorityInput;
          if (priority !== task.priority) save({ priority }, { priority });
        }}
      >
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {prioritySchema.options.map((priority) => (
            <SelectItem key={priority} value={priority}>
              <PriorityIcon priority={priority} />
              {t(priority)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const MAX_ESTIMATE = 9999; // createTaskSchema

/** Estimate with the project's unit (points or hours), saved 500 ms after typing stops. */
export function EstimateField({
  task,
  save,
  unit,
}: PropertyProps & { unit: ProjectDTO["estimateUnit"] | null }) {
  const t = useTranslations();
  const id = useId();
  const [draft, setDraft] = useState(task.estimate === null ? "" : String(task.estimate));
  const { schedule, flush } = useDebouncedSave((value: string) => {
    const estimate = value.trim() === "" ? null : Number(value);
    if (
      estimate !== null &&
      (!Number.isFinite(estimate) || estimate < 0 || estimate > MAX_ESTIMATE)
    ) {
      return;
    }
    if (estimate !== task.estimate) save({ estimate }, { estimate });
  });

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {t("TaskDialog.estimate")}
        {unit && ` (${t(`EstimateUnit.${unit}`)})`}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={MAX_ESTIMATE}
        step="any"
        value={draft}
        className="h-11"
        onChange={(event) => {
          setDraft(event.target.value);
          schedule(event.target.value);
        }}
        onBlur={flush}
      />
    </div>
  );
}
