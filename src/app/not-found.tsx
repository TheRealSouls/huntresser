import Link from "next/link";
import { TrophyIcon } from "@/components/TrophyIcon";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <TrophyIcon type="BRONZE" size={72} dim />
      <h1 className="mt-6 text-4xl font-bold">Hidden trophy?</h1>
      <p className="mt-2 max-w-md text-muted">We couldn&apos;t find that page. It may have been removed, or it never existed.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary">Home</Link>
        <Link href="/search" className="btn-ghost">Search</Link>
      </div>
    </div>
  );
}
