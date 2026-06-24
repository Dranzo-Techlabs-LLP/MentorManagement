import { Badge } from "./primitives";
import { titleCase } from "@/lib/utils";

const TONE: Record<string, "green" | "blue" | "gold" | "red" | "slate" | "purple" | "teal"> = {
  // generic
  ACTIVE: "green",
  COMPLETED: "green",
  APPROVED: "green",
  DONE: "green",
  REVIEWED: "green",
  PUBLISHED: "green",
  PRESENT: "green",
  PENDING: "gold",
  IN_PROGRESS: "gold",
  ASSIGNED: "blue",
  SCHEDULED: "blue",
  DRAFT: "slate",
  NOT_STARTED: "slate",
  INACTIVE: "slate",
  ABSENT: "red",
  MISSED: "red",
  REJECTED: "red",
  CANCELLED: "red",
  NEW: "purple",
  LATE: "gold",
  EXCUSED: "teal",
  GRADUATED: "teal",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return <Badge tone={TONE[status] ?? "slate"}>{titleCase(status)}</Badge>;
}
