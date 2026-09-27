import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading PSN profile">
      <Skeleton className="mb-4 h-3 w-40" />
      <div className="mb-6 border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
          <Skeleton className="h-24 w-24" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="w-full space-y-2 sm:w-56">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        </div>
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="mb-8 h-12 w-full" />
      <SkeletonRows rows={8} />
    </SkeletonRegion>
  );
}
