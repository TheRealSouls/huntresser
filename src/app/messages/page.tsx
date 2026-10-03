import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { conversationName } from "@/lib/community";
import { timeAgo } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui";
import { NewConversationForm } from "./forms";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to = "" } = await searchParams;
  const user = await requireUser("/messages");
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: { username: true, psn: { select: { onlineId: true } } } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, authorId: true } },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader kicker="Community" title="Messages">
        Private conversations and group chats with other members.
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {memberships.length === 0 ? (
            <EmptyState title="No conversations yet">Send a member a message with the form, or from the Message button on their profile.</EmptyState>
          ) : (
            <ul className="card divide-y divide-line">
              {memberships.map(({ conversation: c, lastReadAt }) => {
                const unread = c.lastMessageAt > lastReadAt;
                const last = c.messages[0];
                return (
                  <li key={c.id}>
                    <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", unread ? "bg-accent" : "bg-transparent")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className={clsx("truncate", unread ? "font-bold" : "font-semibold")}>
                          {conversationName(c, user.id)}
                          {c.isGroup && <span className="chip ml-2">Group · {c.members.length}</span>}
                          {unread && <span className="sr-only"> (unread)</span>}
                        </div>
                        <div className="truncate text-sm text-muted">
                          {last ? `${last.authorId === user.id ? "You: " : ""}${last.body}` : "No messages yet"}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(c.lastMessageAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside>
          <section className="card p-5">
            <h2 className="mb-4 font-bold">New message</h2>
            <NewConversationForm to={to} />
          </section>
          <p className="mt-3 text-xs text-muted">
            You can choose who is allowed to message you in <Link href="/settings" className="link">Settings</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
