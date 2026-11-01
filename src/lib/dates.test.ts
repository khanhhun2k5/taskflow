import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import {
  addDaysInTz,
  endOfDayInTz,
  formatIsoDate,
  isOverdue,
  parseIsoDate,
  startOfDayInTz,
  endOfZonedDayIso,
  utcToZonedParts,
  zonedToUtcIso,
} from "./dates";

const NEW_YORK = "America/New_York";

/** Wall-clock time in `tz` as a plain Date (month is 1-based for readability). */
function at(tz: string, y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(new TZDate(y, m - 1, d, h, min, tz).getTime());
}

// docs/09 section 2: date tests run in at least two time zones.
describe.each(["Asia/Ho_Chi_Minh", NEW_YORK])("isOverdue in %s", (tz) => {
  const allDayDue = at(tz, 2026, 11, 3); // stored as 00:00 local (NFR-32)

  it("TC-60 all-day due 03/11, now 03/11 23:59 local → not overdue", () => {
    expect(isOverdue(allDayDue, true, "TODO", at(tz, 2026, 11, 3, 23, 59), tz)).toBe(false);
  });

  it("TC-61 all-day due 03/11, now 04/11 00:00 local → overdue", () => {
    expect(isOverdue(allDayDue, true, "TODO", at(tz, 2026, 11, 4, 0, 0), tz)).toBe(true);
  });

  it("TC-62 due 03/11 14:00, now 14:01 → overdue", () => {
    const dueAt = at(tz, 2026, 11, 3, 14, 0);
    expect(isOverdue(dueAt, false, "IN_PROGRESS", at(tz, 2026, 11, 3, 14, 1), tz)).toBe(true);
    expect(isOverdue(dueAt, false, "IN_PROGRESS", dueAt, tz)).toBe(false);
  });

  it("TC-63 DONE task with a past due date → not overdue", () => {
    const now = at(tz, 2026, 11, 10);
    expect(isOverdue(at(tz, 2026, 11, 3, 14, 0), false, "DONE", now, tz)).toBe(false);
    expect(isOverdue(allDayDue, true, "DONE", now, tz)).toBe(false);
  });

  it("no due date → never overdue", () => {
    expect(isOverdue(null, false, "TODO", at(tz, 2030, 1, 1), tz)).toBe(false);
  });
});

describe("TC-64 DST days in America/New_York", () => {
  it("(a) all-day due 08/03/2026 (23h day), now 09/03 00:30 local → overdue", () => {
    const dueAt = at(NEW_YORK, 2026, 3, 8);
    const now = new Date("2026-03-09T04:30:00Z");
    expect(now.getTime()).toBe(at(NEW_YORK, 2026, 3, 9, 0, 30).getTime());
    expect(isOverdue(dueAt, true, "TODO", now, NEW_YORK)).toBe(true);
  });

  it("(b) all-day due 01/11/2026 (25h day), now 01/11 23:30 local → not overdue", () => {
    const dueAt = at(NEW_YORK, 2026, 11, 1);
    const now = new Date("2026-11-02T04:30:00Z");
    expect(now.getTime()).toBe(at(NEW_YORK, 2026, 11, 1, 23, 30).getTime());
    expect(isOverdue(dueAt, true, "TODO", now, NEW_YORK)).toBe(false);
  });
});

describe("day helpers", () => {
  it("startOfDayInTz uses the user's zone, not the server's", () => {
    // 2026-11-03T20:00Z is already 04/11 03:00 in Vietnam.
    const instant = new Date("2026-11-03T20:00:00Z");
    expect(startOfDayInTz(instant, "Asia/Ho_Chi_Minh").toISOString()).toBe(
      "2026-11-03T17:00:00.000Z",
    );
    expect(startOfDayInTz(instant, NEW_YORK).toISOString()).toBe("2026-11-03T05:00:00.000Z");
  });

  it("endOfDayInTz returns the last millisecond of the local day", () => {
    const instant = new Date("2026-11-03T20:00:00Z");
    expect(endOfDayInTz(instant, "Asia/Ho_Chi_Minh").toISOString()).toBe(
      "2026-11-04T16:59:59.999Z",
    );
  });

  it("addDaysInTz keeps wall-clock time across DST (not +24h)", () => {
    const start = at(NEW_YORK, 2026, 3, 8); // 05:00Z (EST)
    expect(addDaysInTz(start, 1, NEW_YORK).toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(addDaysInTz(at(NEW_YORK, 2026, 11, 1), 1, NEW_YORK).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
    expect(addDaysInTz(start, -1, NEW_YORK).toISOString()).toBe("2026-03-07T05:00:00.000Z");
  });

  it("throws on an unknown time zone instead of hiding overdue tasks", () => {
    const dueAt = new Date("2020-01-01T00:00:00Z");
    const now = new Date("2030-01-01T00:00:00Z");
    expect(() => isOverdue(dueAt, true, "TODO", now, "Mars/Base")).toThrow(RangeError);
    expect(() => startOfDayInTz(now, "Mars/Base")).toThrow(RangeError);
  });

  it("returns plain Date instances", () => {
    const result = startOfDayInTz(new Date("2026-11-03T20:00:00Z"), NEW_YORK);
    expect(result.constructor).toBe(Date);
  });
});

describe("plain ISO dates (@db.Date)", () => {
  it("round-trips YYYY-MM-DD through UTC midnight", () => {
    const date = parseIsoDate("2026-11-03");
    expect(date.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(formatIsoDate(date)).toBe("2026-11-03");
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("03/11/2026")).toThrow(RangeError);
  });
});

describe("zoned wall-clock ↔ UTC (due-date picker)", () => {
  it("stores an all-day due date as 00:00 in the user's zone (NFR-32)", () => {
    expect(zonedToUtcIso("2026-11-03", null, "Asia/Ho_Chi_Minh")).toBe("2026-11-02T17:00:00.000Z");
  });

  it("converts a time of day, including across a DST change", () => {
    expect(zonedToUtcIso("2026-11-03", "09:30", "Asia/Ho_Chi_Minh")).toBe(
      "2026-11-03T02:30:00.000Z",
    );
    expect(zonedToUtcIso("2026-03-08", "12:00", NEW_YORK)).toBe("2026-03-08T16:00:00.000Z");
    expect(zonedToUtcIso("2026-03-07", "12:00", NEW_YORK)).toBe("2026-03-07T17:00:00.000Z");
  });

  it("round-trips through utcToZonedParts", () => {
    const iso = zonedToUtcIso("2026-12-31", "23:45", "Asia/Ho_Chi_Minh");
    expect(utcToZonedParts(iso, "Asia/Ho_Chi_Minh")).toEqual({ date: "2026-12-31", time: "23:45" });
    expect(utcToZonedParts("2026-11-02T17:00:00.000Z", "UTC")).toEqual({
      date: "2026-11-02",
      time: "17:00",
    });
  });

  it("rejects bad times, dates and zones", () => {
    expect(() => zonedToUtcIso("2026-11-03", "24:00", "UTC")).toThrow(RangeError);
    expect(() => zonedToUtcIso("2026-02-30", null, "UTC")).toThrow(RangeError);
    expect(() => zonedToUtcIso("2026-11-03", null, "Mars/Base")).toThrow(RangeError);
    expect(() => utcToZonedParts("2026-11-03T00:00:00.000Z", "Mars/Base")).toThrow(RangeError);
  });
});

describe("endOfZonedDayIso (dueTo filter)", () => {
  it("is the last millisecond of the day in the user's zone", () => {
    expect(endOfZonedDayIso("2026-11-03", "Asia/Ho_Chi_Minh")).toBe("2026-11-03T16:59:59.999Z");
  });

  it("handles 23- and 25-hour DST days", () => {
    expect(endOfZonedDayIso("2026-03-08", NEW_YORK)).toBe("2026-03-09T03:59:59.999Z");
    expect(endOfZonedDayIso("2026-11-01", NEW_YORK)).toBe("2026-11-02T04:59:59.999Z");
  });
});
