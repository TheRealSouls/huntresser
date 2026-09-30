import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MobileNav } from "@/components/NavLinks";
import { isDemoMode } from "@/lib/psn/sync";
import { SITE } from "@/lib/site";
import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description:
    "Track your PlayStation trophies, plan platinums with community guides, and see where you rank globally, in your country and among friends.",
  applicationName: SITE.name,
  openGraph: { siteName: SITE.name, type: "website" },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="en" className={mono.variable}>
      <body className="min-h-screen font-sans text-[15px] antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-line pb-24 pt-8 text-xs text-muted lg:pb-8">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <p>
                <span className="font-bold text-text">{SITE.name}</span> is an independent fan project for trophy hunters.
              </p>
              <p className="max-w-xl text-faint">
                Not affiliated with, endorsed or sponsored by Sony Interactive Entertainment. PlayStation, PSN and the
                PlayStation logos are trademarks of Sony Interactive Entertainment Inc.
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3">
              <Link href="/games" className="hover:text-text">Games</Link>
              <Link href="/guides" className="hover:text-text">Guides</Link>
              <Link href="/forums" className="hover:text-text">Forums</Link>
              <Link href="/leaderboards" className="hover:text-text">Leaderboards</Link>
              <Link href="/sessions" className="hover:text-text">Sessions</Link>
              <Link href="/terms" className="hover:text-text">Terms of service</Link>
              <Link href="/privacy" className="hover:text-text">Privacy policy</Link>
              <Link href="/contact" className="hover:text-text">Contact</Link>
            </nav>
          </div>
          <div className="mx-auto mt-6 max-w-7xl px-4 text-faint sm:px-6">
            © {year} {SITE.name}
            {isDemoMode() && (
              <span className="mt-1 block">
                Demo mode. No PSN_NPSSO is configured, so PSN linking and syncing use a simulated provider and a fictional
                game catalogue.
              </span>
            )}
          </div>
        </footer>
        <MobileNav />
      </body>
    </html>
  );
}
