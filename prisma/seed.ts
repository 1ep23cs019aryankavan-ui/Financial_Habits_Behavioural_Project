/**
 * Seeds a demo account with realistic decisions so the dashboard and charts
 * have something to show. Safe to re-run: it clears the demo user's data first.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { evaluateResilience, evaluateRules } from "../src/lib/rules";
import {
  COOLING_PERIOD_DETAILS,
  RULE_CATALOGUE,
  RULE_KEYS,
  type Category,
  type CoolingPeriodKey,
  type EmotionalState,
  type Urgency,
} from "../src/lib/constants";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) return url;
  const raw = url.slice("file:".length).trim();
  if (raw.startsWith(":memory:")) return raw;
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
});

const DEMO_EMAIL = "demo@steady.app";
const DEMO_PASSWORD = "demo1234";

const SETTINGS = {
  amountThreshold: 500,
  defaultCoolingOffHours: 24,
  categoryWindowDays: 30,
  categoryRepeatLimit: 3,
};

type Seed = {
  title: string;
  amount: number;
  category: Category;
  reason: string;
  emotionalState: EmotionalState;
  urgency: Urgency;
  essential: boolean;
  period: CoolingPeriodKey;
  notes?: string;
  /** Days ago the decision was logged. */
  daysAgo: number;
  /** null => still cooling off. Otherwise days after logging it was resolved. */
  resolvedAfterDays: number | null;
  reflection?: {
    stillNeeded: boolean;
    affordable: boolean;
    planned: boolean;
    affectsGoal: boolean;
    finalDecision: "APPROVED" | "RECONSIDERED" | "CANCELLED";
    text: string;
  };
};

const SEEDS: Seed[] = [
  // ── Resolved: reconsidered → resilience wins ──────────────────────────────
  {
    title: "Gaming laptop upgrade",
    amount: 1899,
    category: "Electronics",
    reason: "My current laptop struggles with video editing and I keep waiting on renders.",
    emotionalState: "excited",
    urgency: "high",
    essential: false,
    period: "7d",
    notes: "Could rent a machine instead, or use the free trial of the cloud editor.",
    daysAgo: 34,
    resolvedAfterDays: 7,
    reflection: {
      stillNeeded: false,
      affordable: false,
      planned: false,
      affectsGoal: true,
      finalDecision: "RECONSIDERED",
      text: "The renders finished on the old laptop after all. I would have been annoyed by this purchase.",
    },
  },
  {
    title: "Second pair of running shoes",
    amount: 240,
    category: "Clothing",
    reason: "My current pair is worn out and my shins hurt on long runs.",
    emotionalState: "neutral",
    urgency: "low",
    essential: true,
    period: "24h",
    daysAgo: 28,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: true,
      affordable: true,
      planned: true,
      affectsGoal: false,
      finalDecision: "APPROVED",
      text: "Actually a need, and planned. Comfortable with this one.",
    },
  },
  {
    title: "Weekend city break",
    amount: 780,
    category: "Travel",
    reason: "Would be nice to get away before the quarter ends.",
    emotionalState: "stressed",
    urgency: "high",
    essential: false,
    period: "7d",
    daysAgo: 25,
    resolvedAfterDays: 7,
    reflection: {
      stillNeeded: false,
      affordable: false,
      planned: false,
      affectsGoal: true,
      finalDecision: "RECONSIDERED",
      text: "Booking this would have been pure stress spending. Stayed home and reset instead.",
    },
  },

  // ── Still cooling off → shows on the dashboard timer ──────────────────────
  {
    title: "Mechanical keyboard",
    amount: 165,
    category: "Electronics",
    reason: "My current one is fine honestly, but the new one looks really satisfying to type on.",
    emotionalState: "impulsive",
    urgency: "high",
    essential: false,
    period: "3d",
    notes: "Watched a review at 1am. That should tell me something.",
    daysAgo: 0,
    resolvedAfterDays: null,
  },
  {
    title: "Annual streaming bundle",
    amount: 340,
    category: "Subscriptions",
    reason: "Saves money versus my four separate subscriptions, supposedly.",
    emotionalState: "calm",
    urgency: "low",
    essential: false,
    period: "24h",
    daysAgo: 0,
    resolvedAfterDays: null,
  },

  // ── Resolved: approved ────────────────────────────────────────────────────
  {
    title: "Car brake pads and service",
    amount: 420,
    category: "Vehicle",
    reason: "The grinding noise means I need it done before it damages the discs.",
    emotionalState: "calm",
    urgency: "medium",
    essential: true,
    period: "24h",
    daysAgo: 20,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: true,
      affordable: true,
      planned: true,
      affectsGoal: false,
      finalDecision: "APPROVED",
      text: "Safety issue with a clear quote. Correct call.",
    },
  },
  {
    title: "Therapy sessions (six weeks)",
    amount: 600,
    category: "Health",
    reason: "I have been meaning to start, and delaying keeps it at the back of my mind.",
    emotionalState: "anxious",
    urgency: "medium",
    essential: true,
    period: "24h",
    daysAgo: 18,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: true,
      affordable: true,
      planned: true,
      affectsGoal: false,
      finalDecision: "APPROVED",
      text: "Hard to start but I am glad I did. Anxiety did not go away on its own.",
    },
  },
  {
    title: "Standing desk converter",
    amount: 320,
    category: "Home",
    reason: "My back has hurt for weeks and I sit all day.",
    emotionalState: "neutral",
    urgency: "low",
    essential: true,
    period: "24h",
    daysAgo: 14,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: true,
      affordable: true,
      planned: true,
      affectsGoal: false,
      finalDecision: "APPROVED",
      text: "Solved a daily problem. Good spend.",
    },
  },
  {
    title: "Gym membership, 6 months",
    amount: 270,
    category: "Health",
    reason: "Want to get back into a routine, and January is when I always start.",
    emotionalState: "excited",
    urgency: "low",
    essential: false,
    period: "3d",
    daysAgo: 11,
    resolvedAfterDays: 3,
    reflection: {
      stillNeeded: true,
      affordable: true,
      planned: false,
      affectsGoal: false,
      finalDecision: "APPROVED",
      text: "I have started twice before in February instead. Still worth trying.",
    },
  },

  // ── Resolved: reconsidered (repeat category) ──────────────────────────────
  {
    title: "Third pair of sneakers this year",
    amount: 145,
    category: "Clothing",
    reason: "The other two are already barely worn, but these are a different colour.",
    emotionalState: "impulsive",
    urgency: "high",
    essential: false,
    period: "3d",
    daysAgo: 8,
    resolvedAfterDays: 3,
    reflection: {
      stillNeeded: false,
      affordable: true,
      planned: false,
      affectsGoal: false,
      finalDecision: "RECONSIDERED",
      text: "Third pair this year. The rule was right — this is a habit, not a need.",
    },
  },
  {
    title: "Late-night food delivery",
    amount: 68,
    category: "Food & Dining",
    reason: "Stress eating after a bad call at work.",
    emotionalState: "sad",
    urgency: "high",
    essential: false,
    period: "24h",
    daysAgo: 5,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: false,
      affordable: true,
      planned: false,
      affectsGoal: false,
      finalDecision: "CANCELLED",
      text: "Made soup instead. Same comfort, a fraction of the cost.",
    },
  },
  {
    title: "Streaming service trial",
    amount: 22,
    category: "Subscriptions",
    reason: "A friend recommended it and the trial is free, so it costs nothing.",
    emotionalState: "neutral",
    urgency: "low",
    essential: false,
    period: "24h",
    daysAgo: 4,
    resolvedAfterDays: 1,
    reflection: {
      stillNeeded: false,
      affordable: true,
      planned: false,
      affectsGoal: false,
      finalDecision: "RECONSIDERED",
      text: "Free trials are how you end up paying. Did not start it.",
    },
  },
];

function daysAgo(days: number, hours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
}

async function main() {
  console.log("→ Seeding demo data…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo User", passwordHash },
    create: { name: "Demo User", email: DEMO_EMAIL, passwordHash },
  });

  // Reset demo data so re-running is idempotent.
  await prisma.decision.deleteMany({ where: { userId: user.id } });
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...SETTINGS },
    update: SETTINGS,
  });

  await prisma.rule.deleteMany({ where: { userId: user.id } });
  await prisma.rule.createMany({
    data: RULE_KEYS.map((key) => ({
      userId: user.id,
      key,
      name: RULE_CATALOGUE[key].name,
      description: RULE_CATALOGUE[key].description,
      enabled: true,
    })),
  });

  const enabled = Object.fromEntries(RULE_KEYS.map((k) => [k, true])) as Record<
    (typeof RULE_KEYS)[number],
    boolean
  >;

  let created = 0;
  let reconsidered = 0;
  let approved = 0;
  let cancelled = 0;
  let coolingOff = 0;

  for (const seed of SEEDS) {
    const createdAt = daysAgo(seed.daysAgo, seed.daysAgo === 0 ? 3 : 0);
    const hours = COOLING_PERIOD_DETAILS[seed.period].hours;

    // Count prior same-category decisions, mirroring the live Rule 4 logic.
    const recentCategoryCount = SEEDS.filter(
      (s) =>
        s.category === seed.category &&
        s.daysAgo < seed.daysAgo &&
        s.daysAgo > seed.daysAgo - SETTINGS.categoryWindowDays,
    ).length;

    const advice = evaluateRules(
      {
        amount: seed.amount,
        category: seed.category,
        emotionalState: seed.emotionalState,
        urgency: seed.urgency,
        essential: seed.essential,
        coolingOffPeriod: seed.period,
        recentCategoryCount,
      },
      { ...SETTINGS, enabled },
    );

    const coolingOffEndsAt = new Date(createdAt.getTime() + hours * 3600 * 1000);

    const status =
      seed.resolvedAfterDays === null
        ? "COOLING_OFF"
        : seed.reflection!.finalDecision === "APPROVED"
          ? "APPROVED"
          : seed.reflection!.finalDecision === "CANCELLED"
            ? "CANCELLED"
            : "RECONSIDERED";

    let resilienceShown = false;
    let reflectionBody: string | null = null;

    if (seed.resolvedAfterDays !== null && seed.reflection) {
      const outcome = evaluateResilience(seed.reflection.finalDecision, {
        stillNeeded: seed.reflection.stillNeeded,
        affordable: seed.reflection.affordable,
        planned: seed.reflection.planned,
        affectsGoal: seed.reflection.affectsGoal,
      });
      resilienceShown = outcome.resilience;
      reflectionBody = `${seed.reflection.text}\n\n${outcome.note}`;

      if (status === "RECONSIDERED") reconsidered++;
      if (status === "APPROVED") approved++;
      if (status === "CANCELLED") cancelled++;
    } else {
      coolingOff++;
    }

    await prisma.decision.create({
      data: {
        userId: user.id,
        title: seed.title,
        amount: seed.amount,
        category: seed.category,
        reason: seed.reason,
        emotionalState: seed.emotionalState,
        urgency: seed.urgency,
        essential: seed.essential,
        notes: seed.notes ?? null,
        coolingOffPeriod: seed.period,
        coolingOffEndsAt,
        status,
        ruleFlags: JSON.stringify(advice.firedKeys),
        resilienceShown,
        createdAt,
        updatedAt: createdAt,
        ...(seed.resolvedAfterDays !== null
          ? {
              reflection: {
                create: {
                  stillNeeded: seed.reflection!.stillNeeded,
                  affordable: seed.reflection!.affordable,
                  planned: seed.reflection!.planned,
                  affectsGoal: seed.reflection!.affectsGoal,
                  finalDecision: status,
                  reflection: reflectionBody,
                  createdAt: new Date(
                    createdAt.getTime() +
                      seed.resolvedAfterDays! * 24 * 3600 * 1000,
                  ),
                },
              },
            }
          : {}),
      },
    });

    created++;
  }

  console.log(`✓ Created ${created} decisions for ${DEMO_EMAIL}`);
  console.log(
    `  ${approved} approved · ${reconsidered} reconsidered · ${cancelled} cancelled · ${coolingOff} cooling off`,
  );
  console.log(`\n  Sign in with:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
}

main()
  .catch((err) => {
    console.error("✗ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
