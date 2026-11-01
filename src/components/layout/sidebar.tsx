"use client";

import { CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { NavEntry } from "./nav-entry";
import { primaryNav, secondaryNav } from "./nav-items";
import { NavSection } from "./nav-section";

/**
 * docs/06 section 2: hidden on phones, icon rail on tablets (768–1023px),
 * full sidebar from 1024px. Pure CSS breakpoints, no JS measurement.
 */
export function Sidebar() {
  const t = useTranslations();

  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex lg:w-60">
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 font-semibold">
        <CheckSquare className="size-5 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t("Common.appName")}</span>
      </div>
      <nav
        aria-label={t("Nav.label")}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4"
      >
        <ul className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <li key={item.key}>
              <NavEntry item={item} />
            </li>
          ))}
        </ul>
        <Separator />
        <NavSection
          id="nav-courses"
          title={t("Nav.courses")}
          emptyText={t("Nav.coursesEmpty")}
          addLabel={t("Nav.addCourse")}
        />
        <NavSection
          id="nav-projects"
          title={t("Nav.projects")}
          emptyText={t("Nav.projectsEmpty")}
          addLabel={t("Nav.addProject")}
        />
        <ul className="mt-auto flex flex-col gap-1">
          {secondaryNav.map((item) => (
            <li key={item.key}>
              <NavEntry item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
