import { ShieldCheck } from "lucide-react";
import { DISCLAIMER } from "@/lib/constants";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <div
      className={
        "flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground " +
        (className ?? "")
      }
    >
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{DISCLAIMER}</p>
    </div>
  );
}
