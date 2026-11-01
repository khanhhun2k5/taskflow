"use client";

import { useQuery } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/features/optimistic";
import { LIST_LIMIT, queryKeys, tempId } from "@/features/query-keys";
import { apiFetch, toQuery } from "@/lib/api-client";
import type { Page } from "@/lib/pagination";
import type { CreateLabelInput, LabelDTO } from "./schemas";

// TanStack Query hooks for labels (docs/05 section 2.8).

type LabelPage = Page<LabelDTO>;
const DRAFT_COLOR = "#64748B"; // Label.color default in schema.prisma

export function useLabels() {
  return useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: ({ signal }) =>
      apiFetch<LabelPage>(`/labels${toQuery({ limit: LIST_LIMIT })}`, { signal }),
  });
}

type CreateLabelVars = { id: string; input: CreateLabelInput };

/**
 * `handleError` lets the label picker deal with LABEL_EXISTS itself (BR-81) instead of
 * showing a toast.
 */
export function useCreateLabel(options: {
  onCreated: (label: LabelDTO) => void;
  handleError?: (error: unknown, input: CreateLabelInput) => boolean;
}) {
  const mutation = useOptimisticMutation({
    mutationFn: ({ input }: CreateLabelVars) =>
      apiFetch<LabelDTO>("/labels", { method: "POST", body: input }),
    affects: [queryKeys.labels.all],
    apply: (qc, { id, input }) =>
      qc.setQueryData<LabelPage>(queryKeys.labels.all, (page) =>
        page
          ? { ...page, items: [...page.items, { id, name: input.name, color: DRAFT_COLOR }] }
          : page,
      ),
    rollback: (qc, { id }) =>
      qc.setQueryData<LabelPage>(queryKeys.labels.all, (page) =>
        page ? { ...page, items: page.items.filter((label) => label.id !== id) } : page,
      ),
    onSuccess: (_qc, label) => options.onCreated(label),
    handleError: (error, { input }) => options.handleError?.(error, input) ?? false,
  });
  return {
    ...mutation,
    create: (input: CreateLabelInput) => mutation.mutate({ id: tempId(), input }),
  };
}
