import { cn } from '@/lib/utils'

type LogoVariant = 'light' | 'dark' | 'coral'
type LogoSize = 'sm' | 'md' | 'lg'

const sizes = {
  sm: { icon: 28, wordmark: 'text-xl', gap: 'gap-2' },
  md: { icon: 36, wordmark: 'text-2xl', gap: 'gap-3' },
  lg: { icon: 44, wordmark: 'text-3xl', gap: 'gap-4' },
}

interface FloqLogoProps {
  variant?: LogoVariant
  size?: LogoSize
  iconOnly?: boolean
  className?: string
}

export function FloqLogo({
  variant = 'light',
  size = 'md',
  iconOnly = false,
  className,
}: FloqLogoProps) {
  const { icon, wordmark, gap } = sizes[size]
  const textColor =
    variant === 'dark' || variant === 'coral' ? 'text-[#FAFAF8]' : 'text-[#1A1A18]'

  return (
    <div className={cn('flex items-center', gap, className)}>
      <FloqIcon size={icon} variant={variant} />
      {!iconOnly && (
        <span
          className={cn(
            'font-display font-semibold tracking-tight leading-none',
            wordmark,
            textColor,
          )}
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          floq
        </span>
      )}
    </div>
  )
}

function FloqIcon({ size, variant }: { size: number; variant: LogoVariant }) {
  const isOnDark = variant === 'dark' || variant === 'coral'

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <circle
        cx="14"
        cy="14"
        r="9"
        fill={isOnDark ? '#FAFAF8' : '#E8593C'}
        opacity={isOnDark ? 0.35 : 0.9}
      />
      <circle
        cx="30"
        cy="14"
        r="9"
        fill={isOnDark ? '#FAFAF8' : '#F2845C'}
        opacity={isOnDark ? 0.25 : 0.75}
      />
      <circle
        cx="22"
        cy="28"
        r="9"
        fill={isOnDark ? '#FAFAF8' : '#D44A2E'}
        opacity={isOnDark ? 0.3 : 0.85}
      />
      <circle cx="22" cy="18" r="4" fill="#FAFAF8" opacity="0.95" />
    </svg>
  )
}
