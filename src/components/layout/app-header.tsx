"use client";

import { CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu, type UserMenuProps } from "./user-menu";

/** Top bar of the (app) group: app name on phones, theme switch and account menu. */
export function AppHeader({ user }: { user: UserMenuProps }) {
  const t = useTranslations("Common");

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <span className="flex items-center gap-2 font-semibold md:hidden">
        <CheckSquare className="size-5" aria-hidden />
        {t("appName")}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
