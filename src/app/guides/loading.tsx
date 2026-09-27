import { Skeleton, SkeletonHeader, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading guides">
      <SkeletonHeader />
      <Skeleton className="mb-6 h-10 w-full max-w-md" />
      <SkeletonRows rows={6} />
    </SkeletonRegion>
  );
}
