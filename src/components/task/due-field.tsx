"use client";

import { CalendarDays, X } from "lucide-react";
import { useFormatter, useLocale, useTimeZone, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { enUS, vi } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { TaskDTO } from "@/features/tasks/schemas";
import { utcToZonedParts, zonedToUtcIso } from "@/lib/dates";
import { useDebouncedSave, type SaveTask } from "./use-autosave";

const DEFAULT_TIME = "09:00";
const pad = (value: number) => String(value).padStart(2, "0");

/** Calendar works with local Date objects; only the Y-M-D digits are used. */
const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIsoDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Due date picker (docs/06 section 4.3): date, "All day" switch and time, all in
 * User.timezone. All-day dates are stored as 00:00 of that day in the user's zone (NFR-32).
 */
export function DueField({ task, save }: { task: TaskDTO; save: SaveTask }) {
  const t = useTranslations("TaskDialog");
  const tz = useTimeZone() ?? "UTC";
  const locale = useLocale();
  const format = useFormatter();
  const switchId = useId();
  const timeId = useId();
  const parts = task.dueAt ? utcToZonedParts(task.dueAt, tz) : null;

  function saveDue(day: string | null, allDay: boolean, time: string) {
    const dueAt = day === null ? null : zonedToUtcIso(day, allDay ? null : time, tz);
    save({ dueAt, dueAllDay: allDay }, { dueAt, dueAllDay: allDay, isOverdue: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{t("due")}</span>
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 flex-1 justify-start px-3">
              <CalendarDays aria-hidden />
              {parts
                ? format.dateTime(new Date(task.dueAt ?? ""), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : t("noDue")}
              <span className="sr-only">{` — ${t("pickDate")}`}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              today={fromIsoDay(utcToZonedParts(new Date().toISOString(), tz).date)}
              locale={locale === "en" ? enUS : vi}
              selected={parts ? fromIsoDay(parts.date) : undefined}
              defaultMonth={parts ? fromIsoDay(parts.date) : undefined}
              onSelect={(date) => {
                if (date) saveDue(toIsoDay(date), task.dueAllDay, parts?.time ?? DEFAULT_TIME);
              }}
            />
          </PopoverContent>
        </Popover>
        {parts && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t("clearDue")}
            onClick={() => saveDue(null, true, DEFAULT_TIME)}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      {parts && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-11 items-center gap-2">
            <Switch
              id={switchId}
              checked={task.dueAllDay}
              onCheckedChange={(allDay) =>
                saveDue(parts.date, allDay, allDay ? parts.time : DEFAULT_TIME)
              }
            />
            <label htmlFor={switchId} className="text-sm">
              {t("allDay")}
            </label>
          </div>
          {!task.dueAllDay && (
            <div className="flex items-center gap-2">
              <label htmlFor={timeId} className="text-sm">
                {t("time")}
              </label>
              <TimeInput
                id={timeId}
                value={parts.time}
                onSave={(time) => saveDue(parts.date, false, time)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Controlled time box, saved 500 ms after a change and on blur or close (unmount flush). */
function TimeInput({
  id,
  value,
  onSave,
}: {
  id: string;
  value: string;
  onSave: (time: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const { schedule, flush } = useDebouncedSave((time: string) => {
    if (time && time !== value) onSave(time);
  });
  return (
    <Input
      id={id}
      type="time"
      className="h-11 w-32"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        schedule(event.target.value);
      }}
      onBlur={flush}
    />
  );
}
