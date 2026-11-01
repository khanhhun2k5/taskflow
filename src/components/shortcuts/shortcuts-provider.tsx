"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readSequence, shortcutName } from "@/lib/shortcuts";
import { ShortcutsDialog } from "./shortcuts-dialog";

/** What the current page lets the shortcuts do; ids come from the focused [data-task-id]. */
export type ShortcutHandlers = {
  open?: (taskId: string) => void;
  toggleSelect?: (taskId: string) => void;
  markDone?: (taskId: string) => void;
  setView?: (view: "kanban" | "list") => void;
};

type Registry = { register: (handlers: ShortcutHandlers) => () => void };

const ShortcutsContext = createContext<Registry | null>(null);
const PREFIXES = new Set(["g"]);

function focusedTaskId(): string | null {
  const active = document.activeElement;
  return active instanceof HTMLElement
    ? (active.closest("[data-task-id]")?.getAttribute("data-task-id") ?? null)
    : null;
}

const modalOpen = () =>
  document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  ) !== null;

/** docs/06 section 5 (⌘K arrives with search in MVP-2). Never fires while typing (lib/shortcuts). */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const layers = useRef<ShortcutHandlers[]>([]);
  const [registry] = useState<Registry>(() => ({
    register: (handlers) => {
      layers.current = [...layers.current, handlers];
      return () => {
        layers.current = layers.current.filter((layer) => layer !== handlers);
      };
    },
  }));

  useEffect(() => {
    let sequence = { prefix: null as string | null, at: 0 };
    const merged = (): ShortcutHandlers => Object.assign({}, ...layers.current);

    function onKeyDown(event: KeyboardEvent) {
      const key = shortcutName(event);
      if (key === null || event.defaultPrevented) return;
      if (modalOpen() && key !== "?") return;
      const read = readSequence(sequence, key, event.timeStamp, PREFIXES);
      sequence = read.state;
      if (read.name === null) return;
      const handlers = merged();
      const taskId = focusedTaskId();
      const run = (action: (() => void) | undefined) => {
        if (!action) return;
        event.preventDefault();
        action();
      };
      switch (read.name) {
        case "n":
          return run(() => document.querySelector<HTMLInputElement>("[data-quick-add]")?.focus());
        case "g i":
          return run(() => router.push("/inbox"));
        case "g t":
          return run(() => router.push("/today"));
        case "1":
          return run(handlers.setView && (() => handlers.setView?.("kanban")));
        case "2":
          return run(handlers.setView && (() => handlers.setView?.("list")));
        case "e":
          return run(taskId && handlers.open ? () => handlers.open?.(taskId) : undefined);
        case "x":
          return run(
            taskId && handlers.toggleSelect ? () => handlers.toggleSelect?.(taskId) : undefined,
          );
        case "Shift+D":
          return run(taskId && handlers.markDone ? () => handlers.markDone?.(taskId) : undefined);
        case "?":
          return run(() => setHelpOpen(true));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <ShortcutsContext.Provider value={registry}>
      {children}
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ShortcutsContext.Provider>
  );
}

/** Registers page handlers while mounted; always calls the latest version of each. */
export function useRegisterShortcuts(handlers: ShortcutHandlers) {
  const registry = useContext(ShortcutsContext);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  const keys = Object.keys(handlers).sort().join(",");
  useEffect(() => {
    if (!registry || !keys) return;
    const proxy: ShortcutHandlers = {};
    for (const key of keys.split(",") as (keyof ShortcutHandlers)[]) {
      proxy[key] = ((arg: never) =>
        (latest.current[key] as ((value: never) => void) | undefined)?.(arg)) as never;
    }
    return registry.register(proxy);
  }, [registry, keys]);
}
