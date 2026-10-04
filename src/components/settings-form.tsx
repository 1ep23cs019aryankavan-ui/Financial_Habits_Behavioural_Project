"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { COOLING_PERIOD_DETAILS, type RuleKey } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export type SettingsPayload = {
  amountThreshold: number;
  defaultCoolingOffHours: number;
  categoryWindowDays: number;
  categoryRepeatLimit: number;
};

export type RuleRow = {
  key: RuleKey;
  name: string;
  description: string;
  enabled: boolean;
};

export function SettingsForm({
  initialSettings,
  initialRules,
}: {
  initialSettings: SettingsPayload;
  initialRules: RuleRow[];
}) {
  const router = useRouter();

  const [amountThreshold, setAmountThreshold] = useState(
    String(initialSettings.amountThreshold),
  );
  const [categoryWindowDays, setCategoryWindowDays] = useState(
    String(initialSettings.categoryWindowDays),
  );
  const [categoryRepeatLimit, setCategoryRepeatLimit] = useState(
    String(initialSettings.categoryRepeatLimit),
  );
  const [defaultCoolingOffHours, setDefaultCoolingOffHours] = useState(
    String(initialSettings.defaultCoolingOffHours),
  );

  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const parsedThreshold = Number(amountThreshold);
  const thresholdValid = Number.isFinite(parsedThreshold) && parsedThreshold > 0;

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountThreshold: parsedThreshold,
          defaultCoolingOffHours: Number(defaultCoolingOffHours),
          categoryWindowDays: Number(categoryWindowDays),
          categoryRepeatLimit: Number(categoryRepeatLimit),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSettingsMessage({
          ok: false,
          text: data.error ?? "Could not save settings.",
        });
        return;
      }

      setSettingsMessage({ ok: true, text: "Settings saved." });
      router.refresh();
    } catch {
      setSettingsMessage({ ok: false, text: "Could not reach the server." });
    } finally {
      setSavingSettings(false);
    }
  }

  async function toggleRule(key: RuleKey, enabled: boolean) {
    // Optimistic — revert if the request fails.
    const previous = rules;
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, enabled } : r)));

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (!res.ok) {
        setRules(previous);
      }
      router.refresh();
    } catch {
      setRules(previous);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your thresholds</CardTitle>
          <CardDescription>
            These personalise the rules. Everything stays on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-5">
            {settingsMessage && (
              <Alert variant={settingsMessage.ok ? "success" : "danger"}>
                {settingsMessage.ok ? <Check aria-hidden /> : <AlertCircle aria-hidden />}
                <AlertDescription>{settingsMessage.text}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="threshold">High-amount threshold (USD)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  step="1"
                  value={amountThreshold}
                  onChange={(e) => setAmountThreshold(e.target.value)}
                  aria-invalid={!thresholdValid}
                  aria-describedby="threshold-help"
                />
                <p id="threshold-help" className="text-xs text-muted-foreground">
                  {thresholdValid
                    ? `Decisions above ${formatCurrency(parsedThreshold)} trigger the high-amount rule.`
                    : "Enter a number greater than zero."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-period">Default cooling-off period</Label>
                <select
                  id="default-period"
                  value={defaultCoolingOffHours}
                  onChange={(e) => setDefaultCoolingOffHours(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Object.entries(COOLING_PERIOD_DETAILS).map(([key, meta]) => (
                    <option key={key} value={meta.hours}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Pre-selected when you log a new decision.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="window">Habit window (days)</Label>
                <Input
                  id="window"
                  type="number"
                  min="1"
                  max="365"
                  value={categoryWindowDays}
                  onChange={(e) => setCategoryWindowDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  How far back the repeat-spending rule looks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repeat">Repeat-spending limit</Label>
                <Input
                  id="repeat"
                  type="number"
                  min="2"
                  max="50"
                  value={categoryRepeatLimit}
                  onChange={(e) => setCategoryRepeatLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Same-category decisions in that window before warning you.
                </p>
              </div>
            </div>

            <Button type="submit" disabled={savingSettings || !thresholdValid}>
              {savingSettings ? "Saving…" : "Save thresholds"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour rules</CardTitle>
          <CardDescription>
            Plain, deterministic checks — no AI, no black box. Toggle any rule off
            and its advice disappears everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {rules.map((rule) => (
              <li key={rule.key} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <p className="font-medium">{rule.name}</p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {rule.description}
                  </p>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => toggleRule(rule.key, checked)}
                  aria-label={`Enable ${rule.name}`}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the scoring works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Each enabled rule contributes a fixed weight when it fires: info rules
            add 22 points, warnings add 44 and high-severity rules add 66. The
            total is capped at 100 and mapped to a band — 0–24 low, 25–59
            moderate, 60+ high.
          </p>
          <p>
            Behavioural resilience is simply the share of your resolved decisions
            that you reconsidered after waiting. It is a measure of your own
            habit strength, not a financial outcome.
          </p>
          <p>
            Nothing here is financial advice, and no rule looks at markets, prices
            or your bank account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
