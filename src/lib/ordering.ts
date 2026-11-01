import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

// ADR-05: order keys are strings compared byte-wise (COLLATE "C" in the DB, `<` in JS).
// The `digits` argument is never passed, so keys use the classic ASCII form ("a0", "a0V").

/** Throws when `before` does not sort strictly before `after` (v4 would silently swap them). */
function assertOrdered(before: string | null, after: string | null): void {
  if (before !== null && after !== null && !(before < after)) {
    throw new RangeError(`Order keys out of order: "${before}" must be < "${after}"`);
  }
}

/**
 * Key that sorts strictly between `before` and `after`.
 * `null` means "start of the list" / "end of the list".
 */
export function keyBetween(before: string | null, after: string | null): string {
  assertOrdered(before, after);
  return generateKeyBetween(before, after);
}

/** `n` ascending keys placed after `after` (or at the start of an empty list). */
export function keysForAppend(n: number, after: string | null = null): string[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`n must be a non-negative integer, got ${n}`);
  }
  return generateNKeysBetween(after, null, n);
}

/**
 * Key for a new item inserted at `index` of a list whose keys are `keys` (ascending).
 * Normally only the new key is returned (BR-13: one row changes). If the two neighbours
 * have equal keys (possible after concurrent writes; ties are broken by id), no key fits
 * between them, so the whole list is re-keyed: `rekeyed` holds the new keys of the existing
 * items, in the same order.
 */
export function keyAtIndex(
  keys: string[],
  index: number,
): { key: string; rekeyed: string[] | null } {
  if (!Number.isInteger(index) || index < 0 || index > keys.length) {
    throw new RangeError(`index ${index} is outside 0..${keys.length}`);
  }
  const lower = keys[index - 1] ?? null;
  const upper = keys[index] ?? null;
  if (lower === null || upper === null || lower < upper) {
    return { key: keyBetween(lower, upper), rekeyed: null };
  }
  const fresh = keysForAppend(keys.length + 1);
  return { key: fresh[index], rekeyed: [...fresh.slice(0, index), ...fresh.slice(index + 1)] };
}
