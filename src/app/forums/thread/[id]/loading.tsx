import { Skeleton, SkeletonRegion } from "@/components/ui";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading thread" className="mx-auto max-w-4xl">
      <Skeleton className="mb-4 h-3 w-40" />
      <Skeleton className="mb-2 h-7 w-3/4" />
      <Skeleton className="mb-8 h-3 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card grid sm:grid-cols-[160px_1fr]">
            <div className="flex items-center gap-3 bg-surface-2 p-3 sm:flex-col sm:items-start">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
