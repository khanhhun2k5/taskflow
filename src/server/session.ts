import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/server/auth";

/**
 * Full session check for Server Components (ADR-11), memoized per request so the
 * (app) layout and the i18n config share one lookup.
 */
export const getCurrentSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
