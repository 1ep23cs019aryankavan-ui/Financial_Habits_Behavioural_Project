"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import {
  CATEGORIES,
  DECISION_STATUSES,
  STATUS_META,
  type DecisionStatus,
} from "@/lib/constants";
import { cn, formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

export type JournalRow = {
  id: string;
  title: string;
  amount: number;
  category: string;
  reason: string;
  emotionalState: string;
  urgency: string;
  status: DecisionStatus;
  createdAt: string;
  coolingOffEndsAt: string;
  ruleFlags: string;
  notes: string | null;
  resilienceShown: boolean;
  reflection: {
    stillNeeded: boolean;
    affordable: boolean;
    planned: boolean;
    affectsGoal: boolean;
    finalDecision: string;
    reflection: string | null;
    createdAt: string;
  } | null;
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
] as const;

export function JournalBrowser({ initial }: { initial: JournalRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "newest");

  const [entries, setEntries] = useState<JournalRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-run the query whenever a filter changes. Debounced on the text box.
  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    if (category !== "all") params.set("category", category);
    if (sort !== "newest") params.set("sort", sort);

    try {
      const res = await fetch(`/api/journal?${params.toString()}`);
      const data = (await res.json()) as { entries?: JournalRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load the journal.");
        return;
      }
      setEntries(data.entries ?? []);
      // Keep the URL shareable without adding a history entry per keystroke.
      router.replace(`/journal${params.toString() ? `?${params}` : ""}`, {
        scroll: false,
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [q, status, category, sort, router]);

  useEffect(() => {
    const timer = window.setTimeout(runQuery, 300);
    return () => window.clearTimeout(timer);
  }, [runQuery]);

  const hasFilters = Boolean(q.trim()) || status !== "all" || category !== "all";

  function reset() {
    setQ("");
    setStatus("all");
    setCategory("all");
    setSort("newest");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, reason, notes, reflections…"
            className="pl-9"
            aria-label="Search journal"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {DECISION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].indicator} {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-44" aria-label="Sort entries">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {loading
            ? "Loading…"
            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
          {hasFilters && !loading && " matching your filters"}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <SlidersHorizontal className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "No entries match these filters."
              : "Your journal is empty. Log a decision to start building the habit."}
          </p>
        </div>
      )}

      <ul className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
        {entries.map((entry) => {
          const flagged = (JSON.parse(entry.ruleFlags || "[]") as string[]).length > 0;

          return (
            <li key={entry.id}>
              <a
                href={`/decisions/${entry.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.title}</p>
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {formatCurrency(entry.amount)} · {entry.category} ·{" "}
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {flagged && (
                      <Badge variant="danger">
                        <span aria-hidden>🔴</span> Flagged
                      </Badge>
                    )}
                    {entry.resilienceShown && (
                      <Badge variant="success">
                        <span aria-hidden>🟢</span> Resilience
                      </Badge>
                    )}
                    <StatusBadge status={entry.status} />
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {entry.reason}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Feeling: {titleCase(entry.emotionalState)}</span>
                  <span>Urgency: {titleCase(entry.urgency)}</span>
                  {entry.reflection && (
                    <span>
                      Needed: {entry.reflection.stillNeeded ? "yes" : "no"} · Affordable:{" "}
                      {entry.reflection.affordable ? "yes" : "no"} · Planned:{" "}
                      {entry.reflection.planned ? "yes" : "no"}
                    </span>
                  )}
                </div>

                {entry.reflection?.reflection && (
                  <p className="mt-3 line-clamp-2 rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed">
                    {entry.reflection.reflection}
                  </p>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
