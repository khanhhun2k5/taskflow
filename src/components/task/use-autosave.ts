"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateTask, type TaskUpdate } from "@/features/tasks/hooks";

export const AUTOSAVE_DELAY_MS = 500; // docs/06 section 4.3

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Debounces `save` by `delay` ms; `flush` saves now (blur, close). Pending value saved on unmount. */
export function useDebouncedSave<T>(save: (value: T) => void, delay = AUTOSAVE_DELAY_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next) saveRef.current(next.value);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => flush, [flush]);
  return { schedule, flush };
}

/**
 * PATCH /tasks/:id with optimistic cache + the "Saved" indicator of TaskDialog. Overlapping
 * saves are counted, so the indicator only says "Saved" when every one of them succeeded.
 * `revision` changes after a failed save: fields keyed by it re-read the rolled-back task.
 */
export function useTaskSaver(taskId: string) {
  const { mutateAsync } = useUpdateTask();
  const [state, setState] = useState<SaveState>("idle");
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(0);
  const failed = useRef(false);

  const save = useCallback(
    (input: TaskUpdate["input"], optimistic: TaskUpdate["optimistic"]) => {
      inFlight.current += 1;
      setState("saving");
      mutateAsync({ id: taskId, input, optimistic })
        .catch(() => {
          failed.current = true;
        })
        .finally(() => {
          inFlight.current -= 1;
          if (inFlight.current > 0) return;
          // By now onSettled has rolled back or refetched the cache (it is awaited).
          setState(failed.current ? "error" : "saved");
          if (failed.current) setRevision((value) => value + 1);
          failed.current = false;
        });
    },
    [mutateAsync, taskId],
  );
  return { state, save, revision };
}

export type SaveTask = ReturnType<typeof useTaskSaver>["save"];
