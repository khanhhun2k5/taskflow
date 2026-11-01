"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useUpdateProject } from "@/features/projects/hooks";

/** Archived projects are read-only (BR-22); this strip explains it and offers unarchive. */
export function ArchivedBanner({ projectId }: { projectId: string }) {
  const t = useTranslations("Archived");
  const update = useUpdateProject();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-600/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <span className="inline-flex items-center gap-2">
        <Archive aria-hidden className="size-4 shrink-0" />
        {t("notice")}
      </span>
      <Button
        variant="outline"
        className="h-11"
        onClick={() => update.mutate({ id: projectId, input: { status: "ACTIVE" } })}
      >
        {t("unarchive")}
      </Button>
    </div>
  );
}
