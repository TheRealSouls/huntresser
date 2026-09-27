import { NextResponse, type NextRequest } from "next/server";

/** Target of the "look up a PSN profile" form, which can only submit a query string. */
export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  return NextResponse.redirect(new URL(id ? `/psn/${encodeURIComponent(id)}` : "/search", req.url), 307);
}
