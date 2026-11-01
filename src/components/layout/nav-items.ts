import {
  CalendarDays,
  FolderKanban,
  Inbox,
  type LucideIcon,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";

// docs/06 section 2. Items without `href` belong to later phases (docs/10) and are
// shown disabled until their page exists.
export type NavKey = "today" | "inbox" | "calendar" | "trash" | "settings" | "projectsAndCourses";

export type NavItem = {
  key: NavKey;
  icon: LucideIcon;
  href?: string;
};

export const primaryNav: NavItem[] = [
  { key: "today", icon: Sun, href: "/today" },
  { key: "inbox", icon: Inbox },
  { key: "calendar", icon: CalendarDays },
];

export const secondaryNav: NavItem[] = [
  { key: "trash", icon: Trash2 },
  { key: "settings", icon: Settings },
];

/** Phone bottom bar: Today, Calendar, Projects & Courses (+ the Add button). */
export const bottomNav: NavItem[] = [
  { key: "today", icon: Sun, href: "/today" },
  { key: "calendar", icon: CalendarDays },
  { key: "projectsAndCourses", icon: FolderKanban },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
