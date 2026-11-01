"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = { hasMore: boolean; loading: boolean; onLoad: () => void };

/** Infinite scroll for page-scrolled lists: loads when the end is near; the button is the keyboard path. */
export function LoadMore({ hasMore, loading, onLoad }: Props) {
  const t = useTranslations("List");
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onLoad(),
      {
        rootMargin: "300px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoad]);

  if (!hasMore) return null;
  return (
    <div ref={sentinel} className="flex justify-center">
      <Button variant="outline" className="h-11" disabled={loading} onClick={onLoad}>
        {loading ? t("loadingMore") : t("loadMore")}
      </Button>
    </div>
  );
}
