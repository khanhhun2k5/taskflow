"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/** Keeps <html lang> in sync with the user's locale after hydration (screen readers, spell check). */
export function HtmlLang() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
