"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDialogBody } from "./task-dialog-body";
import { useTaskParam } from "./use-task-param";

// Full screen below 768px (docs/06 section 4.3), wide centered dialog from md up.
const contentClass =
  "max-h-dvh overflow-y-auto max-md:inset-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none sm:max-w-none md:max-h-[90dvh] md:w-[min(56rem,calc(100%-2rem))]";

/**
 * Where focus goes when the dialog closes: back to the element that opened it, or — if that
 * row is gone (task deleted) — to the page's quick add box, or the main region.
 */
function restoreFocus(trigger: HTMLElement | null) {
  if (trigger?.isConnected) {
    trigger.focus();
    return;
  }
  const main = document.querySelector<HTMLElement>("main");
  const fallback = main?.querySelector<HTMLElement>("input:not([disabled])") ?? main;
  if (fallback === main && main) main.tabIndex = -1;
  fallback?.focus();
}

/** The single task dialog of the app, opened with ?task=<id> from any page (docs/06 1.2). */
export function TaskDialog() {
  const t = useTranslations("TaskDialog");
  const { taskId, open, replace, close } = useTaskParam();
  const trigger = useRef<HTMLElement | null>(null);
  const isOpen = taskId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        className={contentClass}
        aria-describedby={undefined}
        onOpenAutoFocus={() => {
          // Runs before Radix moves focus inside, so this is still the row that was clicked.
          const active = document.activeElement;
          trigger.current =
            active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus(trigger.current);
          trigger.current = null;
        }}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        {taskId ? (
          <TaskDialogBody
            key={taskId}
            taskId={taskId}
            onOpen={open}
            onReplace={replace}
            onClose={close}
          />
        ) : (
          <Skeleton className="h-64" />
        )}
      </DialogContent>
    </Dialog>
  );
}
