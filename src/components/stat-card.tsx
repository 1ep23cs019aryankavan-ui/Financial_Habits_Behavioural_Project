import { cn, formatCurrency } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success" | "danger" | "info";
}) {
  const toneClass = {
    default: "text-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-rose-600 dark:text-rose-400",
    info: "text-sky-600 dark:text-sky-400",
  }[tone];

  const iconClass = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("tabular mt-1.5 text-2xl font-semibold", toneClass)}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="size-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function MoneyStat({
  label,
  amount,
  hint,
  tone = "default",
}: {
  label: string;
  amount: number;
  hint?: string;
  tone?: "default" | "info";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 text-2xl font-semibold",
          tone === "info" ? "text-sky-600 dark:text-sky-400" : "text-foreground",
        )}
      >
        {formatCurrency(amount)}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
