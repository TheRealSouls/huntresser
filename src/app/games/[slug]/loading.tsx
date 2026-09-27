import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading game">
      <div className="mb-8 grid gap-6 border border-line bg-surface p-5 sm:p-7 md:grid-cols-[180px_1fr]">
        <Skeleton className="aspect-square w-36 md:w-full" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-16 w-full max-w-2xl" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <SkeletonRows rows={8} />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
