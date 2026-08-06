'use client'

import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' } as const

/** Inline spinning indicator — use inside buttons and next to short status text. */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <LoaderCircle
      role="status"
      aria-label="Loading"
      className={cn('animate-spin', SIZES[size], className)}
    />
  )
}

/** Centred spinner + label, for a section that is still fetching. */
export function LoadingBlock({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-foreground/60',
        className,
      )}
    >
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

/** Full-height loader for a whole route or the auth gate. */
export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingBlock label={label} />
    </div>
  )
}

/** Grey placeholder bar used to build skeleton layouts. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-foreground/10', className)}
    />
  )
}

/** Skeleton stand-in for the stat/score cards used on the dashboard. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-6', className)}>
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-8 w-20" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}
