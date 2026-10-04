import "server-only";
import { prisma } from "./db";
import { getEnabledRules, getSettings } from "./auth";
import { evaluateRules, type DecisionAdvice } from "./rules";
import { COOLING_PERIOD_MAP } from "./constants";
import type { CreateDecisionInput } from "./validation";
import { HttpError } from "./api";

/**
 * Counts how many decisions the user already logged in this category inside the
 * habit window. Feeds Rule 4. The current decision is excluded so re-running
 * the check after saving stays stable.
 */
export async function countRecentCategory(
  userId: string,
  category: string,
  windowDays: number,
  excludeId?: string,
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  return prisma.decision.count({
    where: {
      userId,
      category,
      createdAt: { gte: since },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/** Runs the full rule engine for a hypothetical decision (used for live preview). */
export async function previewAdvice(
  userId: string,
  input: Pick<
    CreateDecisionInput,
    "amount" | "category" | "emotionalState" | "urgency" | "essential"
  >,
): Promise<DecisionAdvice> {
  const settings = await getSettings(userId);
  const enabled = await getEnabledRules(userId);

  const recentCategoryCount = await countRecentCategory(
    userId,
    input.category,
    settings.categoryWindowDays,
  );

  return evaluateRules(
    {
      amount: input.amount,
      category: input.category,
      emotionalState: input.emotionalState,
      urgency: input.urgency,
      essential: input.essential,
      coolingOffPeriod: "24h",
      recentCategoryCount,
    },
    { ...settings, enabled },
  );
}

export async function createDecision(
  userId: string,
  input: CreateDecisionInput,
) {
  const settings = await getSettings(userId);
  const enabled = await getEnabledRules(userId);
  const recentCategoryCount = await countRecentCategory(
    userId,
    input.category,
    settings.categoryWindowDays,
  );

  const advice = evaluateRules(
    {
      amount: input.amount,
      category: input.category,
      emotionalState: input.emotionalState,
      urgency: input.urgency,
      essential: input.essential,
      coolingOffPeriod: input.coolingOffPeriod,
      recentCategoryCount,
    },
    { ...settings, enabled },
  );

  const hours =
    COOLING_PERIOD_MAP[input.coolingOffPeriod]?.hours ??
    settings.defaultCoolingOffHours;
  const coolingOffEndsAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const decision = await prisma.decision.create({
    data: {
      userId,
      title: input.title,
      amount: input.amount,
      category: input.category,
      reason: input.reason,
      emotionalState: input.emotionalState,
      urgency: input.urgency,
      essential: input.essential,
      notes: input.notes || null,
      coolingOffPeriod: input.coolingOffPeriod,
      coolingOffEndsAt,
      status: "COOLING_OFF",
      ruleFlags: JSON.stringify(advice.firedKeys),
    },
  });

  return { decision, advice };
}

/** Milliseconds left on the cooling-off clock. Zero once elapsed. */
export function remainingMs(coolingOffEndsAt: Date): number {
  return Math.max(0, coolingOffEndsAt.getTime() - Date.now());
}

export function isCoolingOff(coolingOffEndsAt: Date): boolean {
  return remainingMs(coolingOffEndsAt) > 0;
}

/**
 * THE COOLING-OFF CIRCUIT BREAKER.
 *
 * This guard is enforced on the server and is the single source of truth for
 * "you cannot approve this yet". The UI also hides/disables the button, but that
 * is only a convenience — bypassing the client still hits this check.
 */
export function assertCoolingOffElapsed(decision: {
  status: string;
  coolingOffEndsAt: Date;
}): void {
  if (decision.status !== "COOLING_OFF") {
    throw new HttpError("This decision has already been completed.", 409);
  }

  const remaining = remainingMs(decision.coolingOffEndsAt);
  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    throw new HttpError(
      `Cooling-off period is still active. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      423, // Locked
    );
  }
}
