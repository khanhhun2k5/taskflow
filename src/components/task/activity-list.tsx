"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ActivityDTO } from "@/features/tasks/schemas";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
type Status = (typeof STATUSES)[number];
/** STATUS_CHANGED stores { statusCategory } in fromValue/toValue (services/status.ts). */
function statusOf(value: unknown): Status | null {
  if (typeof value !== "object" || value === null || !("statusCategory" in value)) return null;
  const status = value.statusCategory;
  return typeof status === "string" && (STATUSES as readonly string[]).includes(status)
    ? (status as Status)
    : null;
}

function StatusChange({ entry }: { entry: ActivityDTO }) {
  const t = useTranslations("Status");
  const [from, to] = [statusOf(entry.fromValue), statusOf(entry.toValue)];
  if (entry.type !== "STATUS_CHANGED" || !from || !to) return null;
  return (
    <span>
      {t(from)} → {t(to)}
    </span>
  );
}

/** The 20 latest ActivityLog entries (GET /tasks/:id, BR-95), newest first. */
export function ActivityList({ activity }: { activity: ActivityDTO[] }) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <section aria-labelledby="task-activity" className="flex flex-col gap-2">
      <h3 id="task-activity" className="text-sm font-medium">
        {t("TaskDialog.activity")}
      </h3>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("TaskDialog.activityEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {activity.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="text-foreground">{t(`Activity.${entry.type}`)}</span>
              <StatusChange entry={entry} />
              <time dateTime={entry.at}>
                {format.dateTime(new Date(entry.at), {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
