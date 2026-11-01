import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";

const messages = { vi, en };

/** A QueryClient for tests: no retries, nothing refetched behind the test's back. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

type Options = RenderOptions & { locale?: "vi" | "en"; queryClient?: QueryClient };

/** Renders a component with the app's real messages and a QueryClient, like the (app) layout. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "vi", queryClient = createTestQueryClient(), ...options }: Options = {},
) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
        <TooltipProvider>{ui}</TooltipProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
    options,
  );
  return { ...result, queryClient };
}
