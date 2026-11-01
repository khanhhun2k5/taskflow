import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { IntlBoundary } from "@/components/i18n/intl-boundary";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentSession } from "@/server/session";

// Full session check (ADR-11): expired or forged cookies are sent back to /login.
// Renders the app shell (docs/06 section 2) in the user's locale.
export async function SessionGate({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <IntlBoundary className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={{ name: session.user.name, email: session.user.email }} />
        <main className="flex flex-1 flex-col pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </IntlBoundary>
  );
}
