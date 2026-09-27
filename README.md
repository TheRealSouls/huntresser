# Huntresser

A PlayStation trophy hunting site: accounts with PSN linking, trophy tracking, live PSN profile lookups, a game database built
from PSN, community guides, leaderboards and search.

## Quick start (demo mode)

```bash
npm install
npm run setup      # creates the SQLite DB and seeds demo data
npm run dev        # http://localhost:3000
```

Demo login: `demo@huntresser.gg` / `trophyhunter`. Every seeded user has the same password. `npm run db:reset` wipes the
database and reseeds it.

Without a PSN token the site runs in **demo mode**: a simulated PSN provider and a fictional game catalogue. Nothing talks to
Sony, which is why real players (for example GamingWithFlacy) and real games (for example Hollow Knight) don't show up.

## Connecting to real PSN

Sony has no public API or "Sign in with PlayStation" for other sites. Like other trophy sites, Huntresser reads PSN with a
**service account**: a normal PSN account whose session token (the NPSSO) the server uses to call Sony's mobile API.

1. **Make a PSN account for the site.** Use a separate account, not your main one. The token grants full access to whichever
   account it belongs to, and heavy automated use is safer on an account you don't care about. The account doesn't need any games.
2. **Sign in to that account** at <https://www.playstation.com> (top right, "Sign in"). A private/incognito window keeps it away
   from your personal session.
3. **Get the token.** In the same window, open <https://ca.account.sony.com/api/v1/ssocookie>. You'll see JSON like
   `{"npsso":"<64 characters>"}`. Copy the 64-character value. If you see an error instead, you aren't signed in; repeat step 2.
4. **Close the window without signing out.** Signing out can invalidate the token.
5. **Add it to `.env`:**
   ```
   PSN_NPSSO="paste-the-64-characters-here"
   ```
6. **Check it works:**
   ```bash
   npm run psn:check -- GamingWithFlacy
   ```
   You should see `OK: signed in` and the player's level and trophy counts.
7. **Start with a clean database.** The demo catalogue is fictional, so don't mix it with real data. This deletes
   everything, including any accounts you registered locally:
   ```bash
   npx prisma db push --force-reset
   ```
   Use `npm run setup:live` instead on a new, empty database.
8. **Fill the game catalogue (optional but recommended).** Games are added whenever someone syncs or a PSN profile is looked
   up. To seed it up front, import the lists of a few players with big libraries:
   ```bash
   npm run psn:import -- GamingWithFlacy AnotherHunter
   npm run psn:import -- --trophies GamingWithFlacy   # also fetch every trophy list (slow, one request per game)
   ```
9. **Restart the dev server** (`npm run dev`) so it picks up the new env.

Now search finds real PSN players with their avatars, `/psn/<OnlineID>` shows any public profile, and members can link and
sync their real trophies.

**Things to know**

- Tokens last about two months. When one expires, PSN calls fail and the server logs `[psn] auth ...`. Repeat steps 2 to 5.
- A player's trophies are only visible if their PSN privacy setting for trophies is "Anyone". Otherwise the profile shows
  as private.
- Sony rate limits the API. Lookups are cached (profiles 15 min, searches 10 min) and rate limited per IP. The background
  sync runs accounts one at a time.
- Earn rates (rarity) only come from per-player trophy calls. Games imported from a lookup borrow them from a player who
  owns the game. Where PSN hasn't reported one, the site shows "Rarity n/a".
- This uses Sony's private API through [`psn-api`](https://github.com/achievements-app/psn-api). Sony can change it at any
  time, and using it may break PlayStation Network's terms for the service account. Keep that in mind before launching publicly.

## How players link their real PSN account

Sony doesn't offer "Sign in with PlayStation" to other sites. Its OAuth is only available to companies with a signed
partner agreement (that's how Discord and similar integrations work). So Huntresser does what PSNProfiles, Exophase and
TrueTrophies do: it proves ownership instead of signing in.

1. The player creates a Huntresser account (email and password).
2. In Settings they enter their PSN Online ID and get a code such as `HUNT-3F9A1C`.
3. They paste the code into their PSN About Me (PS5: Profile, Edit Profile, About Me; or the PlayStation App).
4. They press Verify. The server reads their public profile through the service account and checks the code is there. Only
   the owner can edit that About Me, so this proves the account is theirs. They can delete the code afterwards.
5. Their trophies import in the background: every list, trophy group (base game and DLC), trophy, earned date and global
   earn rate. Their PSN avatar becomes their profile picture.

Once linked, players appear on the leaderboards, and anyone can compare two members at `/compare` (or with the Compare
button on a profile). A player's trophies must be visible to "Anyone" in their PSN privacy settings for syncing to work.

Never ask players for their own NPSSO token or PSN password. A token gives full control of their PSN account.

**Syncing big libraries:** a run processes at most `PSN_SYNC_TITLES_PER_RUN` changed trophy lists (default 60) and remembers
where it stopped. Right after linking, the server keeps running batches in the background until the library is imported.
After that, only lists that changed since the last sync are fetched.

**Live sync:** `GET /api/cron/sync` with `Authorization: Bearer $CRON_SECRET` re-syncs the 5 stalest accounts, plus any
that are part-way through an import. Call it from any scheduler, for example every 10 minutes. Users can also press
*Sync now* (60 s cooldown).

## Leaderboards

Sony has no public API that lists the best players, so the site ranks every player it has seen. Each time a PSN profile
is fetched (a lookup on `/psn/<OnlineID>`, `psn:import`, `psn:track` or a member's sync), its public summary is stored
in `PsnPlayer`: level, trophy counts, avatar and the country of the PSN account (decoded from the profile's `npId`).

- **All-time points and platinum boards** (global and country) rank those real PSN totals, members and non-members alike.
  Non-members link to their PSN profile page; members link to their Huntresser profile.
- **Weekly, monthly, completion, ultra rare and friends boards** need a full trophy history, so only members who have
  linked PSN appear on them.
- Players whose PSN trophies are private are never ranked. Members who are private, friends-only or opted out of
  leaderboards stay off the public boards.

To fill the boards with the players you know are at the top, track them directly (one PSN request each):

```bash
npm run psn:track -- ikemenzi GamingWithFlacy
npm run psn:track -- --file hunters.txt      # one Online ID per line
```

Re-run it (for example daily) to refresh their totals. To honour a removal request, run
`npm run psn:track -- --hide TheirOnlineId`: they disappear from lookups, search and leaderboards.

## Trophy lists and "duplicate" games

PSN gives every platform, and often every region, its own trophy list. Rainbow Six Siege has a PS4 list and a PS5 list;
small games often have four regional lists per platform. Each list is its own row in the `Game` table because progress,
trophies and rarity differ between them.

Lists of the same game share a `titleKey` (the title lowercased with punctuation, trademark symbols and accents removed,
see `titleKey()` in `src/lib/utils.ts`). Search and the games page show one entry per `titleKey` with its platforms and
list count, and every game page has a switcher between its lists. After changing `titleKey()`, run
`npm run db:backfill-titles` to recompute keys for existing rows.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React 19, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4. Design tokens live in `src/app/globals.css` (`@theme`) |
| Type | IBM Plex Mono throughout |
| Database | Prisma 6 + SQLite in dev. For production set `provider = "postgresql"` in `prisma/schema.prisma` |
| Auth | bcrypt password hashes and an HS256 JWT in an httpOnly cookie (`jose`) |
| Validation | Zod in every server action |
| PSN | `psn-api` behind a `TrophyProvider` interface, with real and mock providers |

## Features

| Area | Where |
|---|---|
| Accounts, PSN link and sync, privacy, data export, account deletion | `/register`, `/login`, `/settings`, `/api/account/export` |
| Profiles, platinum tracker, milestones, friends | `/u/[username]`, `/u/[username]/[game]`, `/friends` |
| Live PSN profile lookup (any public player) | `/psn/[onlineId]`, `src/lib/psn/lookup.ts` |
| Game database, DLC pages, trophy pages | `/games`, `/games/[slug]`, `/games/[slug]/dlc/[group]`, `/trophies/[id]` |
| Guides with roadmaps, missables, collectibles, tips | `/guides`, `/guides/[slug]`, `/guides/new` |
| Compare two members side by side | `/compare` |
| Leaderboards (global, country, friends; all time, weekly, monthly) | `/leaderboards`, `src/lib/leaderboard.ts` |
| Search (games, PSN players, members, trophies, guides, sessions) | `/search` |
| Co-op and boosting sessions | `/sessions` |
| Terms and privacy policy | `/terms`, `/privacy` (operator details come from `SITE_*` env vars) |

## Production checklist

- Set `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` and the `SITE_*` operator/contact variables.
- Have the terms and privacy policy reviewed for your jurisdiction before launch.
- Switch Prisma to PostgreSQL.
- The rate limiter in `src/lib/rate-limit.ts` is in-memory. Replace it with Redis (or similar) if you run more than one instance.
- Security headers are set in `next.config.ts`. Serve the site over HTTPS only.

## Project layout

```
prisma/            schema, fictional demo catalogue, seed script
scripts/           psn-check, psn-import, psn-track and backfill-titles CLI tools
src/actions/       server actions (auth, account and PSN, friends, community)
src/lib/           db, auth, trophy maths, stats, leaderboards, privacy, rate limiting, PSN providers, lookup and catalogue
src/components/    UI kit, skeletons, trophy list, tips, generated art
src/app/           routes
```

## Notes

- **Privacy:** public profiles appear everywhere. Friends-only profiles are visible to accepted friends and only appear on
  friends leaderboards. Private profiles are visible only to the owner. A separate setting removes a user from leaderboards.
- **Points and levels** use PSN's values (300/90/30/15). The level curve approximates the PS5 one.
- **OneDrive:** if this folder syncs to OneDrive you may see harmless `.next` cache warnings in dev. Moving the repo outside
  OneDrive gives a smoother dev loop.
