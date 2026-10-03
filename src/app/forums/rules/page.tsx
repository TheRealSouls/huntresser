import type { Metadata } from "next";
import Link from "next/link";
import { FORUM_TABS } from "@/lib/forum";
import { PageHeader, TabLinks } from "@/components/ui";

export const metadata: Metadata = { title: "Forum rules", description: "What's welcome on the forums and what isn't." };

const RULES: [string, string][] = [
  ["Be decent to each other", "Argue about games, not people. No harassment, hate, threats or personal attacks."],
  ["Post in the right place", "Pick the section that fits and give your thread a clear title. Search first: someone may have asked already."],
  ["Mark spoilers", "Put a spoiler warning in the title and keep story details out of thread titles."],
  ["No cheating presented as legitimate", "Don't share hacked saves, mods or exploits that get accounts banned, and don't boast about using them."],
  ["No selling", "No paid boosting, account selling or sharing, and no advertising. Free boosting belongs in Sessions."],
  ["No piracy", "Don't post or ask for pirated games, keys or leaked content."],
  ["Keep it legal and safe for work", "Nothing illegal, sexually explicit or gory. No one else's private information."],
  ["One account each", "Don't create extra accounts to dodge a suspension or to back yourself up in an argument."],
  ["Staff have the last word", "Staff can edit, move, lock or remove posts that break these rules. If you disagree, message a member of staff. Don't argue it out in the thread."],
];

export default function ForumRulesPage() {
  return (
    <div>
      <PageHeader kicker="Community" title="Forum rules">
        Short version: be the kind of member you&apos;d want replying to your thread.
      </PageHeader>
      <div className="mb-6">
        <TabLinks tabs={FORUM_TABS} active="rules" />
      </div>
      <ol className="card max-w-3xl divide-y divide-line">
        {RULES.map(([title, text], i) => (
          <li key={title} className="flex gap-4 p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-sm font-bold tabular-nums">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-3xl text-sm text-muted">
        These sit alongside the <Link href="/terms" className="link">terms of service</Link>. To report a post, message a member of the{" "}
        <Link href="/forums/staff" className="link">forum staff</Link> or use the <Link href="/contact?topic=content" className="link">contact form</Link>.
      </p>
    </div>
  );
}
