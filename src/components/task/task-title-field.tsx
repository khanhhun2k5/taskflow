"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TaskDTO } from "@/features/tasks/schemas";
import type { SaveTask } from "./use-autosave";
import { useDebouncedSave } from "./use-autosave";

/** Title edited in place, saved 500 ms after typing stops; empty titles are never sent. */
export function TaskTitleField({ task, save }: { task: TaskDTO; save: SaveTask }) {
  const t = useTranslations("TaskDialog");
  const [draft, setDraft] = useState(task.title);
  const { schedule, flush } = useDebouncedSave((value: string) => {
    const title = value.trim();
    if (title && title !== task.title) save({ title }, { title });
  });

  return (
    <textarea
      aria-label={t("titleLabel")}
      value={draft}
      maxLength={300}
      rows={1}
      className="field-sizing-content w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onChange={(event) => {
        const value = event.target.value.replace(/\n/g, " ");
        setDraft(value);
        schedule(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          flush();
        }
      }}
      onBlur={() => {
        if (!draft.trim()) setDraft(task.title);
        flush();
      }}
    />
  );
}
