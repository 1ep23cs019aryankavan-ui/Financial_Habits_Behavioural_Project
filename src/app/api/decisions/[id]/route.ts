import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, handle, noContent, ok } from "@/lib/api";
import { updateDecisionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const decision = await prisma.decision.findFirst({
      where: { id, userId: user.id },
      include: { reflection: true },
    });

    if (!decision) throw new HttpError("Decision not found.", 404);
    return ok({ decision });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const parsed = updateDecisionSchema.parse(await request.json());

    // The route param is authoritative; the body's id is validated but ignored.
    const { id: _bodyId, ...changes } = parsed;
    void _bodyId;

    const existing = await prisma.decision.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new HttpError("Decision not found.", 404);

    // A decision that already left the cooling-off state is a historical
    // record — editing it would rewrite the journal.
    if (existing.status !== "COOLING_OFF") {
      throw new HttpError(
        "This decision is already resolved and can no longer be edited.",
        409,
      );
    }

    // Extending the cooling-off period is the only honest edit: a decision can
    // be made more cautious, never less.
    const data: Record<string, unknown> = { ...changes };
    delete data.coolingOffPeriod;
    if (changes.coolingOffPeriod) {
      const hours = { "1h": 1, "24h": 24, "3d": 72, "7d": 168 }[
        changes.coolingOffPeriod
      ];
      if (hours) {
        data.coolingOffEndsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      }
    }

    const decision = await prisma.decision.update({
      where: { id },
      data,
    });

    return ok({ decision });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.decision.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new HttpError("Decision not found.", 404);

    await prisma.decision.delete({ where: { id } });
    return noContent();
  });
}
