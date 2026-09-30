import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import { logout } from "@/actions/auth";
import { Avatar } from "./ui";
import { NavLinks } from "./NavLinks";

export async function Nav() {
  const user = await getCurrentUser();
  const pending = user ? await prisma.friendship.count({ where: { addresseeId: user.id, status: "PENDING" } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4 sm:px-6">
        {/* The red tile and the name sit together inside one red frame. */}
        <Link href="/" className="flex shrink-0 items-stretch border-2 border-accent" aria-label={`${SITE.name} home`}>
          <Logo size={28} />
          <span className="flex items-center px-2 text-base font-bold leading-none tracking-tight">{SITE.name}</span>
        </Link>

        <NavLinks />

        <form action="/search" className="ml-auto hidden flex-1 md:block md:max-w-xs" role="search">
          <label htmlFor="nav-q" className="sr-only">Search</label>
          <input id="nav-q" name="q" placeholder="Search games, PSN IDs, guides" className="input py-1.5" />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/search" className="btn-ghost px-3 py-1.5 md:hidden">Search</Link>
          {user ? (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm border border-line py-1 pl-1 pr-3 hover:border-muted [&::-webkit-details-marker]:hidden">
                <span className="relative">
                  <Avatar name={user.username} hue={user.avatarHue} url={user.psn?.avatarUrl} size={26} />
                  {pending > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-accent px-1 text-[10px] font-bold text-white">
                      {pending}
                    </span>
                  )}
                </span>
                <span className="hidden text-sm font-semibold sm:inline">{user.psn?.onlineId ?? user.username}</span>
              </summary>
              <div className="absolute right-0 mt-1 w-56 border border-line bg-surface">
                <MenuLink href={`/u/${user.username}`}>My profile</MenuLink>
                <MenuLink href="/friends">
                  Friends {pending > 0 && <span className="ml-auto bg-accent px-1.5 text-xs font-bold text-white">{pending}</span>}
                </MenuLink>
                <MenuLink href="/compare">Compare hunters</MenuLink>
                <MenuLink href="/guides/new">Write a guide</MenuLink>
                <MenuLink href="/settings">Settings and PSN</MenuLink>
                <form action={logout} className="border-t border-line">
                  <button className="w-full px-4 py-2.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-text">Log out</button>
                </form>
              </div>
            </details>
          ) : (
            <>
              <Link href="/login" className="btn-ghost py-1.5">Log in</Link>
              <Link href="/register" className="btn-primary hidden py-1.5 sm:inline-flex">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center px-4 py-2.5 text-sm hover:bg-surface-2">
      {children}
    </Link>
  );
}

/** Flat red tile with a trophy cut-out. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" fill="var(--color-accent)" />
      <path d="M9 7h14v5.5a7 7 0 0 1-14 0z" fill="#fff" />
      <rect x="14" y="19" width="4" height="4" fill="#fff" />
      <rect x="10" y="23" width="12" height="3" fill="#fff" />
    </svg>
  );
}
