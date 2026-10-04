import { z } from "zod";
import {
  CATEGORIES,
  COOLING_PERIOD_KEYS,
  DECISION_STATUSES,
  EMOTIONAL_STATES,
  URGENCY_LEVELS,
} from "./constants";

/**
 * SQLite stores these as plain strings, so these schemas are the enforcement
 * boundary. Every API route validates with them before touching the database.
 */

const categoryEnum = z.enum(CATEGORIES);
const emotionalStateEnum = z.enum(EMOTIONAL_STATES);
const urgencyEnum = z.enum(URGENCY_LEVELS);
const statusEnum = z.enum(DECISION_STATUSES);
const coolingPeriodEnum = z.enum(COOLING_PERIOD_KEYS);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createDecisionSchema = z.object({
  title: z.string().trim().min(3, "Give the decision a short name").max(120),
  amount: z
    .number({ error: "Enter a valid amount" })
    .positive("Amount must be greater than 0")
    .max(10_000_000, "Amount is unrealistically large"),
  category: categoryEnum,
  reason: z
    .string()
    .trim()
    .min(5, "Tell us why — this is what you will re-read later")
    .max(1000),
  emotionalState: emotionalStateEnum,
  urgency: urgencyEnum,
  essential: z.boolean(),
  coolingOffPeriod: coolingPeriodEnum,
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const updateDecisionSchema = createDecisionSchema.partial().extend({
  id: z.string().min(1),
});

/** The reconsideration questionnaire captured once the cooling-off period ends. */
export const reflectionSchema = z.object({
  decisionId: z.string().min(1),
  stillNeeded: z.boolean(),
  affordable: z.boolean(),
  planned: z.boolean(),
  affectsGoal: z.boolean(),
  /** What the user actually did: APPROVED | RECONSIDERED | CANCELLED */
  finalDecision: z.enum(["APPROVED", "RECONSIDERED", "CANCELLED"]),
  reflection: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateSettingsSchema = z.object({
  amountThreshold: z
    .number({ error: "Enter a valid threshold" })
    .positive("Threshold must be greater than 0")
    .max(10_000_000),
  defaultCoolingOffHours: z
    .number()
    .int()
    .min(1, "Must be at least 1 hour")
    .max(24 * 30, "Must be 30 days or less"),
  categoryWindowDays: z
    .number()
    .int()
    .min(1, "Must be at least 1 day")
    .max(365, "Must be a year or less"),
  categoryRepeatLimit: z
    .number()
    .int()
    .min(2, "Must be at least 2")
    .max(50),
});

export const toggleRuleSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
});

export const journalQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: statusEnum.optional(),
  category: categoryEnum.optional(),
  sort: z.enum(["newest", "oldest", "amount-desc", "amount-asc"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>;
export type ReflectionInput = z.infer<typeof reflectionSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type JournalQuery = z.infer<typeof journalQuerySchema>;

/** Flattens a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
