"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/features/projects/hooks";
import { isTempId } from "@/features/query-keys";
import { isActive } from "./nav-items";

const linkClass =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 md:justify-center lg:justify-start aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium";

/** "PROJECTS" group of the sidebar (docs/06 section 2): the user's active projects. */
export function ProjectNavList() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const projects = useProjects("ACTIVE");
  const items = (projects.data?.items ?? []).filter((project) => !isTempId(project.id));

  return (
    <section aria-labelledby="nav-projects-heading" className="flex flex-col gap-1">
      <h2
        id="nav-projects-heading"
        className="sr-only px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:not-sr-only"
      >
        <Link
          href="/projects"
          className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("projects")}
        </Link>
      </h2>
      {projects.isPending ? (
        <Skeleton className="mx-3 h-8" aria-hidden />
      ) : projects.isError ? (
        <Button
          variant="ghost"
          className="h-11 justify-start px-3 text-sm text-muted-foreground"
          onClick={() => void projects.refetch()}
        >
          <span className="sr-only lg:not-sr-only">{t("projectsLoadError")}</span>
        </Button>
      ) : items.length === 0 ? (
        <p className="hidden px-3 py-1 text-sm text-muted-foreground lg:block">
          {t("projectsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((project) => {
            const href = `/projects/${project.id}`;
            return (
              <li key={project.id}>
                <Link
                  href={href}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  className={linkClass}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="sr-only truncate lg:not-sr-only">{project.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/projects?new=1" className={cn(linkClass, "text-muted-foreground")}>
        <Plus aria-hidden className="size-4 shrink-0" />
        <span className="sr-only lg:not-sr-only">{t("addProject")}</span>
      </Link>
    </section>
  );
}
