"use client";

import type { ColumnMeta } from "./board-layout";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardDTO } from "@/features/boards/schemas";
import { isTempId } from "@/features/query-keys";
import { statusCategorySchema, type StatusCategoryInput } from "@/features/tasks/schemas";
import { ColumnDialogs, type ColumnDialog } from "./column-dialogs";
import type { ColumnFormValues } from "./column-form-dialog";

type Column = BoardDTO["columns"][number];

export type ColumnActions = {
  update: (input: Partial<ColumnFormValues>) => void;
  add: (side: "left" | "right", values: ColumnFormValues) => void;
  move: (direction: -1 | 1) => void;
  remove: (moveTo: string | undefined) => void;
};

type Props = {
  column: Column;
  headingId: string;
  others: ColumnMeta[];
  canMove: { left: boolean; right: boolean };
  readOnly: boolean;
  actions: ColumnActions;
};

/** Name, "count/limit" (BR-29: red border + icon + text when over) and the column menu. */
export function ColumnHeader({ column, headingId, others, canMove, readOnly, actions }: Props) {
  const t = useTranslations("Board");
  const ts = useTranslations("Status");
  const [dialog, setDialog] = useState<ColumnDialog>(null);
  const count = column.tasks.length;
  const over = column.wipLimit !== null && count > column.wipLimit;

  return (
    <div className="flex items-center justify-between gap-2">
      <h2
        id={headingId}
        className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-medium"
      >
        <span className="break-words">{column.name}</span>
        <span
          className={
            over
              ? "inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400"
              : "font-normal text-muted-foreground"
          }
        >
          {over && <TriangleAlert aria-hidden className="size-3.5" />}
          {column.wipLimit === null
            ? t("count", { count })
            : t("wipCount", { count, limit: column.wipLimit })}
          {over && <span className="sr-only">{` (${t("overLimit")})`}</span>}
          {column.wipStrict && column.wipLimit !== null && (
            <span className="sr-only">{` (${t("strict")})`}</span>
          )}
        </span>
      </h2>
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isTempId(column.id)}>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={t("columnMenu", { name: column.name })}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("rename")}>{t("rename")}</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("status")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={column.statusCategory}
                  onValueChange={(value) =>
                    actions.update({ statusCategory: value as StatusCategoryInput })
                  }
                >
                  {statusCategorySchema.options.map((status) => (
                    <DropdownMenuRadioItem key={status} value={status}>
                      {ts(status)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => setDialog("wip")}>{t("setWip")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialog("add-left")}>
              {t("addLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("add-right")}>
              {t("addRight")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMove.left} onSelect={() => actions.move(-1)}>
              {t("moveLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMove.right} onSelect={() => actions.move(1)}>
              {t("moveRight")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ColumnDialogs
        dialog={dialog}
        column={column}
        others={others}
        actions={actions}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
