import { Skeleton } from "@/components/ui/skeleton";

/** Loading state (docs/06 section 6): same layout as the real page, no spinner. */
export function ListPageSkeleton({
  rows = 5,
  withInput = true,
}: {
  rows?: number;
  withInput?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withInput && <Skeleton className="h-11 w-full" />}
      <ListRowsSkeleton rows={rows} />
    </div>
  );
}

export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-12 w-full" />
        </li>
      ))}
    </ul>
  );
}
