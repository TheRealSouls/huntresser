import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { syncUser } from "../src/lib/psn/sync";
import { trophySlugs } from "../src/lib/trophy-slug";
import { hashString, mulberry32, slugify, titleKey } from "../src/lib/utils";
import { ARCHETYPE_EXTRAS, GAMES, USERS, type GameSpec, type TrophySpec } from "./seed-data";

const rnd = mulberry32(20260922);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;

type BuiltTrophy = Omit<TrophySpec, "type"> & { psnTrophyId: number; group: string; type: "PLATINUM" | TrophySpec["type"]; earnedRate: number };

const COLLECT_NAMES = ["Keen Eye", "Treasure Hunter", "Seeker", "Hoarder", "Curator", "Scavenger", "Pathfinder"];
const LOCATIONS = [
  "behind the waterfall at the start of the area",
  "on a ledge above the second checkpoint. Look up",
  "inside the locked room (key found in the previous area)",
  "at the end of the dead-end corridor past the save point",
  "under the broken bridge; drop down from the left side",
  "in the boss arena. Grab it before triggering the fight",
  "on top of the watchtower, reachable via the scaffolding",
  "in a breakable crate next to the merchant",
  "hidden behind a destructible wall (look for the cracks)",
  "at the bottom of the well in the main square",
];
const TIP_BANK = [
  "Do this on your first run. The area it's tied to locks off after the next chapter.",
  "Easiest way I found: lower the difficulty, it doesn't void the trophy.",
  "Took me about 40 minutes. Save before attempting and reload if it goes wrong.",
  "Chapter select works for this, no need for a new playthrough.",
  "The tracker in the menu shows which ones you're missing, so check it before cleanup.",
  "If it doesn't pop, restart the checkpoint; the counter is known to be a bit buggy.",
  "Farm it at the second camp, enemies respawn every rest.",
  "Pair this with the collectible cleanup, you'll pass through the same areas anyway.",
  "Online is still active. Join a session on here and it's done in 20 minutes.",
  "Honestly the hardest trophy in the list. Watch a video of the route first.",
  "Use the stealth approach, enemies won't aggro if you stay in the tall grass.",
  "It popped for me at 98%. Some of the counts include the DLC.",
];

function buildTrophies(spec: GameSpec, gameIdx: number) {
  const r = mulberry32(hashString(spec.title));
  const platRate = clamp(round1(40 - spec.difficulty * 4.5 - spec.hours * 0.12 + (r() - 0.5) * 3), 0.6, 60);
  const rateFor = (hard: number) => round1(clamp(platRate + (93 - platRate) * Math.pow(1 - hard, 1.6), platRate, 96));
  const out: BuiltTrophy[] = [];
  let id = 0;
  const push = (t: Omit<TrophySpec, "type"> & { type: BuiltTrophy["type"] }, earnedRate: number, group = "default") =>
    out.push({ ...t, psnTrophyId: id++, group, earnedRate });

  push({ name: spec.platinum, description: `Obtain all trophies in ${spec.title}.`, type: "PLATINUM" }, platRate);

  spec.chapters.forEach((ch, i) => {
    const last = i === spec.chapters.length - 1;
    const hard = (i / Math.max(1, spec.chapters.length - 1)) * 0.55;
    push(
      {
        name: ch.replace(/^(Chapter \d+|Act [IV]+|Prologue|Finale): /, ""),
        description: last ? `Complete the story of ${spec.title}.` : `Complete ${ch}.`,
        type: last ? "GOLD" : i === Math.floor(spec.chapters.length / 2) ? "SILVER" : "BRONZE",
        hidden: i >= 2 && r() < 0.6,
      },
      rateFor(hard),
    );
  });

  if (spec.hardMode)
    push({ name: spec.hardMode, description: "Complete the game on the highest difficulty.", type: "GOLD", hard: 0.85 }, rateFor(0.85));
  if (spec.speedrun)
    push({ name: spec.speedrun[0], description: `Finish ${spec.speedrun[1]}.`, type: "SILVER", hard: 0.75, speedrun: true }, rateFor(0.75));

  const names = [...COLLECT_NAMES];
  for (const [noun, count, missable] of spec.collectibles) {
    const first = Math.max(3, Math.floor(count / 4));
    push({ name: `${noun.split(" ")[0]} Spotter`, description: `Find ${first} ${noun}.`, type: "BRONZE", collectible: true }, rateFor(0.18));
    const nm = names.splice(Math.floor(r() * names.length), 1)[0];
    push(
      {
        name: nm,
        description: `Find all ${count} ${noun}.`,
        type: count > 40 ? "GOLD" : "SILVER",
        collectible: true,
        missable,
        hard: missable ? 0.7 : 0.55,
      },
      rateFor(missable ? 0.7 : 0.55),
    );
  }

  for (const t of [...ARCHETYPE_EXTRAS[spec.archetype], ...(spec.extras ?? [])]) {
    if (t.online && !spec.online) continue;
    push(t, rateFor(t.hard ?? 0.3));
  }

  spec.dlc?.forEach((d, i) => {
    const group = String(i + 1).padStart(3, "0");
    const base = clamp(platRate * 0.6 + 6, 2, 35);
    for (const t of d.trophies) push(t, round1(clamp(base * (1 - (t.hard ?? 0.3) * 0.85), 0.3, 60)), group);
  });

  return { trophies: out, platRate, npCommunicationId: `NPWR${String(20000 + gameIdx * 173).padStart(5, "0")}_00` };
}

async function seedGames() {
  for (const [idx, spec] of GAMES.entries()) {
    const { trophies, npCommunicationId } = buildTrophies(spec, idx);
    const game = await prisma.game.create({
      data: {
        slug: slugify(spec.title),
        npCommunicationId,
        npServiceName: spec.platforms.includes("PS5") ? "trophy2" : "trophy",
        title: spec.title,
        titleKey: titleKey(spec.title),
        platforms: spec.platforms,
        developer: spec.developer,
        publisher: spec.publisher,
        genre: spec.genre,
        releaseDate: new Date(spec.release),
        description: spec.description,
        coverHue: hashString(spec.title) % 360,
        difficulty: spec.difficulty,
        hoursToPlatinum: spec.hours,
        playthroughs: spec.playthroughs,
        hasOnlineTrophies: !!spec.online,
        screenshots: JSON.stringify(["art:0", "art:1", "art:2", "art:3"]),
      },
    });
    const groups = new Map<string, string>();
    const base = await prisma.trophyGroup.create({ data: { gameId: game.id, psnGroupId: "default", name: spec.title } });
    groups.set("default", base.id);
    for (const [i, d] of (spec.dlc ?? []).entries()) {
      const g = await prisma.trophyGroup.create({
        data: { gameId: game.id, psnGroupId: String(i + 1).padStart(3, "0"), name: d.name, isDlc: true, releaseDate: new Date(d.release) },
      });
      groups.set(g.psnGroupId, g.id);
    }
    const slugs = trophySlugs(trophies.map((t) => ({ psnTrophyId: t.psnTrophyId, name: t.name, hidden: !!t.hidden })));
    await prisma.trophy.createMany({
      data: trophies.map((t) => ({
        gameId: game.id,
        groupId: groups.get(t.group)!,
        psnTrophyId: t.psnTrophyId,
        slug: slugs.get(t.psnTrophyId)!,
        name: t.name,
        description: t.description,
        type: t.type,
        hidden: !!t.hidden,
        missable: !!t.missable,
        online: !!t.online,
        earnedRate: t.earnedRate,
      })),
    });
  }
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash("trophyhunter", 10);
  const all = [
    { username: "demo", onlineId: "TrophyPilot_Demo", country: "GB", bio: "Demo account. Have a look around.", visibility: "PUBLIC", email: "demo@trophypilot.com" },
    ...USERS.map((u) => ({ ...u, email: `${u.username}@example.com` })),
  ];
  const users = [];
  for (const u of all) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        username: u.username,
        passwordHash,
        country: u.country,
        bio: u.bio,
        avatarHue: hashString(u.username) % 360,
        profileVisibility: u.visibility ?? "PUBLIC",
        createdAt: new Date(Date.now() - (30 + rnd() * 700) * DAY),
        psn: {
          create: {
            onlineId: u.onlineId,
            accountId: `mock-${hashString(u.onlineId.toLowerCase())}`,
            verified: true,
          },
        },
      },
    });
    await syncUser(user.id, { trigger: "IMPORT" });
    users.push(user);
  }
  return users;
}

async function seedFriends(users: { id: string; username: string }[]) {
  const [demo, ...others] = users;
  const pairs = new Set<string>();
  const add = async (a: string, b: string, status = "ACCEPTED") => {
    const key = [a, b].sort().join(":");
    if (a === b || pairs.has(key)) return;
    pairs.add(key);
    await prisma.friendship.create({ data: { requesterId: a, addresseeId: b, status } });
  };
  for (const o of others.slice(0, 9)) await add(demo.id, o.id);
  await add(others[20].id, demo.id); // IronOath (friends-only profile), lets demo see it
  await add(others[12].id, demo.id, "PENDING");
  await add(others[24].id, demo.id, "PENDING");
  await add(demo.id, others[15].id, "PENDING");
  for (let i = 0; i < 60; i++) await add(pick(others).id, pick(others).id);
}

function guideSteps(spec: GameSpec, trophies: { id: string; name: string; description: string; missable: boolean; type: string; group: { isDlc: boolean } }[]) {
  const byName = (n: string) => trophies.find((t) => t.name === n)?.id ?? null;
  const steps: { kind: string; title: string; body: string; trophyId: string | null }[] = [];
  const collectNouns = spec.collectibles.map(([n]) => n).join(" and ");
  const hasMissables = trophies.some((t) => t.missable);
  const lastChapter = spec.chapters[spec.chapters.length - 1].replace(/^.*: /, "");

  steps.push({
    kind: "ROADMAP",
    title: "Stage 1: story playthrough",
    body: `Play through ${spec.title} on any difficulty and enjoy it. Grab ${collectNouns} as you find them, but don't obsess: ${
      hasMissables ? "the only things you must not skip are the missables listed below; check them before each chapter." : "nothing is missable, so everything can be cleaned up afterwards with chapter select."
    } Story trophies are unmissable and will pop naturally.`,
    trophyId: byName(lastChapter),
  });
  if (spec.hardMode)
    steps.push({
      kind: "ROADMAP",
      title: `Stage 2: ${spec.hardMode} run`,
      body: `Start a fresh save on the highest difficulty. Your first run taught you the encounters, so this should feel much fairer than it sounds. Stock up before bosses and use every consumable, nothing carries over to the platinum.`,
      trophyId: byName(spec.hardMode),
    });
  if (spec.speedrun)
    steps.push({
      kind: "ROADMAP",
      title: `Stage ${steps.length + 1}: speedrun`,
      body: `Once you know the game, go for ${spec.speedrun[0]} (${spec.speedrun[1]}). Skip every optional area and cutscene and follow the speedrun route section below. Difficulty doesn't matter, so drop it to the lowest.`,
      trophyId: byName(spec.speedrun[0]),
    });
  steps.push({
    kind: "ROADMAP",
    title: `Stage ${steps.length + 1}: collectibles and cleanup`,
    body: `Use chapter select to mop up any remaining ${collectNouns} and miscellaneous trophies. The in-game tracker shows per-chapter counts, which makes this painless.${
      spec.online ? " Online trophies are best done in a boosting session. Check Sessions for this game." : ""
    }`,
    trophyId: null,
  });
  steps.push({ kind: "ROADMAP", title: "Platinum!", body: `Enjoy ${spec.platinum}. You've earned it.`, trophyId: trophies.find((t) => t.type === "PLATINUM")?.id ?? null });

  for (const t of trophies.filter((t) => t.missable)) {
    steps.push({
      kind: "MISSABLE",
      title: t.name,
      body: `${t.description} This can be permanently missed on a save: once you pass the point of no return for the relevant chapter, you'll need a new playthrough. Keep a manual save before each chapter's final encounter.`,
      trophyId: t.id,
    });
  }

  for (const [noun, count, missable] of spec.collectibles) {
    const trophy = trophies.find((t) => t.description === `Find all ${count} ${noun}.`);
    let left = count;
    spec.chapters.forEach((ch, i) => {
      const n = i === spec.chapters.length - 1 ? left : Math.min(left, Math.max(1, Math.round((count / spec.chapters.length) * (0.6 + rnd() * 0.8))));
      left -= n;
      if (n <= 0) return;
      const locs = Array.from({ length: Math.min(n, 3) }, () => `• ${pick(LOCATIONS)}`).join("\n");
      steps.push({
        kind: "COLLECTIBLE",
        title: `${ch}: ${n} ${noun}`,
        body: `${locs}${n > 3 ? `\n• …plus ${n - 3} more along the critical path.` : ""}${missable ? "\nMissable: these can't be collected once the chapter ends." : ""}`,
        trophyId: trophy?.id ?? null,
      });
    });
  }

  if (spec.speedrun) {
    let t = 0;
    spec.chapters.forEach((ch) => {
      t += 8 + Math.round(rnd() * 25);
      steps.push({
        kind: "SPEEDRUN",
        title: `${ch}, split ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`,
        body: pick([
          "Skip all optional dialogue. Take the left path at the fork to avoid the ambush.",
          "Use the ledge clip near the entrance to save roughly two minutes.",
          "Don't fight here. Sprint past; enemies de-aggro at the gate.",
          "Grab only the key item; everything else is optional for this route.",
          "Boss: stay aggressive, the second phase can be skipped with a well-timed stagger.",
        ]),
        trophyId: null,
      });
    });
  }
  return steps;
}

async function seedGuides(users: { id: string }[]) {
  const featured = GAMES.filter((_, i) => i !== 6 && i !== 17); // every game but a couple has a guide
  for (const spec of featured) {
    const game = await prisma.game.findUniqueOrThrow({
      where: { slug: slugify(spec.title) },
      include: { trophies: { include: { group: true }, orderBy: { psnTrophyId: "asc" } } },
    });
    const steps = guideSteps(spec, game.trophies);
    const author = pick(users.slice(1, 20));
    await prisma.guide.create({
      data: {
        slug: `${game.slug}-trophy-guide`,
        gameId: game.id,
        authorId: author.id,
        title: `${spec.title} trophy guide and roadmap`,
        summary: `A ${spec.playthroughs}-playthrough roadmap to the ${spec.title} platinum, ${missableText(
          game.trophies.filter((t) => t.missable).length,
        )}, and collectible locations chapter by chapter.`,
        difficulty: Math.round(spec.difficulty),
        hoursEstimate: spec.hours,
        playthroughs: spec.playthroughs,
        missableCount: game.trophies.filter((t) => t.missable).length,
        onlineRequired: !!spec.online,
        views: Math.floor(200 + rnd() * 20000),
        createdAt: new Date(Date.now() - (5 + rnd() * 300) * DAY),
        steps: { create: steps.map((s, order) => ({ ...s, order })) },
      },
    });
  }
}

async function seedTips(users: { id: string }[]) {
  const trophies = await prisma.trophy.findMany({ where: { type: { not: "PLATINUM" } } });
  const candidates = trophies.filter((t) => (t.earnedRate ?? 100) < 40 || t.missable || rnd() < 0.08);
  for (const t of candidates) {
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const tip = await prisma.tip.create({
        data: {
          authorId: pick(users.slice(1)).id,
          trophyId: t.id,
          body: pick(TIP_BANK),
          createdAt: new Date(Date.now() - rnd() * 200 * DAY),
        },
      });
      const voters = new Set(Array.from({ length: Math.floor(rnd() * 12) }, () => pick(users.slice(1)).id));
      for (const v of voters) await prisma.tipVote.create({ data: { userId: v, tipId: tip.id, value: rnd() < 0.85 ? 1 : -1 } });
    }
  }
  const guides = await prisma.guide.findMany();
  for (const g of guides) {
    for (let i = 0; i < 2; i++) {
      await prisma.tip.create({
        data: { authorId: pick(users.slice(1)).id, guideId: g.id, body: pick(TIP_BANK), createdAt: new Date(Date.now() - rnd() * 90 * DAY) },
      });
    }
  }
}

async function seedSessions(users: { id: string }[]) {
  const online = await prisma.game.findMany({ where: { hasOnlineTrophies: true }, include: { trophies: { where: { online: true } } } });
  for (let i = 0; i < 10; i++) {
    const game = pick(online);
    const trophy = pick(game.trophies);
    const host = pick(users.slice(1));
    const session = await prisma.session.create({
      data: {
        hostId: host.id,
        gameId: game.id,
        title: trophy ? `Boosting: ${trophy.name}` : `${game.title} online trophies`,
        description: pick([
          "Quick boost, we swap wins. Mic optional but preferred.",
          "Going for all online trophies in one go. Please be on time!",
          "Chill session, EU evening. Newcomers welcome.",
          "Need 2 more for the 4-player trophy.",
        ]),
        platform: game.platforms.split(",")[0],
        startsAt: new Date(Date.now() + (0.2 + rnd() * 14) * DAY),
        slots: pick([2, 4, 4, 6, 8]),
      },
    });
    await prisma.sessionMember.create({ data: { sessionId: session.id, userId: host.id } });
    const extra = Math.floor(rnd() * (session.slots - 1));
    for (let j = 0; j < extra; j++) {
      await prisma.sessionMember.create({ data: { sessionId: session.id, userId: pick(users.slice(1)).id } }).catch(() => {});
    }
  }
}

const missableText = (n: number) => (n === 0 ? "no missables" : n === 1 ? "the one missable flagged" : `all ${n} missables flagged`);

async function main() {
  console.log("Resetting data…");
  await prisma.$transaction([
    prisma.sessionMember.deleteMany(),
    prisma.session.deleteMany(),
    prisma.tipVote.deleteMany(),
    prisma.tip.deleteMany(),
    prisma.guideStep.deleteMany(),
    prisma.guide.deleteMany(),
    prisma.userTrophy.deleteMany(),
    prisma.userGame.deleteMany(),
    prisma.syncJob.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.psnAccount.deleteMany(),
    prisma.user.deleteMany(),
    prisma.trophy.deleteMany(),
    prisma.trophyGroup.deleteMany(),
    prisma.game.deleteMany(),
  ]);
  console.log("Seeding games…");
  await seedGames();
  console.log("Seeding users + syncing trophies through the mock PSN provider…");
  const users = await seedUsers();
  await seedFriends(users);
  console.log("Seeding guides, tips, sessions…");
  await seedGuides(users);
  await seedTips(users);
  await seedSessions(users);
  const [g, t, u, ut] = await Promise.all([prisma.game.count(), prisma.trophy.count(), prisma.user.count(), prisma.userTrophy.count()]);
  console.log(`Done: ${g} games, ${t} trophies, ${u} users, ${ut} earned trophies.`);
  console.log("Demo login: demo@trophypilot.com / trophyhunter");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
