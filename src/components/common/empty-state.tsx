import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  headingLevel?: "h2" | "h3";
};

/** docs/06 section 6 "Empty": small illustration + one sentence + an action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = "h2",
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <div
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Icon className="size-7" />
      </div>
      <Heading className="text-base font-medium">{title}</Heading>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </section>
  );
}
