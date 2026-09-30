import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/forum";
import { SITE } from "@/lib/site";
import { Avatar } from "./ui";
import { NavLinks } from "./NavLinks";
import { SearchIcon } from "./icons";
import { UserMenu } from "./UserMenu";

export async function Nav() {
  const user = await getCurrentUser();
  const pending = user ? await prisma.friendship.count({ where: { addresseeId: user.id, status: "PENDING" } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${SITE.name} home`}>
          <Logo size={34} />
          <span className="text-xl font-extrabold tracking-tight">{SITE.name}</span>
        </Link>

        <NavLinks />

        <form action="/search" className="relative ml-auto hidden flex-1 md:block md:max-w-sm" role="search">
          <label htmlFor="nav-q" className="sr-only">Search</label>
          <SearchIcon size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input id="nav-q" name="q" placeholder="Search games, PSN IDs, guides…" className="input bg-surface-2 py-2 pl-9" />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/search" className="btn-ghost px-2.5 md:hidden" aria-label="Search">
            <SearchIcon size={18} />
          </Link>
          {user ? (
            <UserMenu
              avatar={<Avatar name={user.username} hue={user.avatarHue} url={user.psn?.avatarUrl} size={30} className="rounded-md" />}
              name={user.psn?.onlineId ?? user.username}
              username={user.username}
              pending={pending}
              admin={isAdmin(user)}
            />
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Log in</Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Red tile with a white trophy. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
      <path d="M10 8h12v5a6 6 0 0 1-12 0z" fill="#fff" />
      <path d="M10 10H7.5a3.2 3.2 0 0 0 3.3 4M22 10h2.5a3.2 3.2 0 0 1-3.3 4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <rect x="14.5" y="18.5" width="3" height="3.5" fill="#fff" />
      <rect x="11" y="22" width="10" height="2.6" rx="0.6" fill="#fff" />
    </svg>
  );
}
