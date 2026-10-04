"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Live cooling-off countdown.
 *
 * The first render (server and client alike) shows a placeholder rather than a
 * number: computing the remaining time during render would differ by
 * milliseconds between the two and trip a hydration mismatch. The real value
 * appears immediately after mount.
 */
export function Countdown({
  endsAt,
  compact = false,
}: {
  endsAt: string | Date;
  compact?: boolean;
}) {
  const target = useMemo(
    () => (endsAt instanceof Date ? endsAt : new Date(endsAt)),
    [endsAt],
  );

  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    };

    // Deferred rather than called inline: a synchronous setState in the effect
    // body triggers a cascading render.
    const initial = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [target]);

  if (remaining === null) {
    return (
      <span className={cn("tabular", compact ? "text-sm" : "text-2xl")}>--:--:--</span>
    );
  }

  if (remaining === 0) {
    return (
      <span
        className={cn(
          "tabular font-semibold text-emerald-600",
          compact ? "text-sm" : "text-2xl",
        )}
      >
        Cooling-off complete
      </span>
    );
  }

  if (compact) {
    return <span className="tabular text-sm">{formatDuration(remaining)}</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="tabular flex items-end gap-2 sm:gap-3">
      {[
        { value: days, label: "days" },
        { value: hours, label: "hrs" },
        { value: minutes, label: "min" },
        { value: seconds, label: "sec" },
      ].map((unit, i) => (
        <div key={unit.label} className="flex flex-col items-center">
          <div className="flex items-baseline">
            {i > 0 && (
              <span className="mr-2 text-xl text-muted-foreground sm:text-2xl">:</span>
            )}
            <span className="text-3xl font-semibold sm:text-4xl">{pad(unit.value)}</span>
          </div>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
