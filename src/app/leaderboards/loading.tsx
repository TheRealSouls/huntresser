import { Skeleton, SkeletonHeader, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading leaderboard">
      <SkeletonHeader />
      <Skeleton className="mb-6 h-32 w-full" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <SkeletonRows rows={10} />
    </SkeletonRegion>
  );
}
