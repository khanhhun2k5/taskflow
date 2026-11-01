"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TaskDTO } from "@/features/tasks/schemas";
import { useDebouncedSave, type SaveTask } from "./use-autosave";

// NFR-14: react-markdown with its defaults ignores raw HTML. Never add rehype-raw or any
// plugin that renders HTML from the description.
const markdownClass =
  "flex flex-col gap-2 break-words [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5";

export function TaskDescription({ task, save }: { task: TaskDTO; save: SaveTask }) {
  const t = useTranslations("TaskDialog");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");
  const { schedule, flush } = useDebouncedSave((value: string) => {
    const description = value.trim() ? value : null;
    if (description !== task.description) save({ description }, { description });
  });

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          autoFocus
          aria-label={t("description")}
          placeholder={t("descriptionPlaceholder")}
          value={draft}
          maxLength={20_000}
          className="min-h-32"
          onChange={(event) => {
            setDraft(event.target.value);
            schedule(event.target.value);
          }}
          onBlur={flush}
        />
        <Button
          variant="outline"
          className="h-9 self-end"
          onClick={() => {
            flush();
            setEditing(false);
          }}
        >
          {t("doneEditing")}
        </Button>
      </div>
    );
  }

  if (!draft.trim()) {
    return (
      <button
        type="button"
        className="rounded-md border border-dashed p-3 text-left text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setEditing(true)}
      >
        {t("descriptionEmpty")}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className={`min-w-0 flex-1 text-sm ${markdownClass}`}>
        <Markdown>{draft}</Markdown>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("editDescription")}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden />
      </Button>
    </div>
  );
}
