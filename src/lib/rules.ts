import {
  COOLING_PERIOD_MAP,
  RULE_2_EMOTIONAL_STATES,
  RULE_CATALOGUE,
  type CoolingPeriodKey,
  type EmotionalState,
  type RuleKey,
  type Severity,
  type Urgency,
} from "./constants";
import { formatCurrency } from "./utils";

/**
 * Deterministic, explainable rule engine.
 *
 * There is no model, no randomness and no network call here — every flag is a
 * pure function of the inputs, so the same decision always produces the same
 * advice. That is the entire point of the product: the user can read exactly
 * why something was flagged.
 */

export type RuleEvaluationInput = {
  amount: number;
  category: string;
  emotionalState: EmotionalState;
  urgency: Urgency;
  essential: boolean;
  coolingOffPeriod: CoolingPeriodKey;
  /** Same-category decisions already logged inside the habit window. */
  recentCategoryCount: number;
};

export type RuleContext = {
  amountThreshold: number;
  categoryWindowDays: number;
  categoryRepeatLimit: number;
  enabled: Record<RuleKey, boolean>;
};

export type RuleResult = {
  key: RuleKey;
  name: string;
  description: string;
  triggered: boolean;
  severity: Severity;
  /** Human-readable explanation shown in the UI. */
  message: string;
  /** Recommended cooling-off period, when the rule has an opinion. */
  suggestedPeriod?: CoolingPeriodKey;
};

export type DecisionAdvice = {
  results: RuleResult[];
  /** Keys of rules that fired — stored on the Decision for the journal. */
  firedKeys: RuleKey[];
  /** True when at least one rule fired. */
  hasFlags: boolean;
  /** Highest severity among fired rules. */
  topSeverity: Severity | null;
  /** Suggested cooling-off length after applying every triggered rule. */
  suggestedPeriod: CoolingPeriodKey;
  /** 0-100 score, higher = calmer/more deliberate. Purely heuristic. */
  impulseRiskScore: number;
  riskBand: "low" | "moderate" | "high";
  summary: string;
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  warn: 2,
  high: 3,
};

/** Suggested period per rule, escalating with seriousness. */
function periodForSeverity(severity: Severity): CoolingPeriodKey {
  if (severity === "high") return "7d";
  if (severity === "warn") return "3d";
  return "24h";
}

export function evaluateRules(
  input: RuleEvaluationInput,
  context: RuleContext,
): DecisionAdvice {
  const results: RuleResult[] = [];

  // ── Rule 1 ────────────────────────────────────────────────────────────────
  // Amount above the user's personal threshold → recommend a cooling-off period.
  {
    const above = input.amount > context.amountThreshold;
    const severity: Severity = above ? "high" : "info";
    results.push({
      key: "HIGH_AMOUNT",
      name: RULE_CATALOGUE.HIGH_AMOUNT.name,
      description: RULE_CATALOGUE.HIGH_AMOUNT.description,
      triggered: above,
      severity,
      message: above
        ? `${formatCurrency(input.amount)} is above your ${formatCurrency(context.amountThreshold)} threshold. Large spends benefit from a deliberate pause.`
        : `${formatCurrency(input.amount)} is within your ${formatCurrency(context.amountThreshold)} threshold.`,
      suggestedPeriod: above ? periodForSeverity(severity) : undefined,
    });
  }

  // ── Rule 2 ────────────────────────────────────────────────────────────────
  // Emotionally activated state → wait until calm.
  {
    const emotional = RULE_2_EMOTIONAL_STATES.includes(input.emotionalState);
    const severity: Severity = emotional ? "warn" : "info";
    results.push({
      key: "EMOTIONAL_STATE",
      name: RULE_CATALOGUE.EMOTIONAL_STATE.name,
      description: RULE_CATALOGUE.EMOTIONAL_STATE.description,
      triggered: emotional,
      severity,
      message: emotional
        ? `You recorded feeling "${input.emotionalState}". Decisions made in this state are more likely to be regretted — wait until you are calm.`
        : `You recorded feeling "${input.emotionalState}". No emotional red flag.`,
      suggestedPeriod: emotional ? periodForSeverity(severity) : undefined,
    });
  }

  // ── Rule 3 ────────────────────────────────────────────────────────────────
  // High urgency + non-essential → impulse-risk flag.
  {
    const flagged = input.urgency === "high" && !input.essential;
    const severity: Severity = flagged ? "high" : "info";
    results.push({
      key: "URGENT_NON_ESSENTIAL",
      name: RULE_CATALOGUE.URGENT_NON_ESSENTIAL.name,
      description: RULE_CATALOGUE.URGENT_NON_ESSENTIAL.description,
      triggered: flagged,
      severity,
      message: flagged
        ? `Marked high urgency but not essential. Real needs rarely expire overnight — this is a strong impulse-spending signal.`
        : input.urgency === "high"
          ? "High urgency, but you marked this as essential."
          : `Urgency is "${input.urgency}", which does not trigger this rule.`,
      suggestedPeriod: flagged ? periodForSeverity(severity) : undefined,
    });
  }

  // ── Rule 4 ────────────────────────────────────────────────────────────────
  // Repeat spending in the same category inside the habit window.
  {
    const repeated = input.recentCategoryCount >= context.categoryRepeatLimit;
    const severity: Severity = repeated ? "warn" : "info";
    results.push({
      key: "REPEAT_CATEGORY",
      name: RULE_CATALOGUE.REPEAT_CATEGORY.name,
      description: RULE_CATALOGUE.REPEAT_CATEGORY.description,
      triggered: repeated,
      severity,
      message: repeated
        ? `This is decision #${input.recentCategoryCount + 1} in "${input.category}" within ${context.categoryWindowDays} days. That pattern looks like a habit, not a one-off.`
        : `${input.recentCategoryCount} recent ${input.category} decision${input.recentCategoryCount === 1 ? "" : "s"} — below your limit of ${context.categoryRepeatLimit}.`,
      suggestedPeriod: repeated ? periodForSeverity(severity) : undefined,
    });
  }

  // ── Rule 5 ────────────────────────────────────────────────────────────────
  // Behavioural resilience — evaluated at *completion* time, not creation.
  // Included here so the dashboard can show it alongside the other four.
  {
    results.push({
      key: "RECONSIDERED",
      name: RULE_CATALOGUE.RECONSIDERED.name,
      description: RULE_CATALOGUE.RECONSIDERED.description,
      triggered: false,
      severity: "info",
      message:
        "Recorded automatically when you change your mind after the cooling-off period.",
    });
  }

  const enabledResults = results.filter((r) => context.enabled[r.key]);
  const fired = enabledResults.filter((r) => r.triggered);

  const firedKeys = fired.map((r) => r.key);
  const topSeverity = fired.reduce<Severity | null>((acc, r) => {
    if (!acc) return r.severity;
    return SEVERITY_WEIGHT[r.severity] > SEVERITY_WEIGHT[acc] ? r.severity : acc;
  }, null);

  // Suggested period = longest recommendation among fired rules.
  const suggestedPeriod = fired.reduce<CoolingPeriodKey>(
    (longest, r) =>
      !r.suggestedPeriod
        ? longest
        : COOLING_PERIOD_MAP[r.suggestedPeriod].hours >
            COOLING_PERIOD_MAP[longest].hours
          ? r.suggestedPeriod
          : longest,
    "24h",
  );

  const impulseRiskScore = Math.min(
    100,
    fired.reduce((sum, r) => sum + SEVERITY_WEIGHT[r.severity] * 22, 0),
  );

  const riskBand: DecisionAdvice["riskBand"] =
    impulseRiskScore >= 60 ? "high" : impulseRiskScore >= 25 ? "moderate" : "low";

  const summary = buildSummary(fired, topSeverity, suggestedPeriod);

  return {
    results: enabledResults,
    firedKeys,
    hasFlags: fired.length > 0,
    topSeverity,
    suggestedPeriod,
    impulseRiskScore,
    riskBand,
    summary,
  };
}

function buildSummary(
  fired: RuleResult[],
  topSeverity: Severity | null,
  suggestedPeriod: CoolingPeriodKey,
): string {
  if (fired.length === 0) {
    return "No behavioural flags. This looks like a planned, affordable decision.";
  }
  const label =
    topSeverity === "high" ? "High impulse risk" : topSeverity === "warn" ? "Worth pausing" : "Minor note";
  return `${label}: ${fired.length} rule${fired.length === 1 ? "" : "s"} matched. A ${COOLING_PERIOD_MAP[suggestedPeriod].label} cooling-off period is recommended.`;
}

/**
 * Rule 5 — called once the cooling-off window has elapsed and the user submits
 * the questionnaire. Returns whether this counts as behavioural resilience.
 */
export function evaluateResilience(
  finalDecision: string,
  answers: {
    stillNeeded: boolean;
    affordable: boolean;
    planned: boolean;
    affectsGoal: boolean;
  },
): { resilience: boolean; note: string } {
  const abandoned = finalDecision !== "APPROVED";

  if (abandoned) {
    return {
      resilience: true,
      note: "You changed your mind after waiting. That is exactly the habit this tool exists to build.",
    };
  }

  // Still went ahead, but only with a clean bill of health.
  const clean =
    answers.stillNeeded &&
    answers.affordable &&
    answers.planned &&
    !answers.affectsGoal;

  if (clean) {
    return {
      resilience: false,
      note: "Cooling-off period passed and the decision still looked sound. Proceeding was reasonable.",
    };
  }

  const concerns: string[] = [];
  if (!answers.stillNeeded) concerns.push("you said you no longer need it");
  if (!answers.affordable) concerns.push("it is not comfortably affordable");
  if (!answers.planned) concerns.push("it was not planned");
  if (answers.affectsGoal) concerns.push("it affects one of your goals");

  return {
    resilience: false,
    note: `You proceeded, but ${concerns.join(", ")}. Worth a second look next time.`,
  };
}

export const IMPULSE_RISK_META = {
  low: { indicator: "🟢", label: "Low impulse risk", className: "text-emerald-600" },
  moderate: {
    indicator: "🟡",
    label: "Moderate impulse risk",
    className: "text-amber-600",
  },
  high: { indicator: "🔴", label: "High impulse risk", className: "text-rose-600" },
} as const;
