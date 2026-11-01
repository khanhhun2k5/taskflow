import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { addDaysInTz, endOfDayInTz, isOverdue, startOfDayInTz } from "./dates";

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
