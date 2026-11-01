"use client";

import { Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateLabel, useLabels } from "@/features/labels/hooks";
import type { LabelDTO } from "@/features/labels/schemas";
import { isTempId } from "@/features/query-keys";
import type { TaskDTO } from "@/features/tasks/schemas";
import { isApiError } from "@/lib/api-client";
import type { SaveTask } from "./use-autosave";

const byName = (a: LabelDTO, b: LabelDTO) => a.name.localeCompare(b.name);

/** Pick labels for a task and create new ones in place (BR-81: names unique, any case). */
export function LabelPicker({ task, save }: { task: TaskDTO; save: SaveTask }) {
  const t = useTranslations("Labels");
  const labels = useLabels();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // A label created in place is added to the task as it is when the server answers.
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  function setLabels(next: LabelDTO[]) {
    const sorted = [...next].sort(byName);
    save({ labelIds: sorted.map((label) => label.id) }, { labels: sorted });
  }
  function addLabel(label: LabelDTO) {
    const current = taskRef.current.labels;
    if (!current.some((other) => other.id === label.id)) setLabels([...current, label]);
  }

  const createLabel = useCreateLabel({
    onCreated: addLabel,
    handleError: (error, input) => {
      if (!isApiError(error) || error.code !== "LABEL_EXISTS") return false;
      const existing = labels.data?.items.find(
        (label) => label.name.toLowerCase() === input.name.toLowerCase() && !isTempId(label.id),
      );
      if (existing) addLabel(existing);
      else void labels.refetch();
      setNotice(t("exists", { name: input.name }));
      return true;
    },
  });

  const all = (labels.data?.items ?? []).filter((label) => !isTempId(label.id));
  const chosen = new Set(task.labels.map((label) => label.id));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{t("label")}</span>
      {task.labels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("label")}>
          {task.labels.map((label) => (
            <li
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </li>
          ))}
        </ul>
      )}
      <Popover onOpenChange={() => setNotice(null)}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-11 justify-start px-3">
            <Tags aria-hidden />
            {t("choose")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-72 flex-col gap-2">
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {all.map((label) => (
                <li key={label.id}>
                  <label className="flex min-h-9 items-center gap-2 rounded-md px-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={chosen.has(label.id)}
                      onCheckedChange={(checked) =>
                        setLabels(
                          checked === true
                            ? [...task.labels, label]
                            : task.labels.filter((other) => other.id !== label.id),
                        )
                      }
                    />
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <Input
            aria-label={t("newName")}
            placeholder={t("newName")}
            value={name}
            maxLength={40}
            className="h-9"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              const value = name.trim();
              if (event.key !== "Enter" || !value) return;
              event.preventDefault();
              setNotice(null);
              createLabel.create({ name: value });
              setName("");
            }}
          />
          {name.trim() && (
            <p className="text-xs text-muted-foreground">{t("create", { name: name.trim() })}</p>
          )}
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground empty:hidden"
          >
            {notice}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
