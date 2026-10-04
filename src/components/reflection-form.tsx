"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Lock, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FinalDecision = "APPROVED" | "RECONSIDERED" | "CANCELLED";

/** The reconsideration questions from the spec. */
const QUESTIONS = [
  { key: "stillNeeded", prompt: "Do I still need this?", positive: "Yes" },
  { key: "affordable", prompt: "Can I comfortably afford it?", positive: "Yes" },
  {
    key: "planned",
    prompt: "Was this planned rather than impulsive?",
    positive: "Yes, it was planned",
  },
  {
    key: "affectsGoal",
    prompt: "Will this affect an important financial goal?",
    positive: "Yes, it will",
  },
] as const;

type QuestionKey = (typeof QUESTIONS)[number]["key"];

const EMPTY_ANSWERS: Record<QuestionKey, boolean | null> = {
  stillNeeded: null,
  affordable: null,
  planned: null,
  affectsGoal: null,
};

export function ReflectionForm({
  decisionId,
  endsAt,
}: {
  decisionId: string;
  /** ISO timestamp when the cooling-off period elapses. */
  endsAt: string;
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<QuestionKey, boolean | null>>(
    EMPTY_ANSWERS,
  );
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ resilience: boolean; note: string } | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  const deadline = new Date(endsAt).getTime();

  // Unlock exactly when the clock hits zero, and recover if the page was left
  // open across the deadline.
  useEffect(() => {
    const check = () => setReady(Date.now() >= deadline);
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== null);

  function setAnswer(key: QuestionKey, value: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(finalDecision: FinalDecision) {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/decisions/${decisionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stillNeeded: answers.stillNeeded ?? false,
          affordable: answers.affordable ?? false,
          planned: answers.planned ?? false,
          affectsGoal: answers.affectsGoal ?? false,
          finalDecision,
          reflection,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        resilience?: boolean;
        note?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Could not save your reflection.");
        return;
      }

      setResult({ resilience: Boolean(data.resilience), note: data.note ?? "" });
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the app still running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Alert variant={result.resilience ? "success" : "info"}>
        {result.resilience ? <Sparkles aria-hidden /> : <CheckCircle2 aria-hidden />}
        <AlertTitle>
          {result.resilience ? "Behavioural resilience recorded" : "Decision recorded"}
        </AlertTitle>
        <AlertDescription>{result.note}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconsider this decision</CardTitle>
        <CardDescription>
          Answer honestly. There is no penalty for changing your mind — that is
          the whole point.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!ready && (
          <Alert variant="warning">
            <Lock aria-hidden />
            <AlertTitle>Still locked</AlertTitle>
            <AlertDescription>
              These questions unlock when the cooling-off period ends. The server
              rejects early submissions too, so this cannot be bypassed.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="danger">
            <AlertCircle aria-hidden />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ul className="space-y-4">
          {QUESTIONS.map((q) => (
            <li key={q.key} className="space-y-2">
              <Label>{q.prompt}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => setAnswer(q.key, true)}
                  aria-pressed={answers[q.key] === true}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    !ready ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    answers[q.key] === true
                      ? "border-primary bg-primary/5 font-medium ring-1 ring-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {q.positive}
                </button>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => setAnswer(q.key, false)}
                  aria-pressed={answers[q.key] === false}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    !ready ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    answers[q.key] === false
                      ? "border-primary bg-primary/5 font-medium ring-1 ring-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  No
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Label htmlFor="reflection">Reflection (optional)</Label>
          <Textarea
            id="reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            disabled={!ready}
            placeholder="What would you tell a friend in this situation?"
          />
        </div>

        {ready && !allAnswered && (
          <p className="text-xs text-muted-foreground">
            Answer all four questions to finish this decision.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || !allAnswered || submitting}
            onClick={() => submit("CANCELLED")}
          >
            <XCircle aria-hidden />
            Abandon it
          </Button>
          <Button
            type="button"
            disabled={!ready || !allAnswered || submitting}
            onClick={() => submit("RECONSIDERED")}
          >
            <Sparkles aria-hidden />
            I changed my mind
          </Button>
          <Button
            type="button"
            disabled={!ready || !allAnswered || submitting}
            onClick={() => submit("APPROVED")}
          >
            <CheckCircle2 aria-hidden />
            Go ahead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
