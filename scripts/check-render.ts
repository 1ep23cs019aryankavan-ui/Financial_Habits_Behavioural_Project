/** Quick render check for a real cooling-off decision page. */
const BASE = "http://localhost:3000";

(async () => {
  let cookie = "";
  const res0 = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@steady.app", password: "demo1234" }),
  });
  cookie = (res0.headers.get("set-cookie") ?? "").match(/fh_session=[^;]+/)?.[0] ?? "";

  const jr = await fetch(`${BASE}/api/journal?status=COOLING_OFF`, {
    headers: { Cookie: cookie },
  });
  const { entries } = await jr.json();
  // Prefer a decision that actually tripped rules, so the flags panel renders.
  const flagged = entries.find((e) => JSON.parse(e.ruleFlags || "[]").length > 0);
  const first = flagged ?? entries[0];
  console.log(`Cooling-off decisions: ${entries.length}`);
  console.log(
    `Inspecting: "${first.title}" (${first.category}) — flags: ${first.ruleFlags}`,
  );

  const page = await fetch(`${BASE}/decisions/${first.id}`, {
    headers: { Cookie: cookie },
  });
  const html = await page.text();

  const checks: [string, boolean][] = [
    ["HTTP 200", page.status === 200],
    ["title rendered", html.includes(first.title)],
    ["timer placeholder rendered", html.includes("--:--:--")],
    ["approval-locked notice", html.includes("Approval is locked")],
    ["reconsideration questions present", html.includes("Do I still need this?")],
    ["cooled-off questions disabled", html.includes("cursor-not-allowed opacity-50")],
    ["rule flags listed", html.includes("Rules that fired")],
    ["original reason shown", html.includes("Reason given")],
    ["delete action offered", html.includes("Delete")],
    ["status indicator emoji", /🟡|Cooling off/.test(html)],
  ];

  console.log();
  let bad = 0;
  for (const [name, ok] of checks) {
    if (!ok) bad++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log(`\n${checks.length - bad}/${checks.length} render checks passed`);

  // A completed decision should show the reflection summary instead.
  const done = await fetch(`${BASE}/api/journal?status=RECONSIDERED`, {
    headers: { Cookie: cookie },
  });
  const { entries: doneEntries } = await done.json();
  if (doneEntries.length) {
    const d = doneEntries[0];
    const p2 = await fetch(`${BASE}/decisions/${d.id}`, { headers: { Cookie: cookie } });
    const h2 = await p2.text();
    console.log(`\nCompleted decision "${d.title}":`);
    console.log(`  ${h2.includes("Your reflection") ? "PASS" : "FAIL"}  reflection summary shown`);
    console.log(`  ${h2.includes("Cooling-off period complete") ? "PASS" : "FAIL"}  completed state shown`);
    console.log(`  ${!/Do I still need this/.test(h2) ? "PASS" : "FAIL"}  questions no longer offered`);
  }
  process.exit(0);
})();