import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { TodayEmpty } from "@/components/today/today-empty";

// US-34 arrives in MVP-2; P0 only shows the empty state (docs/06 section 6).
export default async function TodayPage() {
  await connection(); // the date below must be computed per request
  const t = await getTranslations("Today");
  const format = await getFormatter();
  const now = await getNow();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {/* Formatted in User.timezone and User.locale (src/i18n/request.ts). */}
        <p className="text-muted-foreground first-letter:uppercase">
          {format.dateTime(now, {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>
      </div>
      <TodayEmpty />
    </div>
  );
}
