import { prisma } from "@/lib/db";
import { trophyHref } from "@/lib/trophy-slug";

/**
 * Old trophy addresses (/trophies/<id>) moved to /games/<game>/<trophy>.
 * A real 308 (not a streamed page redirect) so links shared before still
 * work and search engines update. The Location is relative on purpose; see
 * src/app/psn/route.ts.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await prisma.trophy.findUnique({ where: { id: (await params).id }, select: { slug: true, game: { select: { slug: true } } } });
  if (!t?.slug) return new Response("Trophy not found", { status: 404 });
  return new Response(null, { status: 308, headers: { Location: trophyHref(t.game.slug, t.slug) } });
}
