import { describe, expect, it } from "vitest";
import { keyAtIndex, keyBetween, keysForAppend } from "./ordering";

/** Byte-wise comparison, the same as COLLATE "C" in PostgreSQL (ADR-05). */
function isStrictlyAscending(keys: string[]): boolean {
  return keys.every((key, index) => index === 0 || keys[index - 1] < key);
}

describe("ordering (ADR-05)", () => {
  it("TC-24 inserting 100 times at the same position keeps keys ordered and unique", () => {
    const [first, last] = keysForAppend(2);
    const keys = [first, last];
    // Always insert right after `first`, i.e. at index 1.
    for (let i = 0; i < 100; i += 1) {
      keys.splice(1, 0, keyBetween(keys[0], keys[1]));
    }
    expect(keys).toHaveLength(102);
    expect(new Set(keys).size).toBe(102);
    expect(isStrictlyAscending(keys)).toBe(true);
  });

  it("keys sort with < the same way as with byte order", () => {
    const keys = keysForAppend(50);
    expect(isStrictlyAscending(keys)).toBe(true);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every((key) => /^[\x21-\x7e]+$/.test(key))).toBe(true); // ASCII only
  });

  it("keyBetween handles the start and end of a list", () => {
    const only = keyBetween(null, null);
    const before = keyBetween(null, only);
    const after = keyBetween(only, null);
    expect(isStrictlyAscending([before, only, after])).toBe(true);
  });

  it("keysForAppend continues after an existing key", () => {
    const [existing] = keysForAppend(1);
    const appended = keysForAppend(3, existing);
    expect(isStrictlyAscending([existing, ...appended])).toBe(true);
    expect(keysForAppend(0, existing)).toEqual([]);
  });

  it("rejects bounds in the wrong order or equal bounds", () => {
    const [a, b] = keysForAppend(2);
    expect(() => keyBetween(b, a)).toThrow(RangeError);
    expect(() => keyBetween(a, a)).toThrow(RangeError);
  });

  it("rejects an invalid count", () => {
    expect(() => keysForAppend(-1)).toThrow(RangeError);
    expect(() => keysForAppend(1.5)).toThrow(RangeError);
  });
});

describe("keyAtIndex", () => {
  it("inserts between neighbours without touching other keys (BR-13)", () => {
    const keys = keysForAppend(3);
    for (let index = 0; index <= keys.length; index += 1) {
      const { key, rekeyed } = keyAtIndex(keys, index);
      expect(rekeyed).toBeNull();
      const merged = [...keys.slice(0, index), key, ...keys.slice(index)];
      expect(isStrictlyAscending(merged)).toBe(true);
    }
    expect(keyAtIndex([], 0).rekeyed).toBeNull();
  });

  it("re-keys the list when the neighbours have equal keys", () => {
    const keys = ["a0", "a1", "a1", "a2"];
    const { key, rekeyed } = keyAtIndex(keys, 2);
    expect(rekeyed).toHaveLength(4);
    const merged = [...(rekeyed ?? []).slice(0, 2), key, ...(rekeyed ?? []).slice(2)];
    expect(isStrictlyAscending(merged)).toBe(true);
  });

  it("rejects an index outside the list", () => {
    expect(() => keyAtIndex(["a0"], 2)).toThrow(RangeError);
    expect(() => keyAtIndex(["a0"], -1)).toThrow(RangeError);
  });
});
