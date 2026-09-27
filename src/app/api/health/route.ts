import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/psn/sync";

export const dynamic = "force-dynamic";

/** Liveness check for the host (Render health checks, uptime monitors). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, mode: isDemoMode() ? "demo" : "live" });
  } catch {
    return NextResponse.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
