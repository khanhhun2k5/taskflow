import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Separator } from "@/components/ui/separator";
import { getEnv, isGoogleEnabled } from "@/lib/env";
import { GoogleButton } from "./google-button";

// Evaluated per request (not at build) so the flag follows the runtime environment.
// Render inside <Suspense> (ADR-12). The "or" divider hides together with the button (US-02).
export async function GoogleSignIn() {
  await connection();
  if (!isGoogleEnabled(getEnv())) return null;
  const t = await getTranslations("Auth");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <Separator className="flex-1" />
        {t("or")}
        <Separator className="flex-1" />
      </div>
      <GoogleButton />
    </div>
  );
}
