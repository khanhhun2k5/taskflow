// Keyboard shortcuts (docs/06 section 5). Pure helpers; the provider lives in
// src/components/shortcuts. Letter shortcuts never fire while the user is typing.

export type KeyLike = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  keyCode?: number;
  target: EventTarget | null;
};

const TYPING_ROLES = new Set(["textbox", "combobox", "searchbox", "spinbutton"]);

/** Focus in a text field, select, contenteditable or ARIA text widget. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const role = target.getAttribute("role");
  return role !== null && TYPING_ROLES.has(role);
}

/** IME composition (Vietnamese Telex/VNI input methods): keyCode 229 or isComposing. */
export function isComposing(event: Pick<KeyLike, "isComposing" | "keyCode">): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** Normalized name ("n", "?", "Shift+D") or null when the event must be ignored. */
export function shortcutName(event: KeyLike): string | null {
  if (isComposing(event) || isTypingTarget(event.target)) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key === "?") return "?";
  if (event.key.length !== 1) return null;
  if (event.shiftKey) return /[a-z]/i.test(event.key) ? `Shift+${event.key.toUpperCase()}` : null;
  return event.key.toLowerCase();
}

export const SEQUENCE_TIMEOUT_MS = 1000;

/**
 * Two-key sequences such as "g" then "i". Returns the combined name ("g i") when the second
 * key follows the first within SEQUENCE_TIMEOUT_MS; `state` carries the pending first key.
 */
export function readSequence(
  state: { prefix: string | null; at: number },
  name: string,
  now: number,
  prefixes: ReadonlySet<string>,
): { name: string | null; state: { prefix: string | null; at: number } } {
  if (state.prefix !== null && now - state.at <= SEQUENCE_TIMEOUT_MS) {
    return { name: `${state.prefix} ${name}`, state: { prefix: null, at: 0 } };
  }
  if (prefixes.has(name)) return { name: null, state: { prefix: name, at: now } };
  return { name, state: { prefix: null, at: 0 } };
}
