import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PlusCircle,
  RefreshCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getCategoryBreakdown,
  getJournal,
  getOutcomeBreakdown,
  getStats,
  getTrend,
} from "@/lib/queries";
import type { DecisionStatus } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Countdown } from "@/components/countdown";
import { Disclaimer } from "@/components/disclaimer";
import {
  CategoryChart,
  OutcomeChart,
  TrendChart,
  type CategoryDatum,
  type OutcomeDatum,
  type TrendDatum,
} from "@/components/charts";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, categories, outcomes, trend, entries] = await Promise.all([
    getStats(user.id),
    getCategoryBreakdown(user.id),
    getOutcomeBreakdown(user.id),
    getTrend(user.id),
    getJournal(user.id, { sort: "newest" }),
  ]);

  const active = entries.filter((d) => d.status === "COOLING_OFF");
  const recent = entries.slice(0, 5);
  const loggedTotal = categories.reduce((sum, c) => sum + c.total, 0);

  const categoryData: CategoryDatum[] = categories.slice(0, 8).map((c) => ({
    category: c.category,
    total: Math.round(c.total),
    count: c.count,
  }));

  const outcomeData: OutcomeDatum[] = [
    { name: "Completed", value: outcomes.approved, key: "APPROVED" },
    { name: "Reconsidered", value: outcomes.reconsidered, key: "RECONSIDERED" },
    { name: "Cancelled", value: outcomes.cancelled, key: "CANCELLED" },
  ].filter((d) => d.value > 0);

  const trendData: TrendDatum[] = trend.map((t) => ({
    label: t.label,
    resilience: t.resilience,
    decided: t.decided,
  }));

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.activeCoolingOff > 0
              ? `${stats.activeCoolingOff} decision${stats.activeCoolingOff === 1 ? "" : "s"} currently cooling off.`
              : "No decisions are cooling off right now."}
          </p>
        </div>
        <Button asChild>
          <Link href="/decisions/new">
            <PlusCircle aria-hidden />
            Log a decision
          </Link>
        </Button>
      </header>

      {/* Stats */}
      <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active cooling-off"
          value={stats.activeCoolingOff}
          hint="Decisions currently locked"
          icon={Timer}
          tone="warning"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          hint="Went ahead after waiting"
          icon={CheckCircle2}
          tone="info"
        />
        <StatCard
          label="Reconsidered"
          value={stats.reconsidered}
          hint="Changed your mind"
          icon={RefreshCcw}
          tone="success"
        />
        <StatCard
          label="Impulse-risk flags"
          value={stats.highRiskFlags}
          hint="Decisions where a rule fired"
          icon={AlertTriangle}
          tone="danger"
        />
      </section>

      <section aria-label="Behavioural resilience" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Behavioural resilience"
          value={`${stats.resiliencePercentage}%`}
          hint={`${stats.reconsidered} of ${stats.totalLogged} resolved decisions`}
          icon={Sparkles}
          tone="success"
        />
        <StatCard
          label="Approval rate"
          value={`${stats.approvalPercentage}%`}
          hint="Proceeded after the wait"
          icon={CheckCircle2}
        />
        <MoneyStat
          label="Total logged"
          amount={loggedTotal}
          hint={`Across ${stats.totalDecisions} decision${stats.totalDecisions === 1 ? "" : "s"}`}
        />
      </section>

      {/* Active cooling-off */}
      <Card>
        <CardHeader>
          <CardTitle>Active cooling-off periods</CardTitle>
          <CardDescription>
            These cannot be approved until their timers reach zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing is cooling off.{" "}
              <Link href="/decisions/new" className="font-medium text-primary hover:underline">
                Log a decision
              </Link>{" "}
              to start one.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {active.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/decisions/${d.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="tabular mt-0.5 text-xs text-muted-foreground">
                        {formatCurrency(d.amount)} · {d.category}
                      </p>
                    </div>
                    <Countdown endsAt={d.coolingOffEndsAt.toISOString()} compact />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <section aria-label="Charts" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Decisions by category</CardTitle>
            <CardDescription>Total amount logged per category.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categoryData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reconsidered vs approved</CardTitle>
            <CardDescription>What you actually did after waiting.</CardDescription>
          </CardHeader>
          <CardContent>
            <OutcomeChart data={outcomeData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Behavioural trend</CardTitle>
            <CardDescription>
              Share of each week&apos;s resolved decisions that you reconsidered.
              Rising is good.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
          </CardContent>
        </Card>
      </section>

      {/* Recent journal */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent journal entries</CardTitle>
            <CardDescription>Your last five decisions.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/journal">
              View all
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Your journal is empty. Log your first decision to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/decisions/${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="tabular mt-0.5 text-xs text-muted-foreground">
                        {formatCurrency(d.amount)} · {d.category} ·{" "}
                        {formatDate(d.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(JSON.parse(d.ruleFlags || "[]") as string[]).length > 0 && (
                        <Badge variant="danger">
                          <span aria-hidden>🔴</span> Flagged
                        </Badge>
                      )}
                      <StatusBadge status={d.status as DecisionStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Disclaimer />
    </div>
  );
}
