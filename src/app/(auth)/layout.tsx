import { CheckSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlBoundary } from "@/components/i18n/intl-boundary";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Locale is resolved per request (src/i18n/request.ts), so the localized part streams
// in behind <Suspense> with a same-size skeleton (ADR-12).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <Suspense fallback={<AuthSkeleton />}>
        <IntlBoundary className="flex flex-1 flex-col">
          <div className="flex h-14 items-center justify-end px-4">
            <ThemeToggle />
          </div>
          <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pb-14">
            <AuthBrand />
            {children}
          </main>
        </IntlBoundary>
      </Suspense>
    </div>
  );
}

async function AuthBrand() {
  const t = await getTranslations("Common");
  return (
    <div className="flex items-center justify-center gap-2 text-lg font-semibold">
      <CheckSquare className="size-6" aria-hidden />
      {t("appName")}
    </div>
  );
}

function AuthSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="h-14" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pb-14">
        <div className="mx-auto h-7 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
