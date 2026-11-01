"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// US-02: rendered only when Google credentials are configured.
export function GoogleButton() {
  const t = useTranslations("Auth");
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 md:h-9"
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/today" })}
    >
      {t("continueWithGoogle")}
    </Button>
  );
}
