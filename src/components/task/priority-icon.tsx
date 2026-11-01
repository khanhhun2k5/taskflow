import { ChevronDown, ChevronsUp, ChevronUp, Equal, type LucideIcon } from "lucide-react";
import type { PriorityInput } from "@/features/tasks/schemas";

// docs/06 section 7: Urgent red, High orange, Medium blue, Low gray; always with an icon
// so color is never the only cue (NFR-23).
const PRIORITY: Record<PriorityInput, { icon: LucideIcon; className: string }> = {
  URGENT: { icon: ChevronsUp, className: "text-red-600 dark:text-red-400" },
  HIGH: { icon: ChevronUp, className: "text-orange-600 dark:text-orange-400" },
  MEDIUM: { icon: Equal, className: "text-blue-600 dark:text-blue-400" },
  LOW: { icon: ChevronDown, className: "text-muted-foreground" },
};

export function PriorityIcon({ priority }: { priority: PriorityInput }) {
  const { icon: Icon, className } = PRIORITY[priority];
  return <Icon aria-hidden className={`size-4 shrink-0 ${className}`} />;
}
