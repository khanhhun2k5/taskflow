"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DEFAULT_PROJECT_COLOR } from "@/features/projects/domain/palette";
import type { CreateProjectBody } from "@/features/projects/hooks";
import { createProjectSchema } from "@/features/projects/schemas";
import { ColorField } from "./color-field";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateProjectBody) => void;
};

type Choice =
  | { name: "workflow"; values: readonly ["KANBAN", "SCRUM"] }
  | { name: "estimateUnit"; values: readonly ["POINTS", "HOURS"] };
const CHOICES: Choice[] = [
  { name: "workflow", values: ["KANBAN", "SCRUM"] },
  { name: "estimateUnit", values: ["POINTS", "HOURS"] },
];

/** Create a project (US-14, BR-20): name, color, Kanban/Scrum, estimate unit. */
export function CreateProjectDialog({ open, onOpenChange, onCreate }: Props) {
  const t = useTranslations();
  const { register, handleSubmit, control, reset, formState } = useForm<CreateProjectBody>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_PROJECT_COLOR,
      workflow: "KANBAN",
      estimateUnit: "POINTS",
    },
  });

  /** Every way of closing (Esc, overlay, Cancel) clears the form. */
  function close() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("CreateProject.title")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={handleSubmit((values) => {
            onCreate(values);
            reset();
          })}
        >
          <FormField
            id="project-name"
            label={t("CreateProject.name")}
            autoComplete="off"
            maxLength={120}
            error={formState.errors.name ? t("CreateProject.nameError") : undefined}
            {...register("name")}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorField value={field.value ?? DEFAULT_PROJECT_COLOR} onChange={field.onChange} />
            )}
          />
          {CHOICES.map((choice) => (
            <Controller
              key={choice.name}
              control={control}
              name={choice.name}
              render={({ field }) => (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t(`CreateProject.${choice.name}`)}
                  </legend>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-wrap gap-4"
                  >
                    {choice.values.map((value) => (
                      <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                        <RadioGroupItem value={value} />
                        {choice.name === "workflow"
                          ? t(`Projects.${value}`)
                          : t(`EstimateUnit.${value}`)}
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}
            />
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={close}>
              {t("Common.cancel")}
            </Button>
            <Button type="submit" className="h-11">
              {t("CreateProject.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
