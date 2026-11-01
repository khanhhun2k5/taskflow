"use client";

import { useMutationState } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { OPTIMISTIC_KEY } from "@/features/optimistic";
import { TASK_UPDATE_KEY, useUpdateTask, type TaskUpdate } from "@/features/tasks/hooks";

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

type SaveRecord = {
  status: "idle" | "pending" | "success" | "error";
  fields: string[];
  submittedAt: number;
};

/**
 * Indicator state from the task's PATCH mutations since the dialog opened. Read from the
 * mutation cache, so a "Retry" from the error toast (a new mutation) counts too. A failed
 * save stays "error" until a later successful save covers the same fields.
 */
export function saveStateOf(records: SaveRecord[]): SaveState {
  if (records.length === 0) return "idle";
  if (records.some((record) => record.status === "pending")) return "saving";
  const unsaved = records.some(
    (failed, index) =>
      failed.status === "error" &&
      !records
        .slice(index + 1)
        .some(
          (later) =>
            later.status === "success" && failed.fields.every((f) => later.fields.includes(f)),
        ),
  );
  return unsaved ? "error" : "saved";
}

/**
 * PATCH /tasks/:id with optimistic cache + the "Saved" indicator of TaskDialog.
 * `revision` changes after each failed save: fields keyed by it re-read the rolled-back
 * task (the error status is set after the rollback/refetch has finished).
 */
export function useTaskSaver(taskId: string) {
  const { mutate } = useUpdateTask();
  const [openedAt] = useState(() => Date.now());
  const records = useMutationState({
    filters: {
      mutationKey: [...OPTIMISTIC_KEY, ...TASK_UPDATE_KEY],
      predicate: (mutation) =>
        (mutation.state.variables as TaskUpdate | undefined)?.id === taskId &&
        mutation.state.submittedAt >= openedAt,
    },
    select: (mutation): SaveRecord => ({
      status: mutation.state.status,
      fields: Object.keys((mutation.state.variables as TaskUpdate | undefined)?.input ?? {}),
      submittedAt: mutation.state.submittedAt,
    }),
  });
  const ordered = [...records].sort((a, b) => a.submittedAt - b.submittedAt);
  const lastError = ordered.filter((record) => record.status === "error").at(-1);

  const save = useCallback(
    (input: TaskUpdate["input"], optimistic: TaskUpdate["optimistic"]) =>
      mutate({ id: taskId, input, optimistic }),
    [mutate, taskId],
  );
  return { state: saveStateOf(ordered), save, revision: lastError?.submittedAt ?? 0 };
}

export type SaveTask = ReturnType<typeof useTaskSaver>["save"];
