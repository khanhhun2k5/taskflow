/**
 * Fallback while the session and locale stream in (ADR-12). Mirrors the real shell's
 * sizes (sidebar w-16/w-60, header h-14, bottom bar) so nothing jumps.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1" aria-busy="true">
      <div className="hidden h-dvh w-16 shrink-0 border-r bg-sidebar md:block lg:w-60" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 shrink-0 border-b" />
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 h-14 border-t bg-background md:hidden" />
    </div>
  );
}
