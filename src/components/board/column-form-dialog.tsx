"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { statusCategorySchema, type StatusCategoryInput } from "@/features/tasks/schemas";

export type ColumnFormValues = {
  name: string;
  statusCategory: StatusCategoryInput;
  wipLimit: number | null;
  wipStrict: boolean;
};

export type ColumnFormMode = "add" | "rename" | "wip";

type Props = {
  mode: ColumnFormMode;
  initial: ColumnFormValues;
  onSubmit: (values: ColumnFormValues) => void;
  onClose: () => void;
};

const MAX_WIP = 999; // wipLimitSchema

/** Add a column, rename it, or set its WIP limit (US-16, US-17, BR-28…30). */
export function ColumnFormDialog({ mode, initial, onSubmit, onClose }: Props) {
  const t = useTranslations("ColumnForm");
  const ts = useTranslations("Status");
  const ids = { name: useId(), status: useId(), wip: useId(), strict: useId() };
  const [values, setValues] = useState(initial);
  const [wipText, setWipText] = useState(initial.wipLimit === null ? "" : String(initial.wipLimit));
  const wip = wipText.trim() === "" ? null : Number(wipText);
  const wipValid = wip === null || (Number.isInteger(wip) && wip >= 1 && wip <= MAX_WIP);
  const nameValid = values.name.trim().length > 0 && values.name.trim().length <= 60;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!nameValid || !wipValid) return;
    onSubmit({ ...values, name: values.name.trim(), wipLimit: wip });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`${mode}Title`)}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {mode !== "wip" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.name}>{t("name")}</Label>
              <Input
                id={ids.name}
                autoFocus
                value={values.name}
                maxLength={60}
                className="h-11"
                aria-invalid={!nameValid || undefined}
                onChange={(event) => setValues({ ...values, name: event.target.value })}
              />
            </div>
          )}
          {mode === "add" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.status}>{t("status")}</Label>
              <Select
                value={values.statusCategory}
                onValueChange={(value) =>
                  setValues({ ...values, statusCategory: value as StatusCategoryInput })
                }
              >
                <SelectTrigger id={ids.status} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusCategorySchema.options.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ts(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === "wip" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.wip}>{t("wipLimit")}</Label>
                <Input
                  id={ids.wip}
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_WIP}
                  value={wipText}
                  className="h-11"
                  aria-invalid={!wipValid || undefined}
                  aria-describedby={`${ids.wip}-hint`}
                  onChange={(event) => setWipText(event.target.value)}
                />
                <p id={`${ids.wip}-hint`} className="text-xs text-muted-foreground">
                  {wipValid ? t("wipHint") : t("wipInvalid", { max: MAX_WIP })}
                </p>
              </div>
              <div className="flex min-h-11 items-center gap-2">
                <Switch
                  id={ids.strict}
                  checked={values.wipStrict}
                  onCheckedChange={(wipStrict) => setValues({ ...values, wipStrict })}
                />
                <Label htmlFor={ids.strict}>{t("strict")}</Label>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11" disabled={!nameValid || !wipValid}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
