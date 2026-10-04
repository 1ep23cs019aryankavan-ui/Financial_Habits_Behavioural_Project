import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RULE_CATALOGUE, RULE_KEYS } from "@/lib/constants";
import { SettingsForm, type RuleRow } from "@/components/settings-form";
import { Disclaimer } from "@/components/disclaimer";

export const metadata: Metadata = { title: "Rules & settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [settings, rules] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.rule.findMany({ where: { userId: user.id } }),
  ]);

  const ruleRows: RuleRow[] = RULE_KEYS.map((key) => {
    const row = rules.find((r) => r.key === key);
    return {
      key,
      name: RULE_CATALOGUE[key].name,
      description: RULE_CATALOGUE[key].description,
      enabled: row?.enabled ?? true,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="size-6 text-primary" aria-hidden />
          Rules &amp; settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tune the thresholds that drive your behavioural checks.
        </p>
      </header>

      <SettingsForm
        initialSettings={{
          amountThreshold: settings?.amountThreshold ?? 500,
          defaultCoolingOffHours: settings?.defaultCoolingOffHours ?? 24,
          categoryWindowDays: settings?.categoryWindowDays ?? 30,
          categoryRepeatLimit: settings?.categoryRepeatLimit ?? 3,
        }}
        initialRules={ruleRows}
      />

      <Disclaimer />
    </div>
  );
}
