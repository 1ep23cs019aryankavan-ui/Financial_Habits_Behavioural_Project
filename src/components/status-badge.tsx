import { STATUS_META, type DecisionStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

const VARIANT_BY_STATUS = {
  COOLING_OFF: "warning",
  RECONSIDERED: "success",
  APPROVED: "info",
  CANCELLED: "secondary",
} as const;

export function StatusBadge({
  status,
  className,
}: {
  status: DecisionStatus;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.CANCELLED;

  return (
    <Badge variant={VARIANT_BY_STATUS[status] ?? "secondary"} className={className}>
      <span aria-hidden>{meta.indicator}</span>
      {meta.label}
    </Badge>
  );
}
