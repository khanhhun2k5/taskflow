"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// US-02: rendered only when Google credentials are configured.
export function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/today" })}
    >
      Tiếp tục với Google
    </Button>
  );
}
