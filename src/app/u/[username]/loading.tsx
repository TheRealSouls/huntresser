import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading profile">
      <div className="mb-8 border border-line bg-surface">
        <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
          <Skeleton className="h-24 w-24" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-3 w-72 max-w-full" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <Skeleton className="h-6 w-96 max-w-full" />
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mb-6 h-10 w-full" />
      <SkeletonRows rows={6} />
    </SkeletonRegion>
  );
}
