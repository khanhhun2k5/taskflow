"use client";

import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANY = "__any";

type Props<T extends string> = {
  label: string;
  anyLabel: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
};

/** A labelled select whose first option means "no filter". */
export function FilterSelect<T extends string>({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: Props<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? undefined : (next as T))}
      >
        <SelectTrigger id={id} className="h-11 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
