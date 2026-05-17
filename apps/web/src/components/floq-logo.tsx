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

  // Squircle background: coral on light, white on dark
  const bgFill = isOnDark ? '#FAFAF8' : '#E8593C'
  const dotFill = isOnDark ? '#E8593C' : '#FAFAF8'

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      {/* Squircle background */}
      <rect x="2" y="2" width="40" height="40" rx="13" fill={bgFill} />
      {/* Three dots — triangular cluster representing a flock */}
      {/* Top-left */}
      <circle cx="15" cy="17" r="4.5" fill={dotFill} opacity="1" />
      {/* Top-right */}
      <circle cx="29" cy="17" r="4.5" fill={dotFill} opacity="0.65" />
      {/* Bottom-center */}
      <circle cx="22" cy="29" r="4.5" fill={dotFill} opacity="0.4" />
    </svg>
  )
}
