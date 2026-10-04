"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Info, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIES,
  COOLING_PERIODS,
  EMOTIONAL_STATES,
  URGENCY_LEVELS,
  type Category,
  type CoolingPeriodKey,
  type EmotionalState,
  type Urgency,
} from "@/lib/constants";
import type { DecisionAdvice } from "@/lib/rules";
import { IMPULSE_RISK_META } from "@/lib/rules";
import { cn, formatCurrency, titleCase } from "@/lib/utils";

const SEVERITY_STYLE = {
  info: { badge: "secondary" as const, icon: Info, className: "text-muted-foreground" },
  warn: { badge: "warning" as const, icon: AlertTriangle, className: "text-amber-600" },
  high: { badge: "danger" as const, icon: AlertCircle, className: "text-rose-600" },
};

export function DecisionForm({
  defaultThreshold,
  defaultCoolingPeriod,
}: {
  defaultThreshold: number;
  defaultCoolingPeriod: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [reason, setReason] = useState("");
  const [emotionalState, setEmotionalState] = useState<EmotionalState>("calm");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [essential, setEssential] = useState(true);
  const [coolingOffPeriod, setCoolingOffPeriod] = useState<CoolingPeriodKey>(
    (defaultCoolingPeriod as CoolingPeriodKey) ?? "24h",
  );
  const [notes, setNotes] = useState("");

  const [advice, setAdvice] = useState<DecisionAdvice | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);

  const numericAmount = Number(amount);
  const canPreview = Number.isFinite(numericAmount) && numericAmount > 0;

  // Debounced live rule preview. Only meaningful once there is an amount, so
  // `advice` is derived away rather than cleared inside the effect.
  useEffect(() => {
    if (!canPreview) return;

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPreviewing(true);

      try {
        const res = await fetch("/api/decisions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: numericAmount,
            category,
            emotionalState,
            urgency,
            essential,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { advice: DecisionAdvice };
          setAdvice(data.advice);
        }
      } catch {
        // Aborted or offline — keep the previous advice rather than flashing.
      } finally {
        if (!controller.signal.aborted) setPreviewing(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [numericAmount, category, emotionalState, urgency, essential, canPreview]);

  const activeAdvice = canPreview ? advice : null;

  const applySuggestion = useCallback(() => {
    if (activeAdvice?.suggestedPeriod) setCoolingOffPeriod(activeAdvice.suggestedPeriod);
  }, [activeAdvice]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          category,
          reason,
          emotionalState,
          urgency,
          essential,
          coolingOffPeriod,
          notes,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
        decision?: { id: string };
      };

      if (!res.ok || !data.decision) {
        setError(data.error ?? "Could not save this decision.");
        setFieldErrors(data.fieldErrors ?? {});
        return;
      }

      router.push(`/decisions/${data.decision.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the app still running?");
    } finally {
      setSubmitting(false);
    }
  }

  const risk = activeAdvice ? IMPULSE_RISK_META[activeAdvice.riskBand] : null;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        {error && (
          <Alert variant="danger">
            <AlertCircle aria-hidden />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>The decision</CardTitle>
            <CardDescription>
              Describe it now. You will be asked to review it later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">
                What is it? <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Noise-cancelling headphones"
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title && (
                <p className="text-xs text-destructive">{fieldErrors.title}</p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount (USD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={Boolean(fieldErrors.amount)}
                />
                {fieldErrors.amount ? (
                  <p className="text-xs text-destructive">{fieldErrors.amount}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Your alert threshold is {formatCurrency(defaultThreshold)}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Why do you want it? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Be honest — this is the part you will re-read after the cooling-off period."
                aria-invalid={Boolean(fieldErrors.reason)}
              />
              {fieldErrors.reason && (
                <p className="text-xs text-destructive">{fieldErrors.reason}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alternatives you considered, links, who you spoke to…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How are you feeling?</CardTitle>
            <CardDescription>
              Emotional state drives one of our checks, so answer honestly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Emotional state</Label>
                <Select
                  value={emotionalState}
                  onValueChange={(v) => setEmotionalState(v as EmotionalState)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONAL_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {titleCase(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_LEVELS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {titleCase(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Is this essential?</Label>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: true, label: "Yes — I need it", hint: "Cannot wait" },
                    { value: false, label: "No — it is a want", hint: "Could wait" },
                  ] as const
                ).map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setEssential(option.value)}
                    aria-pressed={essential === option.value}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                      essential === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cooling-off period</CardTitle>
            <CardDescription>
              How long should this decision be locked away?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COOLING_PERIODS.map((period) => (
                <button
                  key={period.key}
                  type="button"
                  onClick={() => setCoolingOffPeriod(period.key)}
                  aria-pressed={coolingOffPeriod === period.key}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-center transition-colors cursor-pointer",
                    coolingOffPeriod === period.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span className="block text-sm font-medium">{period.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {period.key}
                  </span>
                </button>
              ))}
            </div>

            {activeAdvice?.hasFlags && activeAdvice.suggestedPeriod !== coolingOffPeriod && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applySuggestion}
              >
                <ShieldCheck aria-hidden />
                Use the recommended {COOLING_PERIODS.find((p) => p.key === activeAdvice.suggestedPeriod)?.label}{" "}
                period
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live rule feedback */}
      <aside className="lg:sticky lg:top-24">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Behaviour check</CardTitle>
              {previewing && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              )}
            </div>
            <CardDescription>
              Transparent rules, not a black box.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canPreview ? (
              <p className="text-sm text-muted-foreground">
                Enter an amount to see which rules apply.
              </p>
            ) : !activeAdvice ? (
              <p className="text-sm text-muted-foreground">Evaluating…</p>
            ) : (
              <>
                {risk && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-semibold", risk.className)}>
                        <span aria-hidden>{risk.indicator}</span> {risk.label}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {activeAdvice.impulseRiskScore}/100
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                      role="progressbar"
                      aria-valuenow={activeAdvice.impulseRiskScore}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Impulse risk score"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          activeAdvice.riskBand === "high"
                            ? "bg-rose-500"
                            : activeAdvice.riskBand === "moderate"
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                        style={{ width: `${activeAdvice.impulseRiskScore}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{activeAdvice.summary}</p>
                  </div>
                )}

                <ul className="space-y-3">
                  {activeAdvice.results.map((rule) => {
                    const style = SEVERITY_STYLE[rule.severity];
                    const Icon = style.icon;
                    return (
                      <li key={rule.key} className="flex gap-2.5">
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            rule.triggered ? style.className : "text-muted-foreground/40",
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                !rule.triggered && "text-muted-foreground",
                              )}
                            >
                              {rule.name}
                            </span>
                            {rule.triggered ? (
                              <Badge variant={style.badge}>flagged</Badge>
                            ) : (
                              <Badge variant="outline">clear</Badge>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {rule.message}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Starting cooling-off…" : "Start cooling-off period"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You cannot approve this decision until the timer ends.
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
