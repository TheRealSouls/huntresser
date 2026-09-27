import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/psn/sync";
import { prisma } from "@/lib/db";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(`/u/${user.username}`);
  // Show the shared demo login in demo mode, or when an operator created it with npm run demo:user.
  const showDemo = isDemoMode() || !!(await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } }));
  return (
    <div className="mx-auto max-w-md pt-4">
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold">Log in</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Pick up where you left off.</p>
        <LoginForm next={next} />
      </div>
      {showDemo && (
        <p className="mt-4 border border-line px-4 py-3 text-xs text-muted">
          Demo account: <code className="text-text">{DEMO_EMAIL}</code> / <code className="text-text">{DEMO_PASSWORD}</code>
        </p>
      )}
    </div>
  );
}
