"use client";

import { CalendarDays, Coffee, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * "Empty" state of Today (docs/06 section 6): small illustration, one sentence, actions.
 * Quick add is MVP-1 and the calendar is MVP-2, so both actions are disabled for now.
 */
export function TodayEmpty() {
  const t = useTranslations();

  return (
    <section
      aria-labelledby="today-empty-title"
      className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center"
    >
      <div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Coffee className="size-8" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 id="today-empty-title" className="text-lg font-medium">
          {t("Today.empty.title")}
        </h2>
        <p className="text-muted-foreground">{t("Today.empty.description")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button disabled title={t("Common.comingSoon")} className="h-11 px-4">
          <Plus aria-hidden />
          {t("Today.empty.addTask")}
          <span className="sr-only">{` (${t("Common.comingSoon")})`}</span>
        </Button>
        <Button variant="outline" disabled title={t("Common.comingSoon")} className="h-11 px-4">
          <CalendarDays aria-hidden />
          {t("Today.empty.viewWeek")}
          <span className="sr-only">{` (${t("Common.comingSoon")})`}</span>
        </Button>
      </div>
    </section>
  );
}
