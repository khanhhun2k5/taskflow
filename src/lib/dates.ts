import { TZDate } from "@date-fns/tz";
import { addDays, endOfDay, startOfDay } from "date-fns";

// Time zone helpers (docs/08-non-functional.md section 4).
// Instants are stored in UTC; "today", "end of day" etc. are computed in the user's
// IANA time zone. Never compare dates as strings (NFR-33) and never call `new Date()`
// without arguments here: callers pass `now` (NFR-34).

/** Mirrors `Task.statusCategory`; replaced by the Prisma enum once `Task` exists (MVP-1). */
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
