import { TZDate } from "@date-fns/tz";
import { addDays, endOfDay, startOfDay } from "date-fns";

// Time zone helpers (docs/08-non-functional.md section 4).
// Instants are stored in UTC; "today", "end of day" etc. are computed in the user's
// IANA time zone. Never compare dates as strings (NFR-33) and never call `new Date()`
// without arguments here: callers pass `now` (NFR-34).

/**
 * Mirrors the Prisma enum `StatusCategory` (`Task.statusCategory`). Domain code imports this
 * type instead of Prisma; tests/integration/manual-db-objects.test.ts checks they match.
 */
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

function toPlainDate(date: Date): Date {
  return new Date(date.getTime());
}

/** Wraps an instant in time zone `tz`; throws on an unknown zone instead of yielding NaN. */
function inTz(date: Date, tz: string): TZDate {
  const zoned = new TZDate(date.getTime(), tz);
  if (Number.isNaN(zoned.getTime())) throw new RangeError(`Invalid time zone: ${tz}`);
  return zoned;
}

/** 00:00 of the calendar day containing `date`, in time zone `tz`. */
export function startOfDayInTz(date: Date, tz: string): Date {
  return toPlainDate(startOfDay(inTz(date, tz)));
}

/** Last millisecond (23:59:59.999) of the calendar day containing `date`, in time zone `tz`. */
export function endOfDayInTz(date: Date, tz: string): Date {
  return toPlainDate(endOfDay(inTz(date, tz)));
}

/**
 * Adds calendar days in time zone `tz`, keeping the local wall-clock time.
 * Not the same as adding 24 hours: DST days last 23 or 25 hours (NFR-32).
 */
export function addDaysInTz(date: Date, amount: number, tz: string): Date {
  return toPlainDate(addDays(inTz(date, tz), amount));
}

/**
 * BR-04: a task is overdue when its due time has passed and it is not DONE.
 * All-day tasks become overdue at 00:00 of the next calendar day in the user's
 * time zone (NFR-32).
 */
export function isOverdue(
  dueAt: Date | null,
  dueAllDay: boolean,
  statusCategory: StatusCategory,
  now: Date,
  tz: string,
): boolean {
  if (dueAt === null || statusCategory === "DONE") return false;
  if (dueAllDay) {
    const nextDayStart = startOfDayInTz(addDaysInTz(dueAt, 1, tz), tz);
    return now.getTime() >= nextDayStart.getTime();
  }
  return now.getTime() > dueAt.getTime();
}

/**
 * "YYYY-MM-DD" → Date at 00:00 UTC, the representation Prisma uses for `@db.Date` columns
 * (plain dates without a time, NFR-30). Throws on malformed or impossible dates.
 */
export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null;
  if (!date || formatIsoDate(date) !== value) throw new RangeError(`Invalid ISO date: ${value}`);
  return date;
}

/** Inverse of parseIsoDate: a `@db.Date` value → "YYYY-MM-DD". */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ISO_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Wall-clock date ("YYYY-MM-DD") and optional time ("HH:mm") in time zone `tz` → UTC ISO
 * instant. Without a time it is 00:00 of that day, the storage rule for all-day due dates
 * (NFR-32). Used by the due-date picker.
 */
export function zonedToUtcIso(date: string, time: string | null, tz: string): string {
  const day = parseIsoDate(date);
  const match = time === null ? null : ISO_TIME.exec(time);
  if (time !== null && !match) throw new RangeError(`Invalid time: ${time}`);
  inTz(day, tz); // validates the zone
  const zoned = new TZDate(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    match ? Number(match[1]) : 0,
    match ? Number(match[2]) : 0,
    tz,
  );
  return new Date(zoned.getTime()).toISOString();
}

/** Inverse of zonedToUtcIso: a UTC ISO instant → its wall-clock date and time in `tz`. */
export function utcToZonedParts(iso: string, tz: string): { date: string; time: string } {
  const zoned = inTz(new Date(iso), tz);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`,
    time: `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`,
  };
}
