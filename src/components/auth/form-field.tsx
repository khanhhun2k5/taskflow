import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
};

/** Labelled input with an accessible error message (NFR-21). */
export function FormField({ id, label, error, className, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className={className ?? "h-11 md:h-9"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
