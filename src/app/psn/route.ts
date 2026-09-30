import type { NextRequest } from "next/server";

/** Target of the "look up a PSN profile" form, which can only submit a query string. */
export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  // A relative Location on purpose: behind Render's proxy req.url is the
  // internal address (https://localhost:10000), and an absolute redirect
  // built from it sends visitors nowhere.
  return new Response(null, {
    status: 307,
    headers: { Location: id ? `/psn/${encodeURIComponent(id)}` : "/search" },
  });
}
