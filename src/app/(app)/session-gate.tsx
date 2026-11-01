import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";

// Full session check (ADR-11): expired or forged cookies are sent back to /login.
export async function SessionGate({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return children;
}
