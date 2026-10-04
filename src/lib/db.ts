import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Resolve the database location for the driver adapter.
 *
 * `better-sqlite3` resolves relative paths against process.cwd(), while Prisma
 * resolves `file:` URLs against the schema directory. Normalising here keeps a
 * single `DATABASE_URL` working for both the CLI and the runtime.
 */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (!url.startsWith("file:")) {
    // A non-file URL means the datasource was switched to a server database.
    return url;
  }

  const raw = url.slice("file:".length).trim();
  if (raw === ":memory:" || raw.startsWith(":memory:")) return raw;

  // Already absolute (Windows drive letter or POSIX root)?
  if (path.isAbsolute(raw)) return raw;

  // turbopackIgnore: this is a server-side runtime DB path, not a build-time
  // module reference, so the bundler must not trace it as project input.
  return path.join(/* turbopackIgnore: true */ process.cwd(), raw);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
