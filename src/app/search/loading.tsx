import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Searching" className="mx-auto max-w-4xl">
      <Skeleton className="mb-8 h-8 w-32" />
      <Skeleton className="mb-4 h-11 w-full" />
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>
      <SkeletonRows rows={6} />
    </SkeletonRegion>
  );
}
