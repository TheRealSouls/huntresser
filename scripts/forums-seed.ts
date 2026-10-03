/**
 * Creates the forum's sections and sub-sections. Safe to run again: a
 * section that already exists (same place, same name) is left alone, so
 * edits made at /forums/manage are kept.
 *
 *   npm run forums:seed
 */
import { prisma } from "../src/lib/db";
import { uniqueSectionSlug } from "../src/lib/forum";
import { slugify } from "../src/lib/utils";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

type Sub = { name: string; description: string; adminOnly?: boolean };
const SECTIONS: { name: string; description: string; children: Sub[] }[] = [
  {
    name: "PlayStation Pilot",
    description: "News about the site, help using it, and bug reports.",
    children: [
      { name: "Announcements", description: "Site news and updates from the team.", adminOnly: true },
      { name: "Site Help", description: "Questions about syncing, profiles and how things work." },
      { name: "Bugs and Problems", description: "Something broken? Tell us what happened and where." },
    ],
  },
  {
    name: "PlayStation Central",
    description: "Trophies, platinums and games on every PlayStation.",
    children: [
      { name: "PlayStation 5", description: "PS5 games, trophy lists and platinums." },
      { name: "PlayStation 4", description: "PS4 games, trophy lists and platinums." },
      { name: "PlayStation 3", description: "PS3 games and the trophies that started it all." },
      { name: "PS Vita", description: "Vita games and handheld platinums." },
      { name: "PlayStation Classic", description: "PS1, PS2 and PSP classics, including the re-releases with trophies." },
      { name: "PSN Sales and Deals", description: "Sales worth knowing about and cheap platinums." },
      { name: "Platinum Showcase", description: "Show off a platinum and say how it went." },
    ],
  },
  {
    name: "Beyond PlayStation",
    description: "Gaming on everything else.",
    children: [
      { name: "PC & Mac", description: "Steam, Epic and everything on a computer." },
      { name: "Xbox", description: "Xbox games and achievements." },
      { name: "Retro Consoles", description: "Older consoles and the games you grew up with." },
      { name: "Mobile Gaming", description: "Games on phones and tablets." },
    ],
  },
  {
    name: "The Community",
    description: "Say hello and talk about anything.",
    children: [
      { name: "New Members Introductions", description: "New here? Introduce yourself." },
      { name: "Sports Central", description: "Football, racing, wrestling and every other sport." },
      { name: "The Watchlist", description: "Films, series and anime worth watching." },
      { name: "Community Challenges", description: "Trophy challenges and events run by members." },
      { name: "The VIP Lounge", description: "Off-topic chat." },
    ],
  },
];

async function ensure(name: string, description: string, order: number, parentId: string | null, adminOnly = false) {
  const existing = await prisma.forumSection.findFirst({ where: { name, parentId } });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.forumSection.create({
    data: { name, description, order, parentId, adminOnly, slug: await uniqueSectionSlug(slugify(name)) },
  });
  return { id: created.id, created: true };
}

async function main() {
  let created = 0;
  for (const [i, s] of SECTIONS.entries()) {
    const section = await ensure(s.name, s.description, i * 10, null);
    if (section.created) created++;
    for (const [j, c] of s.children.entries()) {
      if ((await ensure(c.name, c.description, j * 10, section.id, c.adminOnly)).created) created++;
    }
  }
  const total = await prisma.forumSection.count();
  console.log(`Created ${created} forum sections. The forum now has ${total}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
