"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/features/use-error-toast";

type ErrorStateProps = {
  error: unknown;
  onRetry: () => void;
  title?: string;
};

/** docs/06 section 6 "Error": plain-language message + "Retry", no technical details. */
export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const t = useTranslations();
  const message = useErrorMessage();
  return (
    <section
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 p-8 text-center"
    >
      <TriangleAlert aria-hidden className="size-7 text-destructive" />
      <h2 className="text-base font-medium">{title ?? t("States.loadError")}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{message(error)}</p>
      <Button variant="outline" className="h-11 px-4" onClick={onRetry}>
        <RotateCw aria-hidden />
        {t("Common.retry")}
      </Button>
    </section>
  );
}
