"use client";

import { useEffect, useState } from "react";

const fmt = (d: Date, seconds: boolean, timeZone?: string) =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
  });

/**
 * A date and time in the viewer's own time zone. The server doesn't know
 * the zone, so it renders UTC (labelled) and the browser swaps in local
 * time once it loads. `seconds` shows the exact second a trophy popped,
 * which is what people look at to spot impossible unlock times.
 */
export function LocalTime({ date, seconds = false, weekday = false, className }: { date: Date | string; seconds?: boolean; weekday?: boolean; className?: string }) {
  const d = new Date(date);
  const [text, setText] = useState(() => fmt(d, seconds, "UTC"));
  const iso = d.toISOString();
  useEffect(() => {
    const local = fmt(new Date(iso), seconds);
    setText(weekday ? `${new Date(iso).toLocaleDateString("en-GB", { weekday: "short" })} ${local}` : local);
  }, [iso, seconds, weekday]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}

/** "Times are shown in your time zone: Europe/Dublin (UTC+1)". */
export function TimeZoneNote({ className }: { className?: string }) {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(offset) / 60);
    const m = Math.abs(offset) % 60;
    setZone(`${name} (UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`);
  }, []);
  return (
    <p className={className} aria-live="polite">
      {zone ? `Times are shown in your time zone: ${zone}` : "Times are shown in your time zone."}
    </p>
  );
}
