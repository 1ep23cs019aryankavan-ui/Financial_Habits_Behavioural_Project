import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Timer } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { COOLING_PERIOD_MAP, type CoolingPeriodKey, type DecisionStatus } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Countdown } from "@/components/countdown";
import { ReflectionForm } from "@/components/reflection-form";
import { DeleteDecisionButton } from "@/components/delete-decision-button";
import { DecisionMeta } from "@/components/decision-meta";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Decision ${id.slice(0, 6)}` };
}

export default async function DecisionPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const decision = await prisma.decision.findFirst({
    where: { id, userId: user.id },
    include: { reflection: true },
  });

  if (!decision) notFound();

  const status = decision.status as DecisionStatus;
  const isCooling = status === "COOLING_OFF";
  const period = COOLING_PERIOD_MAP[decision.coolingOffPeriod as CoolingPeriodKey];
  const flaggedRules: string[] = JSON.parse(decision.ruleFlags || "[]");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {flaggedRules.length > 0 && (
              <Badge variant="danger">
                <span aria-hidden>🔴</span>
                {flaggedRules.length} rule{flaggedRules.length === 1 ? "" : "s"} flagged
              </Badge>
            )}
            {decision.resilienceShown && (
              <Badge variant="success">
                <span aria-hidden>🟢</span> Resilience shown
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
          <p className="tabular mt-1 text-lg text-muted-foreground">
            {formatCurrency(decision.amount)} · {decision.category}
          </p>
        </div>

        {isCooling && <DeleteDecisionButton decisionId={decision.id} />}
      </header>

      {/* Cooling-off timer / lock state */}
      <Card
        className={
          isCooling
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
        }
      >
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          {isCooling ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Timer className="size-4" aria-hidden />
                Cooling off · {period?.label ?? "custom"}
              </div>
              <Countdown endsAt={decision.coolingOffEndsAt.toISOString()} />
              <p className="max-w-md text-sm text-muted-foreground">
                Started {formatDateTime(decision.createdAt)} · ends{" "}
                {formatDateTime(decision.coolingOffEndsAt)}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Approval is locked until the timer reaches zero.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Cooling-off period complete
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                Reviewed {formatDateTime(decision.coolingOffEndsAt)}
                {decision.reflection &&
                  ` · reflection recorded ${formatDateTime(decision.reflection.createdAt)}`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          {isCooling ? (
            <ReflectionForm
              decisionId={decision.id}
              endsAt={decision.coolingOffEndsAt.toISOString()}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your reflection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {decision.reflection ? (
                  <>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Still needed</dt>
                        <dd className="font-medium">
                          {decision.reflection.stillNeeded ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Affordable</dt>
                        <dd className="font-medium">
                          {decision.reflection.affordable ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Was planned</dt>
                        <dd className="font-medium">
                          {decision.reflection.planned ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Affects a goal</dt>
                        <dd className="font-medium">
                          {decision.reflection.affectsGoal ? "Yes" : "No"}
                        </dd>
                      </div>
                    </dl>
                    {decision.reflection.reflection && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                        {decision.reflection.reflection}
                      </div>
                    )}
                    <Link
                      href="/journal"
                      className="inline-block text-sm font-medium text-primary hover:underline"
                    >
                      View in journal →
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No reflection recorded.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Original intent</CardTitle>
            </CardHeader>
            <CardContent>
              <DecisionMeta
                reason={decision.reason}
                emotionalState={decision.emotionalState}
                urgency={decision.urgency}
                essential={decision.essential}
                notes={decision.notes}
                flaggedRules={flaggedRules}
              />
            </CardContent>
          </Card>

          {isCooling && (
            <Card>
              <CardHeader>
                <CardTitle>While you wait</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>· Research alternatives or second-hand options.</p>
                <p>· Check whether this affects a goal you set.</p>
                <p>· Ask: would I still want this in a week?</p>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Logged {formatDateTime(decision.createdAt)} · emotional state{" "}
            {titleCase(decision.emotionalState)}
          </p>
        </aside>
      </div>
    </div>
  );
}
