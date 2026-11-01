import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { HtmlLang } from "./html-lang";

type IntlBoundaryProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Provides the user's locale, time zone and messages to client components.
 * Reads the session through src/i18n/request.ts, so render it inside <Suspense> (ADR-12).
 * `lang` is set here because the root <html lang> cannot depend on the request.
 */
export async function IntlBoundary({ children, className }: IntlBoundaryProps) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider>
      <HtmlLang />
      <div lang={locale} className={className}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
