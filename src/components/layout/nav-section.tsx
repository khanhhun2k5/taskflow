"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type NavSectionProps = {
  id: string;
  title: string;
  emptyText: string;
  addLabel: string;
};

/**
 * "Courses" group (projects use ProjectNavList). Stays empty until MVP-2; the add
 * button is visible but disabled (docs/10).
 */
export function NavSection({ id, title, emptyText, addLabel }: NavSectionProps) {
  const t = useTranslations("Common");
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h2
        id={headingId}
        className="sr-only px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:not-sr-only"
      >
        {title}
      </h2>
      <p className="hidden px-3 py-1 text-sm text-muted-foreground lg:block">{emptyText}</p>
      <Button
        variant="ghost"
        disabled
        title={t("comingSoon")}
        className="h-11 justify-center px-3 lg:justify-start"
      >
        <Plus aria-hidden />
        <span className="sr-only lg:not-sr-only">{addLabel}</span>
        <span className="sr-only">{` (${t("comingSoon")})`}</span>
      </Button>
    </section>
  );
}
