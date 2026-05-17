import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-(--color-background-tertiary)', className)}
      {...props}
    />
  )
}

export function PostSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-(--color-border-secondary)">
      <div className="flex gap-3">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
          <div className="flex gap-6 pt-1">
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function TimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </>
  )
}

export function NotificationSkeleton() {
  return (
    <div className="px-4 py-3.5 border-b border-(--color-border)">
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 items-center">
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3 w-10 rounded ml-auto" />
          </div>
          <Skeleton className="h-3.5 w-3/4 rounded" />
        </div>
      </div>
    </div>
  )
}

export function NotificationsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </>
  )
}

export function DMSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-(--color-border)">
      <div className="flex gap-3 items-center">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
          <Skeleton className="h-3 w-40 rounded" />
        </div>
      </div>
    </div>
  )
}

export function DMListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <DMSkeleton key={i} />
      ))}
    </>
  )
}

export function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-32 w-full" />
      <div className="px-4 pb-4">
        <div className="flex justify-between items-end -mt-10 mb-3">
          <Skeleton className="w-20 h-20 rounded-full border-4 border-(--color-background)" />
        </div>
        <Skeleton className="h-5 w-32 rounded mb-1" />
        <Skeleton className="h-3.5 w-24 rounded mb-3" />
        <Skeleton className="h-3.5 w-full rounded mb-1" />
        <Skeleton className="h-3.5 w-3/4 rounded mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-3.5 w-20 rounded" />
        </div>
      </div>
    </div>
  )
}
