"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { isApiError, isRetryable } from "@/lib/api-client";

/**
 * Error code → localized message (messages/*.json "Errors"), never the technical server
 * message (docs/06 section 6). "Retry" only for transient failures (NFR-51).
 */
export function useErrorMessage() {
  const t = useTranslations("Errors");
  return useCallback(
    (error: unknown) => {
      const code = isApiError(error) ? error.code : "generic";
      return t.has(code) ? t(code) : t("generic");
    },
    [t],
  );
}

export function useErrorToast() {
  const message = useErrorMessage();
  const t = useTranslations("Common");
  return useCallback(
    (error: unknown, retry?: () => void) => {
      const action =
        retry && isRetryable(error) ? { label: t("retry"), onClick: retry } : undefined;
      toast.error(message(error), { action });
    },
    [message, t],
  );
}
