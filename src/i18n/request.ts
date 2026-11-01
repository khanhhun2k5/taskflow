import { getRequestConfig } from "next-intl/server";
import { getCurrentSession } from "@/server/session";
import { defaultTimeZone, resolveLocale } from "./locales";

// next-intl without i18n routing: no locale prefix in URLs. Language and time zone
// come from the signed-in user (User.locale, User.timezone); guests get the defaults.
// Reads request headers, so every caller must render inside <Suspense> (ADR-12).
export default getRequestConfig(async () => {
  const session = await getCurrentSession();
  const locale = resolveLocale(session?.user.locale);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    timeZone: session?.user.timezone ?? defaultTimeZone,
    messages,
  };
});
