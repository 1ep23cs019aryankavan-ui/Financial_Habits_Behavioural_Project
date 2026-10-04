import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/api";
import { assertCoolingOffElapsed } from "@/lib/decisions";
import { evaluateResilience } from "@/lib/rules";
import { reflectionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/**
 * Completes a cooling-off decision and records the reflection.
 *
 * `assertCoolingOffElapsed` runs BEFORE anything is written, so an early
 * attempt cannot create a half-finished reflection row.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = reflectionSchema.parse({ ...(await request.json()), decisionId: id });

    const decision = await prisma.decision.findFirst({
      where: { id, userId: user.id },
    });
    if (!decision) throw new HttpError("Decision not found.", 404);

    // Server-side circuit breaker.
    assertCoolingOffElapsed(decision);

    const { resilience, note } = evaluateResilience(body.finalDecision, {
      stillNeeded: body.stillNeeded,
      affordable: body.affordable,
      planned: body.planned,
      affectsGoal: body.affectsGoal,
    });

    const status =
      body.finalDecision === "APPROVED"
        ? "APPROVED"
        : body.finalDecision === "CANCELLED"
          ? "CANCELLED"
          : "RECONSIDERED";

    const reflectionText = [body.reflection, note].filter(Boolean).join("\n\n");

    const [updated] = await prisma.$transaction([
      prisma.decision.update({
        where: { id },
        data: {
          status,
          resilienceShown: resilience,
          reflection: {
            create: {
              stillNeeded: body.stillNeeded,
              affordable: body.affordable,
              planned: body.planned,
              affectsGoal: body.affectsGoal,
              finalDecision: status,
              reflection: reflectionText || null,
            },
          },
        },
        include: { reflection: true },
      }),
    ]);

    return ok({ decision: updated, resilience, note });
  });
}
