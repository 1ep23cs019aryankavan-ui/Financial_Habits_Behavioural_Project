/**
 * End-to-end flow verification against a running dev server.
 * Run: node scripts/verify.mjs
 */
const BASE = "http://localhost:3000";

let cookie = "";
let pass = 0;
let fail = 0;
const failures = [];

function log(ok, name, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/fh_session=[^;]+/);
    if (match) cookie = match[0];
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, text };
}

const uniq = Math.random().toString(36).slice(2, 8);

(async () => {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  section("Authentication");

  {
    const r = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Harness",
        email: `test-${uniq}@example.com`,
        password: "supersecret123",
      }),
    });
    log(
      r.status === 201 && !!r.json?.user?.id,
      "register new user",
      `status ${r.status}`,
    );
  }

  {
    const r = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Dupe",
        email: `test-${uniq}@example.com`,
        password: "supersecret123",
      }),
    });
    log(r.status === 409, "duplicate email rejected", `status ${r.status}`);
  }

  {
    const r = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "X", email: "not-an-email", password: "short" }),
    });
    const hasFieldErrors =
      !!r.json?.fieldErrors && Object.keys(r.json.fieldErrors).length > 0;
    log(r.status === 400 && hasFieldErrors, "register validation errors", `status ${r.status}`);
  }

  cookie = "";
  {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: `test-${uniq}@example.com`, password: "wrongpass" }),
    });
    log(r.status === 401, "wrong password rejected", `status ${r.status}`);
  }

  {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: `test-${uniq}@example.com`,
        password: "supersecret123",
      }),
    });
    log(r.status === 200 && !!cookie, "login sets session cookie", `status ${r.status}`);
  }

  {
    const r = await api("/api/journal");
    log(r.status === 200 && Array.isArray(r.json.entries), "authenticated journal fetch", `status ${r.status}`);
  }

  // ── 2. Rule engine ────────────────────────────────────────────────────────
  section("Rule engine (preview)");

  {
    // Amount above threshold (500 default) + non-essential + high urgency + angry
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 2400,
        category: "Electronics",
        emotionalState: "angry",
        urgency: "high",
        essential: false,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    const want = ["HIGH_AMOUNT", "EMOTIONAL_STATE", "URGENT_NON_ESSENTIAL"];
    const allPresent = want.every((k) => fired.includes(k));
    log(
      r.status === 200 && allPresent,
      "rules 1+2+3 fire on high-amount/angry/urgent-non-essential",
      `fired: [${fired.join(", ")}]`,
    );
    log(
      r.json?.advice?.riskBand === "high",
      "risk band is high for 3 severe rules",
      `band ${r.json?.advice?.riskBand}, score ${r.json?.advice?.impulseRiskScore}`,
    );
    log(
      r.json?.advice?.suggestedPeriod === "7d",
      "suggested period escalates to 7d",
      `got ${r.json?.advice?.suggestedPeriod}`,
    );
  }

  {
    // Small, calm, planned, essential => nothing should fire
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 25,
        category: "Other",
        emotionalState: "calm",
        urgency: "low",
        essential: true,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    log(
      r.status === 200 && fired.length === 0,
      "no flags for calm/planned/small decision",
      `fired: [${fired.join(", ")}]`,
    );
    log(r.json?.advice?.riskBand === "low", "risk band low", `band ${r.json?.advice?.riskBand}`);
  }

  // ── 3. Decision creation + cooling-off ────────────────────────────────────
  section("Decision creation & cooling-off gate");

  let decisionId = null;

  {
    const r = await api("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        title: "Mechanical keyboard",
        amount: 165,
        category: "Electronics",
        reason: "Wanted it at 1am after watching a review.",
        emotionalState: "impulsive",
        urgency: "high",
        essential: false,
        coolingOffPeriod: "1h",
        notes: "Rental option exists.",
      }),
    });
    decisionId = r.json?.decision?.id ?? null;
    const endsAt = r.json?.decision?.coolingOffEndsAt;
    const future = endsAt && new Date(endsAt).getTime() > Date.now();
    log(
      r.status === 200 && !!decisionId && r.json.decision.status === "COOLING_OFF",
      "create decision starts COOLING_OFF",
      `status ${r.status}`,
    );
    log(!!future, "coolingOffEndsAt is in the future");
  }

  {
    const r = await api("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        title: "ab",
        amount: -5,
        category: "Nope",
        reason: "hi",
        emotionalState: "furious",
        urgency: "whenever",
        essential: "yes",
        coolingOffPeriod: "99y",
      }),
    });
    const n = Object.keys(r.json?.fieldErrors ?? {}).length;
    log(r.status === 400 && n >= 3, "invalid decision rejected with field errors", `${n} errors`);
  }

  {
    // THE CIRCUIT BREAKER: cannot complete while the timer runs.
    const r = await api(`/api/decisions/${decisionId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        stillNeeded: true,
        affordable: true,
        planned: true,
        affectsGoal: false,
        finalDecision: "APPROVED",
        reflection: "sneaking it in early",
      }),
    });
    log(
      r.status === 423,
      "premature approval BLOCKED (423 Locked)",
      `status ${r.status}: ${r.json?.error ?? ""}`,
    );
  }

  {
    const r = await api(`/api/decisions/${decisionId}`);
    log(
      r.json?.decision?.status === "COOLING_OFF" && r.json?.decision?.reflection === null,
      "blocked attempt left no reflection behind",
      `status ${r.json?.decision?.status}`,
    );
  }

  {
    const r = await api(`/api/decisions/${decisionId}`);
    log(
      r.json?.decision?.status === "COOLING_OFF" &&
        new Date(r.json.decision.coolingOffEndsAt).getTime() > Date.now(),
      "countdown still running after block attempt",
    );
  }

  // ── 4. Completion after cooling-off (simulate elapsed clock) ──────────────
  section("Completion after cooling-off + reflection");

  {
    // Age the record so the period has elapsed, exercising the real gate.
    // Done in-process against the same SQLite file the server uses.
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    const pathMod = await import("node:path");
    const { PrismaClient } = await import("../src/generated/prisma/client");

    const db = new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: pathMod.join(process.cwd(), "prisma/dev.db"),
      }),
    });
    await db.decision.update({
      where: { id: decisionId },
      data: { coolingOffEndsAt: new Date(Date.now() - 60_000) },
    });
    await db.$disconnect();

    const check = await api(`/api/decisions/${decisionId}`);
    const elapsed = new Date(check.json.decision.coolingOffEndsAt).getTime() < Date.now();
    log(elapsed, "aged cooling-off deadline in DB", `now past deadline: ${elapsed}`);
  }

  {
    const r = await api(`/api/decisions/${decisionId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        stillNeeded: false,
        affordable: true,
        planned: false,
        affectsGoal: false,
        finalDecision: "RECONSIDERED",
        reflection: "Did not need it after all.",
      }),
    });
    log(
      r.status === 200 && r.json?.decision?.status === "RECONSIDERED",
      "completion allowed after period elapsed",
      `status ${r.json?.decision?.status}`,
    );
    log(r.json?.resilience === true, "changed mind recorded as behavioural resilience");
    log(
      !!r.json?.decision?.reflection?.reflection,
      "reflection persisted",
      (r.json?.decision?.reflection?.reflection ?? "").slice(0, 48) + "…",
    );
  }

  {
    const r = await api(`/api/decisions/${decisionId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        stillNeeded: true, affordable: true, planned: true,
        affectsGoal: false, finalDecision: "APPROVED",
      }),
    });
    log(r.status === 409, "double-completion rejected", `status ${r.status}`);
  }

  {
    const r = await api(`/api/decisions/${decisionId}`, { method: "DELETE" });
    log(r.status === 204, "delete decision", `status ${r.status}`);
  }

  // ── 5. Rule 4 (repeat category) ──────────────────────────────────────────
  section("Rule 4 — repeat spending habit");

  for (let i = 0; i < 3; i++) {
    await api("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        title: `Sneakers ${i + 1}`,
        amount: 120,
        category: "Clothing",
        reason: "Another colour, honestly impulsive.",
        emotionalState: "impulsive",
        urgency: "high",
        essential: false,
        coolingOffPeriod: "7d",
      }),
    });
  }

  {
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 120, category: "Clothing",
        emotionalState: "calm", urgency: "low", essential: false,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    log(
      fired.includes("REPEAT_CATEGORY"),
      "REPEAT_CATEGORY fires on 4th same-category decision",
      `fired: [${fired.join(", ")}]`,
    );
  }

  // ── 6. Journal search / filter / sort ─────────────────────────────────────
  section("Journal search, filter, sort");

  for (const title of ["Winter jacket", "Noise cancelling headphones", "Desk lamp"]) {
    await api("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        title,
        amount: 200,
        category: title === "Desk lamp" ? "Home" : "Clothing",
        reason: "Planned replacement for a broken item at home.",
        emotionalState: "calm",
        urgency: "low",
        essential: true,
        coolingOffPeriod: "7d",
      }),
    });
  }

  {
    const r = await api("/api/journal?q=headphones");
    const titles = (r.json.entries ?? []).map((e) => e.title);
    log(
      r.status === 200 && titles.length === 1 && titles[0] === "Noise cancelling headphones",
      "search by title",
      `${titles.length} result(s)`,
    );
  }

  {
    const r = await api("/api/journal?q=broken");
    log(
      (r.json.entries ?? []).length === 3,
      "search matches reason text across entries",
      `${(r.json.entries ?? []).length} result(s)`,
    );
  }

  {
    const r = await api("/api/journal?category=Home");
    const cats = [...new Set((r.json.entries ?? []).map((e) => e.category))];
    log(
      r.status === 200 && cats.length === 1 && cats[0] === "Home",
      "filter by category",
      `categories: [${cats.join(", ")}]`,
    );
  }

  {
    const r = await api("/api/journal?status=COOLING_OFF");
    const allCooling = (r.json.entries ?? []).every((e) => e.status === "COOLING_OFF");
    log(
      r.status === 200 && allCooling && (r.json.entries ?? []).length > 0,
      "filter by status",
      `${(r.json.entries ?? []).length} cooling off`,
    );
  }

  {
    const r = await api("/api/journal?sort=amount-desc");
    const amounts = (r.json.entries ?? []).map((e) => e.amount);
    const sorted = [...amounts].sort((a, b) => b - a);
    log(
      amounts.length > 1 && JSON.stringify(amounts) === JSON.stringify(sorted),
      "sort by amount descending",
      `top ${amounts[0]}`,
    );
  }

  {
    const r = await api("/api/journal?status=BOGUS");
    log(r.status === 400, "invalid status filter rejected", `status ${r.status}`);
  }

  // ── 7. Dashboard stats ────────────────────────────────────────────────────
  section("Dashboard statistics");

  {
    const r = await api("/api/journal", { method: "PUT" });
    const s = r.json?.stats;
    const consistent =
      s &&
      s.totalDecisions === (r.json.categories ?? []).reduce((n, c) => n + c.count, 0) &&
      s.totalLogged === s.completed + s.reconsidered + s.cancelled &&
      s.resiliencePercentage ===
        Math.round((s.reconsidered / Math.max(1, s.totalLogged)) * 100);
    log(!!s, "dashboard payload returned", `total ${s?.totalDecisions}`);
    log(!!consistent, "stats are internally consistent");
    log(
      typeof s?.avgCoolingOffHours === "number" && s.avgCoolingOffHours > 0,
      "average cooling-off computed from real records",
      `${s?.avgCoolingOffHours}h`,
    );
    log(
      Array.isArray(r.json?.trend) && r.json.trend.length === 8,
      "8-week trend buckets present",
      `${r.json?.trend?.length} buckets`,
    );
    log(
      (r.json?.outcomes?.approved ?? 0) + (r.json?.outcomes?.reconsidered ?? 0) +
        (r.json?.outcomes?.cancelled ?? 0) === s?.totalLogged,
      "outcome chart sums match resolved total",
    );
  }

  // ── 8. Settings & rule toggles ────────────────────────────────────────────
  section("Settings & rule toggles");

  {
    const r = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        amountThreshold: 1000,
        defaultCoolingOffHours: 72,
        categoryWindowDays: 14,
        categoryRepeatLimit: 2,
      }),
    });
    log(r.status === 200 && r.json.settings.amountThreshold === 1000, "thresholds saved");
  }

  {
    // Threshold now 1000, so 2400 still fires but 800 should not.
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 800, category: "Other",
        emotionalState: "calm", urgency: "low", essential: true,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    log(
      !fired.includes("HIGH_AMOUNT"),
      "raising threshold stops HIGH_AMOUNT firing",
      `fired: [${fired.join(", ")}]`,
    );
  }

  {
    const r = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ key: "HIGH_AMOUNT", enabled: false }),
    });
    log(r.status === 200 && r.json.rule.enabled === false, "rule disabled via settings");
  }

  {
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 2400, category: "Other",
        emotionalState: "angry", urgency: "high", essential: false,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    log(
      !fired.includes("HIGH_AMOUNT"),
      "disabled rule produces no advice",
      `fired: [${fired.join(", ")}]`,
    );
  }

  {
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ key: "HIGH_AMOUNT", enabled: true }),
    });
    const r = await api("/api/decisions", {
      method: "PUT",
      body: JSON.stringify({
        amount: 2400, category: "Other",
        emotionalState: "angry", urgency: "high", essential: false,
      }),
    });
    const fired = r.json?.advice?.firedKeys ?? [];
    log(fired.includes("HIGH_AMOUNT"), "re-enabled rule fires again");
  }

  {
    const r = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ amountThreshold: -1, defaultCoolingOffHours: 0, categoryWindowDays: 0, categoryRepeatLimit: 0 }),
    });
    log(r.status === 400, "invalid settings rejected", `status ${r.status}`);
  }

  // ── 9. Auth boundary ──────────────────────────────────────────────────────
  section("Auth boundary & ownership");

  {
    const saved = cookie;
    cookie = "";
    const r = await api("/api/journal");
    log(r.status === 401, "journal requires auth", `status ${r.status}`);

    const r2 = await api("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        title: "Sneaky", amount: 10, category: "Other", reason: "no auth at all",
        emotionalState: "calm", urgency: "low", essential: true, coolingOffPeriod: "1h",
      }),
    });
    log(r2.status === 401, "decision creation requires auth", `status ${r2.status}`);
    cookie = saved;
  }

  {
    // Log in as the demo user and confirm cross-user isolation.
    const saved = cookie;
    cookie = "";
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@steady.app", password: "demo1234" }),
    });
    const r = await api(`/api/decisions/${decisionId}`);
    log(r.status === 404, "another user cannot read this decision", `status ${r.status}`);

    const del = await api(`/api/decisions/${decisionId}`, { method: "DELETE" });
    log(del.status === 404, "another user cannot delete this decision", `status ${del.status}`);
    cookie = saved;
  }

  // ── 10. Pages render ──────────────────────────────────────────────────────
  section("Page rendering");

  for (const [path, needle] of [
    ["/login", "Sign in"],
    ["/register", "Create your account"],
    ["/dashboard", "Active cooling-off"],
    ["/decisions/new", "Behaviour check"],
    ["/journal", "Decision journal"],
    ["/settings", "Behaviour rules"],
  ]) {
    const res = await fetch(`${BASE}${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: "manual",
    });
    const html = await res.text();
    const redirected = res.status === 307 || res.status === 302;
    const okPage = res.status === 200 && html.includes(needle);
    log(okPage || redirected, `GET ${path}`, redirected ? "redirected (expected when signed out)" : `status ${res.status}`);
  }

  // ── 11. Responsive / viewport metadata ─────────────────────────────────────
  section("Responsive setup");

  {
    const res = await fetch(`${BASE}/dashboard`, { headers: { Cookie: cookie } });
    const html = await res.text();

    const checks = [
      [/<meta name="viewport"[^>]*width=device-width/.test(html), "viewport meta is device-width"],
      [html.includes("lg:hidden"), "mobile-only bottom nav present"],
      [html.includes("lg:flex"), "desktop sidebar breakpoint present"],
      [html.includes("pb-24"), "main has bottom padding to clear mobile nav"],
      [/grid-cols-2|grid-cols-4|sm:grid-cols/.test(html), "responsive grid utilities in use"],
    ] as const;

    for (const [ok, name] of checks) log(ok, name);
  }

  // ── 12. Cleanup ───────────────────────────────────────────────────────────
  {
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    const pathMod = await import("node:path");
    const { PrismaClient } = await import("../src/generated/prisma/client");

    const db = new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: pathMod.join(process.cwd(), "prisma/dev.db"),
      }),
    });

    const removed = await db.user.deleteMany({
      where: { email: { startsWith: `test-` } },
    });
    await db.$disconnect();
    log(true, "cleaned up test accounts", `${removed.count} removed`);
  }

  // ── 13. Logout ────────────────────────────────────────────────────────────
  section("Logout");

  {
    const r = await api("/api/auth/logout", { method: "POST" });
    log(r.status === 200, "logout succeeds", `status ${r.status}`);
    cookie = "";
    const after = await api("/api/journal");
    log(after.status === 401, "session invalid after logout", `status ${after.status}`);
  }

  console.log(`\n${"=".repeat(46)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  Failures:");
    failures.forEach((f) => console.log(`   - ${f}`));
  }
  console.log(`${"=".repeat(46)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});