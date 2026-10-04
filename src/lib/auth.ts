import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { RULE_CATALOGUE, RULE_KEYS, type RuleKey } from "./constants";

export const SESSION_COOKIE = "fh_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Creates a session row and sets the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

/** Returns the current user, or null. Also prunes the expired session if present. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/** For API routes: throws a 401-shaped error when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("You must be signed in to do that.", 401);
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Creates the per-user settings + rule rows on first sign-in. */
export async function ensureUserDefaults(userId: string): Promise<void> {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!existing) {
    await prisma.userSettings.create({ data: { userId } });
  }

  const ruleCount = await prisma.rule.count({ where: { userId } });
  if (ruleCount === 0) {
    await prisma.rule.createMany({
      data: RULE_KEYS.map((key) => ({
        userId,
        key,
        name: RULE_CATALOGUE[key].name,
        description: RULE_CATALOGUE[key].description,
        enabled: true,
      })),
    });
  }
}

export type UserSettingsData = {
  amountThreshold: number;
  defaultCoolingOffHours: number;
  categoryWindowDays: number;
  categoryRepeatLimit: number;
};

export const DEFAULT_SETTINGS: UserSettingsData = {
  amountThreshold: 500,
  defaultCoolingOffHours: 24,
  categoryWindowDays: 30,
  categoryRepeatLimit: 3,
};

export async function getSettings(userId: string): Promise<UserSettingsData> {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  if (!row) return DEFAULT_SETTINGS;
  return {
    amountThreshold: row.amountThreshold,
    defaultCoolingOffHours: row.defaultCoolingOffHours,
    categoryWindowDays: row.categoryWindowDays,
    categoryRepeatLimit: row.categoryRepeatLimit,
  };
}

export async function getEnabledRules(
  userId: string,
): Promise<Record<RuleKey, boolean>> {
  const rules = await prisma.rule.findMany({ where: { userId } });
  const map = Object.fromEntries(
    RULE_KEYS.map((k) => [k, true]),
  ) as Record<RuleKey, boolean>;
  for (const rule of rules) {
    if ((RULE_KEYS as readonly string[]).includes(rule.key)) {
      map[rule.key as RuleKey] = rule.enabled;
    }
  }
  return map;
}
