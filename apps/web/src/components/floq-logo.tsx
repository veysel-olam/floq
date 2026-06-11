import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

const sizes = {
  sm: { icon: 28, wordmark: 'text-xl', gap: 'gap-2' },
  md: { icon: 36, wordmark: 'text-2xl', gap: 'gap-3' },
  lg: { icon: 44, wordmark: 'text-3xl', gap: 'gap-4' },
}

interface FloqLogoProps {
  size?: LogoSize
  iconOnly?: boolean
  light?: boolean
  beta?: boolean
  className?: string
}

export function FloqLogo({
  size = 'md',
  iconOnly = false,
  light = false,
  beta = false,
  className,
}: FloqLogoProps) {
  const { icon, wordmark, gap } = sizes[size]
  return (
    <div className={cn('flex items-center', gap, className)}>
      <FloqIcon size={icon} />
      {!iconOnly && (
        <span
          className={cn(
            'font-display font-semibold tracking-tight leading-none',
            light ? 'text-white' : 'text-(--color-text-primary)',
            wordmark,
          )}
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          floq
        </span>
      )}
      {beta && (
        <span
          className={cn(
            'self-start -ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide leading-none',
            light ? 'bg-white/20 text-white' : 'bg-(--color-coral)/12 text-(--color-coral)',
          )}
          title="floq erken aşamada (beta) bir projedir"
        >
          beta
        </span>
      )}
    </div>
  )
}

function FloqIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <rect x="1" y="1" width="42" height="42" rx="13" fill="#E8593C" />
      {/* Three dots — triangular flock formation */}
      <circle cx="17" cy="19" r="7" fill="white" />
      <circle cx="27" cy="19" r="7" fill="white" opacity="0.65" />
      <circle cx="22" cy="29" r="7" fill="white" opacity="0.4" />
    </svg>
  )
}
