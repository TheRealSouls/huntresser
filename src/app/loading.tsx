import { SkeletonHeader, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion>
      <SkeletonHeader />
      <SkeletonRows rows={6} />
    </SkeletonRegion>
  );
}
