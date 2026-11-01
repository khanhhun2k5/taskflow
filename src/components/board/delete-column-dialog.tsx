"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoardDTO } from "@/features/boards/schemas";

type Column = BoardDTO["columns"][number];

type Props = {
  column: Column;
  others: Column[];
  onDelete: (moveTo: string | undefined) => void;
  onClose: () => void;
};

/**
 * BR-26: a column that still has tasks needs a target column. BR-25 (one TODO and one DONE
 * column) is checked by the server; BOARD_NEEDS_TODO_AND_DONE shows its message as a toast.
 */
export function DeleteColumnDialog({ column, others, onDelete, onClose }: Props) {
  const t = useTranslations("DeleteColumn");
  const selectId = useId();
  const hasTasks = column.tasks.length > 0;
  const [moveTo, setMoveTo] = useState(others[0]?.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: column.name })}</DialogTitle>
          <DialogDescription>
            {hasTasks ? t("hasTasks", { count: column.tasks.length }) : t("empty")}
          </DialogDescription>
        </DialogHeader>
        {hasTasks && (
          <div className="flex flex-col gap-2">
            <label htmlFor={selectId} className="text-sm font-medium">
              {t("moveTo")}
            </label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id={selectId} className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((other) => (
                  <SelectItem key={other.id} value={other.id}>
                    {other.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="outline"
            className="h-11 text-red-700 dark:text-red-400"
            disabled={hasTasks && !moveTo}
            onClick={() => {
              onDelete(hasTasks ? moveTo : undefined);
              onClose();
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
