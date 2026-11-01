"use client";

import type { BoardDTO } from "@/features/boards/schemas";
import type { ColumnActions } from "./column-header";
import { ColumnFormDialog, type ColumnFormMode, type ColumnFormValues } from "./column-form-dialog";
import { DeleteColumnDialog } from "./delete-column-dialog";

type Column = BoardDTO["columns"][number];

export type ColumnDialog = ColumnFormMode | "add-left" | "add-right" | "delete" | null;

type Props = {
  dialog: ColumnDialog;
  column: Column;
  others: Column[];
  actions: ColumnActions;
  onClose: () => void;
};

/** The dialogs opened from a column menu (rename, WIP, add left/right, delete). */
export function ColumnDialogs({ dialog, column, others, actions, onClose }: Props) {
  const values: ColumnFormValues = {
    name: column.name,
    statusCategory: column.statusCategory,
    wipLimit: column.wipLimit,
    wipStrict: column.wipStrict,
  };
  return (
    <>
      {(dialog === "rename" || dialog === "wip") && (
        <ColumnFormDialog
          mode={dialog}
          initial={values}
          onClose={onClose}
          onSubmit={(next) =>
            actions.update(
              dialog === "rename"
                ? { name: next.name }
                : { wipLimit: next.wipLimit, wipStrict: next.wipStrict },
            )
          }
        />
      )}
      {(dialog === "add-left" || dialog === "add-right") && (
        <ColumnFormDialog
          mode="add"
          initial={{ name: "", statusCategory: "IN_PROGRESS", wipLimit: null, wipStrict: false }}
          onClose={() => onClose()}
          onSubmit={(next) => actions.add(dialog === "add-left" ? "left" : "right", next)}
        />
      )}
      {dialog === "delete" && (
        <DeleteColumnDialog
          column={column}
          others={others}
          onDelete={actions.remove}
          onClose={() => onClose()}
        />
      )}
    </>
  );
}
