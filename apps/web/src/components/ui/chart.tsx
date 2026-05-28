'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type ChartConfig = Record<string, { label: string; color: string }>

interface ChartContextValue {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used within ChartContainer')
  return ctx
}

// ── Container ─────────────────────────────────────────────────────────────

function ChartContainer({
  id,
  className,
  children,
  config,
}: {
  id?: string
  className?: string
  children: React.ReactNode
  config: ChartConfig
}) {
  const uid = React.useId()
  const chartId = id ?? uid

  // inject CSS vars so Recharts color strings like "var(--color-likes)" work
  const styleVars = Object.entries(config).reduce<Record<string, string>>(
    (acc, [key, val]) => { acc[`--color-${key}`] = val.color; return acc },
    {},
  )

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn('flex aspect-video justify-center text-xs', className)}
        style={styleVars as React.CSSProperties}
      >
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
}: RechartsPrimitive.TooltipProps<number, string> & {
  labelFormatter?: (label: string) => React.ReactNode
  formatter?: (value: number, name: string) => React.ReactNode
  hideLabel?: boolean
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-background) px-3 py-2 shadow-lg shadow-black/10 text-xs">
      {!hideLabel && (
        <p className="text-(--color-text-tertiary) mb-1.5 font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((item) => {
          const key = item.dataKey as string
          const cfg = config[key]
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: item.color ?? cfg?.color }}
              />
              <span className="text-(--color-text-tertiary)">{cfg?.label ?? key}</span>
              <span className="ml-auto font-semibold text-(--color-text-primary) tabular-nums">
                {formatter ? formatter(item.value as number, key) : item.value?.toLocaleString('tr-TR')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────

function ChartLegend({ config }: { config: ChartConfig }) {
  return (
    <div className="flex items-center gap-4 justify-end">
      {Object.entries(config).map(([key, val]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: val.color }} />
          <span className="text-[11px] text-(--color-text-tertiary)">{val.label}</span>
        </div>
      ))}
    </div>
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
}
