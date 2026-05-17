import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  note?: string
  action?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  note,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const iconBox = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'
  const iconSize = size === 'lg' ? '[&>svg]:w-8 [&>svg]:h-8' : size === 'sm' ? '[&>svg]:w-5 [&>svg]:h-5' : '[&>svg]:w-7 [&>svg]:h-7'
  const py = size === 'sm' ? 'py-10' : 'py-20'

  return (
    <div className={cn('flex flex-col items-center gap-3 px-8 text-center', py, className)}>
      <div className={cn('rounded-2xl bg-(--color-background-secondary) flex items-center justify-center', iconBox)}>
        <span className={cn('text-(--color-text-tertiary)', iconSize)}>
          <Icon />
        </span>
      </div>

      <div className="space-y-1">
        <p
          className="text-sm font-semibold text-(--color-text-primary)"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          {title}
        </p>
        {description && (
          <p className="text-xs text-(--color-text-tertiary) max-w-xs leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {note && (
        <p className="text-[11px] text-(--color-text-tertiary)/70 bg-(--color-background-secondary) px-3 py-2 rounded-lg max-w-xs leading-relaxed">
          {note}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
