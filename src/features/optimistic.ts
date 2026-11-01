"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useErrorToast } from "./use-error-toast";

type Snapshot = [QueryKey, unknown][];

/** Every optimistic mutation shares this key, so they can see each other in flight. */
export const OPTIMISTIC_KEY = ["optimistic"] as const;

type OptimisticOptions<TVars, TData> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Query prefixes this mutation touches: cancelled, snapshotted and invalidated. */
  affects: readonly QueryKey[];
  /** Extra prefixes to invalidate after the mutation settles (e.g. derived progress). */
  invalidate?: readonly QueryKey[];
  /** Edits the cache before the request is sent (docs/06 section 1, NFR-04). */
  apply: (qc: QueryClient, vars: TVars) => void;
  /**
   * Targeted undo (e.g. drop the temp row of a create). Without it the snapshot is restored,
   * but only when no other optimistic mutation is in flight, so theirs is not wiped.
   */
  rollback?: (qc: QueryClient, vars: TVars) => void;
  onSuccess?: (qc: QueryClient, data: TData, vars: TVars) => void;
  /** Return true when the caller handles the error itself (no toast). */
  handleError?: (error: unknown, vars: TVars) => boolean;
};

// Invalidations wait until the last overlapping mutation settles: refetching earlier
// would overwrite the optimistic state of mutations still in flight.
const pendingInvalidations = new WeakMap<QueryClient, QueryKey[]>();

/** In onError/onSettled the current mutation is still pending, so "alone" means 1. */
const isLastInFlight = (qc: QueryClient) => qc.isMutating({ mutationKey: OPTIMISTIC_KEY }) <= 1;

function invalidateWhenIdle(qc: QueryClient, keys: readonly QueryKey[]) {
  const queued = [...(pendingInvalidations.get(qc) ?? []), ...keys];
  if (!isLastInFlight(qc)) {
    pendingInvalidations.set(qc, queued);
    return Promise.resolve();
  }
  pendingInvalidations.delete(qc);
  return Promise.all(queued.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/**
 * Optimistic update with rollback (NFR-51): apply → request → on error undo and show a
 * toast with "Retry" (transient errors only) → refetch once nothing else is in flight.
 */
export function useOptimisticMutation<TVars, TData>(options: OptimisticOptions<TVars, TData>) {
  const qc = useQueryClient();
  const showError = useErrorToast();
  const { affects, invalidate = [] } = options;

  const mutation = useMutation<TData, unknown, TVars, { snapshot: Snapshot }>({
    mutationKey: OPTIMISTIC_KEY,
    mutationFn: options.mutationFn,
    onMutate: async (vars) => {
      await Promise.all(affects.map((queryKey) => qc.cancelQueries({ queryKey })));
      const snapshot = affects.flatMap((queryKey) => qc.getQueriesData({ queryKey }));
      options.apply(qc, vars);
      return { snapshot };
    },
    onError: (error, vars, context) => {
      if (options.rollback) options.rollback(qc, vars);
      else if (isLastInFlight(qc)) {
        context?.snapshot.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data));
      }
      // Otherwise the refetch after the last mutation settles shows the server's truth.
      if (options.handleError?.(error, vars)) return;
      showError(error, () => mutation.mutate(vars));
    },
    onSuccess: (data, vars) => options.onSuccess?.(qc, data, vars),
    onSettled: () => invalidateWhenIdle(qc, [...affects, ...invalidate]),
  });
  return mutation;
}
