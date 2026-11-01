"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SaveState } from "./use-autosave";

/** "Saving…" / "Saved" next to the dialog title (docs/06 section 4.3), announced politely. */
export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("Common");
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
    >
      {state === "saving" && (
        <>
          <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
          {t("saving")}
        </>
      )}
      {state === "saved" && (
        <>
          <Check aria-hidden className="size-3.5" />
          {t("saved")}
        </>
      )}
      {state === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <CircleAlert aria-hidden className="size-3.5" />
          {t("saveFailed")}
        </span>
      )}
    </span>
  );
}
