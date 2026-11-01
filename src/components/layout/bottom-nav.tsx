"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { bottomNav, isActive } from "./nav-items";

// NFR-24: every target is at least 44×44 px.
const itemClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** docs/06 section 2: phone navigation (< 768px) with four items. */
export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("Nav.label")}
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {bottomNav.map(({ key, icon: Icon, href }) => (
          <li key={key} className="flex flex-1">
            {href ? (
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  itemClass,
                  "text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(`Nav.${key}`)}
              </Link>
            ) : (
              <span className={cn(itemClass, "cursor-not-allowed text-muted-foreground")}>
                <Icon className="size-5" aria-hidden />
                {t(`Nav.${key}`)}
                <span className="sr-only">{` (${t("Common.comingSoon")})`}</span>
              </span>
            )}
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            disabled
            title={t("Common.comingSoon")}
            className={cn(itemClass, "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <Plus className="size-5" aria-hidden />
            {t("Nav.add")}
            <span className="sr-only">{` (${t("Common.comingSoon")})`}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
