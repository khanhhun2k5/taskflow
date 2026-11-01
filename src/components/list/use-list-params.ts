"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { TaskListParams } from "@/features/query-keys";
import { parseListParams, writeListParams } from "@/features/tasks/list-params";

/** ListView filters and sort, kept in the URL so they survive a reload (docs/06 4.5). */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const params = useMemo(() => parseListParams(new URLSearchParams(query)), [query]);

  const setParams = useCallback(
    (next: TaskListParams) => {
      const written = writeListParams(query, next);
      router.replace(written ? `${pathname}?${written}` : pathname, { scroll: false });
    },
    [router, pathname, query],
  );
  return { params, setParams };
}
