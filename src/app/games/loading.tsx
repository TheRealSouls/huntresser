import { Skeleton, SkeletonCards, SkeletonHeader, SkeletonRegion } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading games">
      <SkeletonHeader />
      <Skeleton className="mb-6 h-24 w-full" />
      <div className="mb-5 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>
      <SkeletonCards count={15} />
    </SkeletonRegion>
  );
}
