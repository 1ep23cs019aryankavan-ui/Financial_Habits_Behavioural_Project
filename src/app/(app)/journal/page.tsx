import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getJournal } from "@/lib/queries";
import { journalQuerySchema } from "@/lib/validation";
import { JournalBrowser, type JournalRow } from "@/components/journal-browser";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/disclaimer";
import Link from "next/link";

export const metadata: Metadata = { title: "Decision journal" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  // Invalid query strings fall back to the unfiltered journal.
  const parsed = journalQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    category: first(raw.category),
    sort: first(raw.sort),
  });
  const query = parsed.success ? parsed.data : {};

  const entries = await getJournal(user.id, query);

  const rows: JournalRow[] = entries.map((d) => ({
    id: d.id,
    title: d.title,
    amount: d.amount,
    category: d.category,
    reason: d.reason,
    emotionalState: d.emotionalState,
    urgency: d.urgency,
    status: d.status as JournalRow["status"],
    createdAt: d.createdAt.toISOString(),
    coolingOffEndsAt: d.coolingOffEndsAt.toISOString(),
    ruleFlags: d.ruleFlags,
    notes: d.notes,
    resilienceShown: d.resilienceShown,
    reflection: d.reflection
      ? {
          stillNeeded: d.reflection.stillNeeded,
          affordable: d.reflection.affordable,
          planned: d.reflection.planned,
          affectsGoal: d.reflection.affectsGoal,
          finalDecision: d.reflection.finalDecision,
          reflection: d.reflection.reflection,
          createdAt: d.reflection.createdAt.toISOString(),
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="size-6 text-primary" aria-hidden />
            Decision journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every decision, the reason you gave, and what you actually did.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/decisions/new">Log a decision</Link>
        </Button>
      </header>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading journal…</p>}>
        <JournalBrowser initial={rows} />
      </Suspense>

      <Disclaimer />
    </div>
  );
}
