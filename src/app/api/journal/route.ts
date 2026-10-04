import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import {
  getCategoryBreakdown,
  getJournal,
  getOutcomeBreakdown,
  getStats,
  getTrend,
} from "@/lib/queries";
import { journalQuerySchema } from "@/lib/validation";

/** Journal list with search/filter/sort. */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const query = journalQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
    });

    const entries = await getJournal(user.id, query);
    return ok({ entries });
  });
}

/** Everything the dashboard needs in one round-trip. */
export async function PUT() {
  return handle(async () => {
    const user = await requireUser();

    const [stats, categories, outcomes, trend, recent] = await Promise.all([
      getStats(user.id),
      getCategoryBreakdown(user.id),
      getOutcomeBreakdown(user.id),
      getTrend(user.id),
      getJournal(user.id, { sort: "newest" }),
    ]);

    return ok({
      stats,
      categories,
      outcomes,
      trend,
      recent: recent.slice(0, 5),
    });
  });
}
