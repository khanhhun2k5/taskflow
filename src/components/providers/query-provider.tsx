"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api-client";

function makeQueryClient(onSignedOut: () => void) {
  // An expired session on any request sends the user back to /login (ADR-11).
  const redirectWhenSignedOut = (error: unknown) => {
    if (isApiError(error) && error.code === "UNAUTHENTICATED") onSignedOut();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: redirectWhenSignedOut }),
    mutationCache: new MutationCache({ onError: redirectWhenSignedOut }),
    defaultOptions: {
      queries: {
        staleTime: 30_000, // server-prefetched data is not refetched right after hydration
        refetchOnWindowFocus: true, // NFR-52: last write wins, other tabs refresh on focus
        retry: (failureCount, error) =>
          failureCount < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
      },
    },
  });
}

/** TanStack Query for the (app) group (ADR-06). One client per browser tab. Toasts: LocalizedToaster. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => makeQueryClient(() => router.replace("/login")));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
