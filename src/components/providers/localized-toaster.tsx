"use client";

import { useTranslations } from "next-intl";
import { Toaster } from "@/components/ui/sonner";

/** Toasts with translated screen-reader labels; render inside IntlBoundary. */
export function LocalizedToaster() {
  const t = useTranslations("Common");
  return (
    <Toaster
      position="bottom-right"
      closeButton
      containerAriaLabel={t("notifications")}
      toastOptions={{ closeButtonAriaLabel: t("closeNotification") }}
    />
  );
}
