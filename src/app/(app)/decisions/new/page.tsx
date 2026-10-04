import type { Metadata } from "next";
import { DecisionForm } from "@/components/decision-form";
import { getCurrentUser, getSettings } from "@/lib/auth";
import { COOLING_PERIODS } from "@/lib/constants";

export const metadata: Metadata = { title: "New decision" };

export default async function NewDecisionPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const settings = await getSettings(user.id);

  // Map the stored default hours back onto one of the four presets.
  const matching = COOLING_PERIODS.find(
    (p) => p.hours === settings.defaultCoolingOffHours,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Log a decision</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing is approved instantly. Write it down, wait it out, then decide.
        </p>
      </header>

      <DecisionForm
        defaultThreshold={settings.amountThreshold}
        defaultCoolingPeriod={matching?.key ?? "24h"}
      />
    </div>
  );
}
