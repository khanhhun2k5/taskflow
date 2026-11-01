import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";

const messages = { vi, en };

/** Renders a component with the app's real messages, like the (app) layout does. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "vi", ...options }: RenderOptions & { locale?: "vi" | "en" } = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>,
    options,
  );
}
