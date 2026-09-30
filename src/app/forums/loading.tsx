import { Skeleton, SkeletonHeader, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading forums">
      <SkeletonHeader />
      <Skeleton className="mb-6 h-9 w-32" />
      <div className="space-y-6">
        <SkeletonRows rows={3} avatar={false} />
        <SkeletonRows rows={4} avatar={false} />
      </div>
    </SkeletonRegion>
  );
}
