import { connection } from "next/server";
import { getEnv, isGoogleEnabled } from "@/lib/env";
import { GoogleButton } from "./google-button";

// Evaluated per request (not at build) so the flag follows the runtime environment.
// Render inside <Suspense> (ADR-12).
export async function GoogleSignIn() {
  await connection();
  if (!isGoogleEnabled(getEnv())) return null;
  return <GoogleButton />;
}
