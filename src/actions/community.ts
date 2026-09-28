"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify, youtubeId } from "@/lib/utils";
import { refreshEstimates } from "@/lib/estimates";
import type { FormState } from "./auth";

// ─── Tips ────────────────────────────────────────────────────────────────────

export async function addTip(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = String(fd.get("body") ?? "").trim();
  const trophyId = (fd.get("trophyId") as string) || null;
  const guideId = (fd.get("guideId") as string) || null;
  const path = String(fd.get("path") ?? "/");
  if (body.length < 10) return { error: "Tips need at least 10 characters." };
  if (body.length > 1000) return { error: "Keep tips under 1,000 characters." };
  if (!trophyId && !guideId) return { error: "Nothing to attach this tip to." };

  await prisma.tip.create({ data: { authorId: user.id, body, trophyId, guideId } });
  revalidatePath(path);
  return { ok: "Thanks, your tip is live." };
}

export async function voteTip(fd: FormData) {
  const user = await requireUser();
  const tipId = String(fd.get("tipId"));
  const value = fd.get("value") === "-1" ? -1 : 1;
  const existing = await prisma.tipVote.findUnique({ where: { userId_tipId: { userId: user.id, tipId } } });
  if (existing?.value === value) {
    await prisma.tipVote.delete({ where: { userId_tipId: { userId: user.id, tipId } } });
  } else {
    await prisma.tipVote.upsert({
      where: { userId_tipId: { userId: user.id, tipId } },
      create: { userId: user.id, tipId, value },
      update: { value },
    });
  }
  revalidatePath(String(fd.get("path") ?? "/"));
}

// ─── Guides ──────────────────────────────────────────────────────────────────

const stepSchema = z.object({
  kind: z.enum(["ROADMAP", "MISSABLE", "COLLECTIBLE", "SPEEDRUN"]),
  title: z.string().trim().min(2, "Give this step a title.").max(120, "Step titles must be under 120 characters."),
  body: z.string().trim().min(2, "Add some details to this step.").max(4000, "Step details must be under 4,000 characters."),
  trophyId: z.string().optional().nullable(),
  video: z.string().optional().nullable(),
});

const guideSchema = z.object({
  gameId: z.string().min(1, "Pick a game."),
  title: z.string().trim().min(5, "Title is too short.").max(120),
  summary: z.string().trim().min(20, "Summary should be at least 20 characters.").max(600),
  difficulty: z.coerce.number().int().min(1).max(10),
  hoursEstimate: z.coerce.number().int().min(1).max(2000),
  playthroughs: z.coerce.number().int().min(1).max(20),
  video: z.string().optional(),
  steps: z.array(stepSchema).min(1, "Add at least one step."),
});

export async function createGuide(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let steps: unknown;
  try {
    steps = JSON.parse(String(fd.get("steps") ?? "[]"));
  } catch {
    return { error: "Couldn't read guide steps." };
  }
  const parsed = guideSchema.safeParse({ ...Object.fromEntries(fd), steps });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.path[0] === "steps" && issue.path.length > 1 ? `Step ${Number(issue.path[1]) + 1}: ${issue.message}` : issue.message };
  }
  const g = parsed.data;
  const game = await prisma.game.findUnique({ where: { id: g.gameId }, include: { trophies: { select: { id: true, missable: true } } } });
  if (!game) return { error: "Unknown game." };
  const validTrophies = new Set(game.trophies.map((t) => t.id));

  const base = slugify(g.title) || "guide";
  let slug = base;
  for (let i = 2; await prisma.guide.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  await prisma.guide.create({
    data: {
      slug,
      gameId: game.id,
      authorId: user.id,
      title: g.title,
      summary: g.summary,
      difficulty: g.difficulty,
      hoursEstimate: g.hoursEstimate,
      playthroughs: g.playthroughs,
      onlineRequired: fd.get("onlineRequired") === "on",
      missableCount: g.steps.filter((s) => s.kind === "MISSABLE").length,
      videoYoutubeId: youtubeId(g.video),
      steps: {
        create: g.steps.map((s, order) => ({
          order,
          kind: s.kind,
          title: s.title,
          body: s.body,
          trophyId: s.trophyId && validTrophies.has(s.trophyId) ? s.trophyId : null,
          videoYoutubeId: youtubeId(s.video),
        })),
      },
    },
  });
  await refreshEstimates([game.id]);
  revalidatePath("/guides");
  revalidatePath("/games", "layout");
  redirect(`/guides/${slug}`);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

const sessionSchema = z.object({
  gameId: z.string().min(1, "Pick a game."),
  title: z.string().trim().min(4, "Title is too short.").max(100),
  description: z.string().trim().max(500).optional(),
  platform: z.enum(["PS5", "PS4", "PS3", "PSVITA"]),
  startsAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60_000, "Start time must be in the future."),
  slots: z.coerce.number().int().min(2).max(16),
});

export async function createSession(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = sessionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await prisma.session.create({
    data: { ...parsed.data, hostId: user.id, members: { create: { userId: user.id } } },
  });
  revalidatePath("/sessions");
  redirect(`/sessions#${s.id}`);
}

export async function toggleSession(fd: FormData) {
  const user = await requireUser();
  const sessionId = String(fd.get("sessionId"));
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { _count: { select: { members: true } } } });
  if (!session) return;
  const member = await prisma.sessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  if (member) {
    if (session.hostId === user.id) await prisma.session.delete({ where: { id: sessionId } });
    else await prisma.sessionMember.delete({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  } else if (session._count.members < session.slots) {
    await prisma.sessionMember.create({ data: { sessionId, userId: user.id } });
  }
  revalidatePath("/sessions");
}
