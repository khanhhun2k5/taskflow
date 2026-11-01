// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isComposing,
  isTypingTarget,
  readSequence,
  SEQUENCE_TIMEOUT_MS,
  shortcutName,
  type KeyLike,
} from "./shortcuts";

const key = (overrides: Partial<KeyLike>): KeyLike => ({
  key: "n",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  keyCode: 78,
  target: null,
  ...overrides,
});

describe("shortcutName (docs/06 section 5)", () => {
  it("names letters, Shift+letter and ?", () => {
    expect(shortcutName(key({ key: "n" }))).toBe("n");
    expect(shortcutName(key({ key: "N" }))).toBe("n");
    expect(shortcutName(key({ key: "D", shiftKey: true }))).toBe("Shift+D");
    expect(shortcutName(key({ key: "?", shiftKey: true }))).toBe("?");
    expect(shortcutName(key({ key: "1" }))).toBe("1");
  });

  it("ignores modifier chords, named keys and shifted symbols", () => {
    expect(shortcutName(key({ key: "k", metaKey: true }))).toBeNull();
    expect(shortcutName(key({ key: "k", ctrlKey: true }))).toBeNull();
    expect(shortcutName(key({ key: "n", altKey: true }))).toBeNull();
    expect(shortcutName(key({ key: "Enter" }))).toBeNull();
    expect(shortcutName(key({ key: "!", shiftKey: true }))).toBeNull();
  });

  it("ignores IME composition (Vietnamese input methods)", () => {
    expect(shortcutName(key({ isComposing: true }))).toBeNull();
    expect(shortcutName(key({ keyCode: 229 }))).toBeNull();
    expect(isComposing({ isComposing: false, keyCode: 65 })).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields, selects, contenteditable and ARIA text widgets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    // jsdom does not compute isContentEditable; emulate the browser.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    const combo = document.createElement("button");
    combo.setAttribute("role", "combobox");
    expect(isTypingTarget(combo)).toBe(true);
  });

  it("is false elsewhere", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("blocks shortcuts while focus is in a field", () => {
    expect(shortcutName(key({ target: document.createElement("input") }))).toBeNull();
  });
});

describe("readSequence (g then i)", () => {
  const prefixes = new Set(["g"]);
  const idle = { prefix: null, at: 0 };

  it("combines the second key within the timeout", () => {
    const first = readSequence(idle, "g", 1000, prefixes);
    expect(first.name).toBeNull();
    expect(readSequence(first.state, "i", 1500, prefixes).name).toBe("g i");
  });

  it("drops a stale prefix", () => {
    const first = readSequence(idle, "g", 1000, prefixes);
    const late = readSequence(first.state, "i", 1000 + SEQUENCE_TIMEOUT_MS + 1, prefixes);
    expect(late.name).toBe("i");
  });

  it("passes single keys through", () => {
    expect(readSequence(idle, "n", 0, prefixes)).toEqual({ name: "n", state: idle });
  });
});
