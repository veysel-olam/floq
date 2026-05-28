'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex border-b border-(--color-border) sticky top-0 z-10 bg-(--color-background)/90 backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'flex-1 py-3 text-xs font-medium transition-all flex items-center justify-center gap-1.5',
        'text-(--color-text-tertiary) hover:text-(--color-text-secondary) hover:bg-(--color-background-secondary)/50',
        'data-[state=active]:text-(--color-coral) data-[state=active]:border-b-2 data-[state=active]:border-(--color-coral)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-coral)/50 focus-visible:ring-inset',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('focus-visible:outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
