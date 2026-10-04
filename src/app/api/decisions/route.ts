import { requireUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/api";
import { createDecision, previewAdvice } from "@/lib/decisions";
import {
  CATEGORIES,
  EMOTIONAL_STATES,
  URGENCY_LEVELS,
  type Category,
  type EmotionalState,
  type Urgency,
} from "@/lib/constants";
import { createDecisionSchema } from "@/lib/validation";

/** Creates a decision and starts its cooling-off period. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = createDecisionSchema.parse(await request.json());
    const { decision, advice } = await createDecision(user.id, input);
    return ok({ decision, advice });
  });
}

function pick<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Live rule preview for the creation form. Runs on every change, so it is
 * deliberately lenient — real validation happens on submit via POST.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError("Enter an amount to see a rule preview.");
    }

    const advice = await previewAdvice(user.id, {
      amount,
      category: pick<Category>(CATEGORIES, body.category, "Other"),
      emotionalState: pick<EmotionalState>(EMOTIONAL_STATES, body.emotionalState, "calm"),
      urgency: pick<Urgency>(URGENCY_LEVELS, body.urgency, "medium"),
      essential: body.essential !== false,
    });

    return ok({ advice });
  });
}
