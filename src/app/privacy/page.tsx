import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker="Legal" title="Privacy policy">
        Last updated {SITE.legalUpdated}
      </PageHeader>
      <article className="prose-legal">
        <p>
          This policy explains what personal data {SITE.name} collects, why, and what you can do about it. The data controller is{" "}
          {SITE.operator}. For anything privacy related, email <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
        </p>

        <h2>What we collect</h2>
        <h3>When you create an account</h3>
        <ul>
          <li>Email address, username and a hashed password (we never store the password itself).</li>
          <li>Optionally, your country and a short bio.</li>
          <li>Your privacy and leaderboard preferences.</li>
        </ul>
        <h3>When you link PSN</h3>
        <ul>
          <li>Your PSN Online ID, PSN account ID and avatar.</li>
          <li>Your trophy data: games played, trophies earned and when, completion and trophy level.</li>
          <li>A log of sync attempts, so we can show you what happened and fix errors.</li>
        </ul>
        <h3>When you use the site</h3>
        <ul>
          <li>Guides, tips, votes, friend requests and sessions you create or join.</li>
          <li>One essential cookie that keeps you signed in. We don&apos;t use advertising or analytics cookies.</li>
          <li>Your guide checklist ticks, stored only in your own browser.</li>
          <li>
            Your IP address, briefly held in memory to rate limit logins and PSN lookups. It isn&apos;t written to our database.
          </li>
        </ul>
        <h3>Public PSN lookups</h3>
        <p>
          When someone looks up a public PSN profile, we fetch it from PSN and cache it for up to 15 minutes. We don&apos;t save that
          player&apos;s trophy history. We do add the games on their list to our game catalogue, which contains no personal data.
        </p>

        <h2>Why we use it</h2>
        <ul>
          <li>To run your account and show your profile, trophies and rankings (performing our contract with you).</li>
          <li>To keep the site secure and stop abuse, such as rate limiting (our legitimate interest).</li>
          <li>To email you about your account, for example a security issue or a change to these policies (legitimate interest).</li>
        </ul>
        <p>We don&apos;t sell your data, and we don&apos;t use it for advertising.</p>

        <h2>Who can see it</h2>
        <p>
          Your profile visibility setting decides who sees your trophy data: everyone, friends only, or just you. Guides and tips you
          post are public. Your email address is never shown to other users.
        </p>
        <p>
          We use a small number of service providers to run the site, such as our hosting and database provider. They process data
          only on our instructions. We read trophy data from Sony&apos;s PlayStation Network. If a provider is outside the UK or EEA,
          we rely on an adequacy decision or standard contractual clauses.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Account data: until you delete your account.</li>
          <li>Synced trophy data: until you unlink PSN or delete your account.</li>
          <li>Sync logs: kept with your account and removed when it is deleted.</li>
          <li>Backups: overwritten within 30 days of deletion.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can access, correct, export or delete your data. Most of this is self-service: edit your profile in{" "}
          <Link href="/settings">Settings</Link>, download everything with &quot;Download my data&quot;, or delete your account there.
          You can also object to processing, ask us to restrict it, or complain to your data protection authority (in the UK,
          that&apos;s the ICO). Email <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a> and we&apos;ll reply within one
          month.
        </p>

        <h2>Children</h2>
        <p>The site isn&apos;t meant for children under 13. If we learn that a child under 13 has an account, we&apos;ll delete it.</p>

        <h2>Security</h2>
        <p>
          Passwords are hashed with bcrypt, sessions are signed and sent over HTTPS only, and access to production data is limited.
          No system is perfectly secure. If we have a breach that puts you at risk, we&apos;ll tell you and the regulator as the law
          requires.
        </p>

        <h2>Changes</h2>
        <p>
          If we change this policy in a way that matters, we&apos;ll post a notice on the site before it takes effect. The date at
          the top shows when it last changed.
        </p>
      </article>
    </div>
  );
}
