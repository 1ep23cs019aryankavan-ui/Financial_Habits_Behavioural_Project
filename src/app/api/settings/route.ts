import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/api";
import { updateSettingsSchema } from "@/lib/validation";
import { RULE_CATALOGUE, RULE_KEYS, type RuleKey } from "@/lib/constants";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [settings, rules] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
      prisma.rule.findMany({ where: { userId: user.id } }),
    ]);

    return ok({
      settings: settings ?? {
        amountThreshold: 500,
        defaultCoolingOffHours: 24,
        categoryWindowDays: 30,
        categoryRepeatLimit: 3,
      },
      rules: RULE_KEYS.map((key) => {
        const row = rules.find((r) => r.key === key);
        return {
          key,
          name: RULE_CATALOGUE[key].name,
          description: RULE_CATALOGUE[key].description,
          enabled: row?.enabled ?? true,
        };
      }),
    });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await request.json();

    if (typeof body?.key === "string" && typeof body?.enabled === "boolean") {
      if (!(RULE_KEYS as readonly string[]).includes(body.key)) {
        throw new HttpError("Unknown rule.", 404);
      }
      const rule = await prisma.rule.upsert({
        where: { userId_key: { userId: user.id, key: body.key } },
        create: {
          userId: user.id,
          key: body.key as RuleKey,
          name: RULE_CATALOGUE[body.key as RuleKey].name,
          description: RULE_CATALOGUE[body.key as RuleKey].description,
          enabled: body.enabled,
        },
        update: { enabled: body.enabled },
      });
      return ok({ rule });
    }

    const input = updateSettingsSchema.parse(body);
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...input },
      update: input,
    });

    return ok({ settings });
  });
}
