"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { pickDisplayedProgress, type ProgressSummary } from "@/features/progress/domain/display";

/**
 * docs/07 section 3: P_w when weightedReliable, otherwise P with the "add estimates" hint.
 * Shared by ProjectCard and ProgressHeader.
 */
export function ProgressMeter({ summary, name }: { summary: ProgressSummary; name: string }) {
  const t = useTranslations("Progress");
  const shown = pickDisplayedProgress(summary);
  const kind = shown.kind === "weighted" ? t("weighted") : t("count");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {t("label")} · {kind}
        </span>
        <span className="font-medium tabular-nums">{shown.percent}%</span>
      </div>
      <Progress
        value={shown.percent}
        aria-label={`${t("label")} ${name}: ${shown.percent}% (${kind})`}
      />
      {shown.showEstimateHint && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Info aria-hidden className="size-3.5" />
          {t("estimateHint")}
        </p>
      )}
    </div>
  );
}
