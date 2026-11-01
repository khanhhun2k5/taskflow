"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActive, type NavItem } from "./nav-items";

const base =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm md:justify-center lg:justify-start";

/** Sidebar entry: icon-only on tablets (label in a tooltip), icon + label from 1024px. */
export function NavEntry({ item }: { item: NavItem }) {
  const t = useTranslations();
  const pathname = usePathname();
  const label = t(`Nav.${item.key}`);
  const Icon = item.icon;

  const content = item.href ? (
    <Link
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className={cn(
        base,
        "outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </Link>
  ) : (
    <span className={cn(base, "cursor-not-allowed text-muted-foreground")}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only lg:not-sr-only">{label}</span>
      <span className="sr-only">{` (${t("Common.comingSoon")})`}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {item.href ? label : `${label} · ${t("Common.comingSoon")}`}
      </TooltipContent>
    </Tooltip>
  );
}
