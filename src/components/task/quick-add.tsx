"use client";

import { Plus } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

type QuickAddProps = {
  /** Called with the trimmed title; the page decides the context (docs/06 section 4.1). */
  onSubmit: (title: string) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  /** Smaller box at the end of a Kanban column. */
  compact?: boolean;
  /** The page's main box, focused by the "n" shortcut (docs/06 section 5). */
  shortcutTarget?: boolean;
};

const MAX_TITLE = 300; // createTaskSchema

/**
 * docs/06 section 4.1: Enter creates, the box empties and keeps focus; Esc clears and
 * leaves the box; empty or whitespace-only input does nothing.
 */
export function QuickAdd({
  onSubmit,
  label,
  placeholder,
  disabled,
  compact = false,
  shortcutTarget = false,
}: QuickAddProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const title = value.trim();
      if (!title) return;
      onSubmit(title);
      setValue("");
      inputRef.current?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation(); // do not close a surrounding dialog
      setValue("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Plus
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        ref={inputRef}
        value={value}
        maxLength={MAX_TITLE}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        className={compact ? "h-9 pl-9 text-sm" : "h-11 pl-9"}
        data-quick-add={shortcutTarget ? "" : undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
