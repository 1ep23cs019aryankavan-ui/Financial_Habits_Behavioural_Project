/**
 * Single source of truth for every controlled vocabulary in the app.
 *
 * SQLite has no native enum type, so these string unions are mirrored by Zod
 * schemas in `validation.ts` and enforced at every API boundary. Keeping them in
 * one file means the rule engine, the UI dropdowns and the DB can never drift.
 */

export const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Travel",
  "Food & Dining",
  "Subscriptions",
  "Home",
  "Health",
  "Education",
  "Entertainment",
  "Vehicle",
  "Gifts",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const EMOTIONAL_STATES = [
  "calm",
  "neutral",
  "excited",
  "stressed",
  "anxious",
  "sad",
  "angry",
  "impulsive",
  "regretful",
] as const;
export type EmotionalState = (typeof EMOTIONAL_STATES)[number];

/** Emotional states that Rule 2 treats as a reason to wait. */
export const RULE_2_EMOTIONAL_STATES: readonly EmotionalState[] = [
  "angry",
  "sad",
  "stressed",
  "excited",
  "anxious",
  "impulsive",
];

export const URGENCY_LEVELS = ["low", "medium", "high"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const COOLING_PERIOD_KEYS = ["1h", "24h", "3d", "7d"] as const;
export type CoolingPeriodKey = (typeof COOLING_PERIOD_KEYS)[number];

export const COOLING_PERIOD_DETAILS: Record<
  CoolingPeriodKey,
  { label: string; hours: number }
> = {
  "1h": { label: "1 hour", hours: 1 },
  "24h": { label: "24 hours", hours: 24 },
  "3d": { label: "3 days", hours: 72 },
  "7d": { label: "7 days", hours: 168 },
};

export const COOLING_PERIODS = COOLING_PERIOD_KEYS.map((key) => ({
  key,
  label: COOLING_PERIOD_DETAILS[key].label,
  hours: COOLING_PERIOD_DETAILS[key].hours,
}));

export const COOLING_PERIOD_MAP = COOLING_PERIOD_DETAILS;

export const DECISION_STATUSES = [
  "COOLING_OFF",
  "RECONSIDERED",
  "APPROVED",
  "CANCELLED",
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const RULE_KEYS = [
  "HIGH_AMOUNT",
  "EMOTIONAL_STATE",
  "URGENT_NON_ESSENTIAL",
  "REPEAT_CATEGORY",
  "RECONSIDERED",
] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

export type Severity = "info" | "warn" | "high";

/** Emoji-coded status indicators required by the spec. */
export const STATUS_META: Record<
  DecisionStatus,
  { label: string; indicator: string; className: string }
> = {
  COOLING_OFF: {
    label: "Cooling off",
    indicator: "🟡",
    className:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800",
  },
  RECONSIDERED: {
    label: "Reconsidered",
    indicator: "🟢",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
  },
  APPROVED: {
    label: "Completed",
    indicator: "🔵",
    className:
      "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800",
  },
  CANCELLED: {
    label: "Cancelled",
    indicator: "⚪",
    className:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700",
  },
};

/** Rule catalogue. Definitions are static text; thresholds live per-user. */
export const RULE_CATALOGUE: Record<
  RuleKey,
  { name: string; description: string }
> = {
  HIGH_AMOUNT: {
    name: "High-amount pause",
    description:
      "When the amount is above your personal threshold, a cooling-off period is recommended before acting.",
  },
  EMOTIONAL_STATE: {
    name: "Emotional-state check",
    description:
      "Decisions made while angry, sad, stressed, anxious, impulsive or excited are flagged — wait until you are calm.",
  },
  URGENT_NON_ESSENTIAL: {
    name: "Urgent but non-essential",
    description:
      "High urgency on something that is not essential is a classic impulse-spending signal.",
  },
  REPEAT_CATEGORY: {
    name: "Repeat spending habit",
    description:
      "Several decisions in the same category within your recent window suggests a spending habit rather than a one-off.",
  },
  RECONSIDERED: {
    name: "Behavioural resilience",
    description:
      "When you change your mind after the cooling-off period, it is recorded as a win — this feeds your resilience score.",
  },
};

export const RECONSIDERATION_QUESTIONS = [
  "Do I still need this?",
  "Was this planned, or impulsive?",
  "Can I comfortably afford it?",
  "Will this affect an important financial goal?",
  "Would I make the same decision tomorrow?",
] as const;

export const DISCLAIMER =
  "This is a behavioural habit tool, not a financial advisor. It does not give investment advice, predict market prices, or connect to your bank accounts.";
