'use client'

type HapticPattern =
  | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
  | 'success' | 'warning' | 'error' | 'nudge'
  | 'selection'

const STORAGE_KEY = 'floq-haptics'

// Pre-initialized instance — set by HapticsProvider on mount
// so trigger() reaches hapticLabel.click() within the gesture context
let _instance: { trigger: (p: string) => Promise<void>; destroy: () => void } | null = null

export function _setHapticsInstance(
  instance: { trigger: (p: string) => Promise<void>; destroy: () => void } | null,
) {
  _instance = instance
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

// Called from event handlers — synchronous path to trigger, no awaits before .click()
export function triggerHaptic(pattern: HapticPattern): void {
  if (!isEnabled() || !_instance) return
  void _instance.trigger(pattern)
}

export function getHapticsEnabled(): boolean {
  return isEnabled()
}

export function setHapticsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}
