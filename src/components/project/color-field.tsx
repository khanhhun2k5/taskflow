"use client";

import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PROJECT_COLORS } from "@/features/projects/domain/palette";

/** The 12-color palette (docs/06 section 7) as a labelled radio group. */
export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("CreateProject.color")}</legend>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap"
      >
        {PROJECT_COLORS.map((color) => (
          <RadioGroupItem
            key={color.key}
            value={color.hex}
            aria-label={t(`Colors.${color.key}`)}
            className="size-9 border-2 border-transparent data-checked:border-foreground"
            style={{ backgroundColor: color.hex }}
          />
        ))}
      </RadioGroup>
    </fieldset>
  );
}
