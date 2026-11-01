"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PARAM = "task";

/**
 * TaskDialog state lives in the URL (?task=<id>) so every page opens the same dialog and a
 * reload keeps it open (docs/06 section 1.2).
 */
export function useTaskParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get(PARAM);

  const hrefWith = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set(PARAM, id);
      else params.delete(PARAM);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const open = useCallback(
    (id: string) => router.push(hrefWith(id), { scroll: false }),
    [router, hrefWith],
  );
  const close = useCallback(
    () => router.replace(hrefWith(null), { scroll: false }),
    [router, hrefWith],
  );
  const replace = useCallback(
    (id: string) => router.replace(hrefWith(id), { scroll: false }),
    [router, hrefWith],
  );

  return { taskId, open, replace, close };
}
