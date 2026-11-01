import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlBoundary } from "@/components/i18n/intl-boundary";
import { Button } from "@/components/ui/button";

// Landing placeholder. "TaskFlow" is the product name and is not translated.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">TaskFlow</h1>
      <Suspense fallback={<div className="h-20" />}>
        <IntlBoundary className="flex flex-col items-center gap-4">
          <HomeContent />
        </IntlBoundary>
      </Suspense>
    </main>
  );
}

async function HomeContent() {
  const t = await getTranslations();
  return (
    <>
      <p className="text-muted-foreground">{t("Common.tagline")}</p>
      <Button asChild className="h-11 px-4">
        <Link href="/today">{t("Home.openApp")}</Link>
      </Button>
    </>
  );
}
