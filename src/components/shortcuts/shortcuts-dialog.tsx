"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["n"], action: "quickAdd" },
  { keys: ["g", "i"], action: "goInbox" },
  { keys: ["g", "t"], action: "goToday" },
  { keys: ["1"], action: "viewKanban" },
  { keys: ["2"], action: "viewList" },
  { keys: ["e"], action: "open" },
  { keys: ["x"], action: "select" },
  { keys: ["Shift", "D"], action: "markDone" },
  { keys: ["?"], action: "help" },
] as const;

/** The "?" dialog (docs/06 section 5). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Shortcuts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="contents">
              <dt className="flex gap-1">
                {keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    {index > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {keys[0] === "g" ? t("then") : "+"}
                      </span>
                    )}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {key}
                    </kbd>
                  </span>
                ))}
              </dt>
              <dd>{t(action)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
