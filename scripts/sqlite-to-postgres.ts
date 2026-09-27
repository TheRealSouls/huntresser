/**
 * One-time copy of an old SQLite database (from before the move to
 * PostgreSQL) into the PostgreSQL database in DATABASE_URL. The target must
 * be empty: run `npx prisma db push` against it first.
 *
 *   npm run db:from-sqlite                     (reads prisma/dev.db)
 *   npm run db:from-sqlite -- path/to/old.db
 */
import { DatabaseSync } from "node:sqlite";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

// Parents before children, so foreign keys are satisfied.
const ORDER = [
  "User",
  "PsnAccount",
  "Game",
  "TrophyGroup",
  "Trophy",
  "UserGame",
  "UserTrophy",
  "Friendship",
  "SyncJob",
  "Guide",
  "GuideStep",
  "Tip",
  "TipVote",
  "Session",
  "SessionMember",
  "PsnTitleSync",
  "PsnPlayer",
  "PsnPlayerTitle",
  "PsnPlayerSnapshot",
  "PsnAuthState",
];

async function main() {
  const file = process.argv[2] ?? "prisma/dev.db";
  if (!process.env.DATABASE_URL?.startsWith("postgres")) throw new Error("DATABASE_URL must point at the PostgreSQL database.");
  const existing = (await prisma.user.count()) + (await prisma.game.count());
  if (existing > 0) throw new Error("The PostgreSQL database already has data. Copy only into an empty database.");

  const sqlite = new DatabaseSync(file, { readOnly: true });
  const tables = new Set(
    (sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name),
  );
  const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

  for (const name of ORDER) {
    const model = models.get(name);
    if (!model || !tables.has(name)) {
      console.log(`${name}: not in the old database, skipped`);
      continue;
    }
    const scalars = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    const data = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const f of scalars) {
        const v = row[f.name];
        if (v === undefined) continue; // column added after this database was created: use the default
        if (v === null) out[f.name] = null;
        else if (f.type === "DateTime") out[f.name] = new Date(typeof v === "string" && !/^\d+$/.test(v) ? v : Number(v));
        else if (f.type === "Boolean") out[f.name] = v === 1 || v === "1" || v === true;
        else if (f.type === "Int") out[f.name] = Number(v);
        else if (f.type === "Float") out[f.name] = Number(v);
        else out[f.name] = v;
      }
      return out;
    });
    const delegate = (prisma as unknown as Record<string, { createMany(args: { data: unknown[] }): Promise<unknown> }>)[
      name[0].toLowerCase() + name.slice(1)
    ];
    for (let i = 0; i < data.length; i += 1000) await delegate.createMany({ data: data.slice(i, i + 1000) });
    console.log(`${name}: ${data.length} rows`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
