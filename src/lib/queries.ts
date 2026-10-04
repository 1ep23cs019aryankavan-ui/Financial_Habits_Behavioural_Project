import "server-only";
import { prisma } from "./db";
import {
  COOLING_PERIOD_MAP,
  type CoolingPeriodKey,
  type DecisionStatus,
} from "./constants";
import type { JournalQuery } from "./validation";

export type JournalEntry = Awaited<ReturnType<typeof getJournal>>[number];

const SORTS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  "amount-desc": { amount: "desc" },
  "amount-asc": { amount: "asc" },
} as const;

/**
 * Journal search/filter. Text search is case-insensitive across title, reason,
 * notes and reflection — the fields a user would actually remember.
 */
export async function getJournal(userId: string, query: JournalQuery = {}) {
  const { q, status, category, sort = "newest" } = query;

  return prisma.decision.findMany({
    where: {
      userId,
      ...(status ? { status: status as DecisionStatus } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { reason: { contains: q } },
              { notes: { contains: q } },
              { category: { contains: q } },
              // `reflection` is a relation, so the scalar filter must be nested.
              { reflection: { is: { reflection: { contains: q } } } },
            ],
          }
        : {}),
    },
    include: { reflection: true },
    orderBy: SORTS[sort] ?? SORTS.newest,
    take: 200,
  });
}

export type DashboardStats = {
  activeCoolingOff: number;
  completed: number;
  reconsidered: number;
  cancelled: number;
  highRiskFlags: number;
  totalDecisions: number;
  totalLogged: number;
  resiliencePercentage: number;
  approvalPercentage: number;
  avgCoolingOffHours: number;
};

export async function getStats(userId: string): Promise<DashboardStats> {
  const [
    totalDecisions,
    activeCoolingOff,
    approved,
    reconsidered,
    cancelled,
    flagged,
    periodRows,
  ] = await Promise.all([
    prisma.decision.count({ where: { userId } }),
    prisma.decision.count({ where: { userId, status: "COOLING_OFF" } }),
    prisma.decision.count({ where: { userId, status: "APPROVED" } }),
    prisma.decision.count({ where: { userId, status: "RECONSIDERED" } }),
    prisma.decision.count({ where: { userId, status: "CANCELLED" } }),
    prisma.decision.count({
      where: { userId, ruleFlags: { not: "[]" }, status: { not: "CANCELLED" } },
    }),
    prisma.decision.findMany({
      where: { userId },
      select: { coolingOffPeriod: true },
    }),
  ]);

  // Resilience = share of resolved decisions where the user changed their mind.
  const resolved = approved + reconsidered + cancelled;

  const totalHours = periodRows.reduce(
    (sum, row) => sum + (COOLING_PERIOD_MAP[row.coolingOffPeriod as CoolingPeriodKey]?.hours ?? 0),
    0,
  );

  return {
    activeCoolingOff,
    completed: approved,
    reconsidered,
    cancelled,
    highRiskFlags: flagged,
    totalDecisions,
    totalLogged: resolved,
    resiliencePercentage: resolved === 0 ? 0 : Math.round((reconsidered / resolved) * 100),
    approvalPercentage: resolved === 0 ? 0 : Math.round((approved / resolved) * 100),
    avgCoolingOffHours:
      periodRows.length === 0 ? 0 : Math.round(totalHours / periodRows.length),
  };
}

/** Decisions grouped by category, highest spend first. */
export async function getCategoryBreakdown(userId: string) {
  const rows = await prisma.decision.findMany({
    where: { userId },
    select: { category: true, amount: true, status: true },
  });

  const map = new Map<string, { category: string; total: number; count: number }>();
  for (const row of rows) {
    const entry = map.get(row.category) ?? {
      category: row.category,
      total: 0,
      count: 0,
    };
    entry.total += row.amount;
    entry.count += 1;
    map.set(row.category, entry);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Reconsidered vs approved split for the outcome chart. */
export async function getOutcomeBreakdown(userId: string) {
  const [approved, reconsidered, cancelled] = await Promise.all([
    prisma.decision.count({ where: { userId, status: "APPROVED" } }),
    prisma.decision.count({ where: { userId, status: "RECONSIDERED" } }),
    prisma.decision.count({ where: { userId, status: "CANCELLED" } }),
  ]);
  return { approved, reconsidered, cancelled };
}

/**
 * Weekly resilience trend. Each bucket is the share of that week's resolved
 * decisions that were reconsidered — i.e. did the habit strengthen over time?
 */
export async function getTrend(userId: string, weeks = 8) {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.decision.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      status: { in: ["APPROVED", "RECONSIDERED", "CANCELLED"] },
    },
    select: { status: true, createdAt: true },
  });

  const buckets: { week: string; label: string; resilience: number; decided: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(since);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const inBucket = rows.filter(
      (r) => r.createdAt >= start && r.createdAt < end,
    );
    const reconsidered = inBucket.filter((r) => r.status === "RECONSIDERED").length;

    buckets.push({
      week: start.toISOString(),
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      resilience:
        inBucket.length === 0 ? 0 : Math.round((reconsidered / inBucket.length) * 100),
      decided: inBucket.length,
    });
  }

  return buckets;
}
