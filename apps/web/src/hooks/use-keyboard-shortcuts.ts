'use client'

import { useEffect, useRef } from 'react'

export interface KeyboardShortcutHandlers {
  onNewPost?: () => void
  onLike?: () => void
  onReply?: () => void
  onBoost?: () => void
  onToggleHelp?: () => void
}

function isTyping(): boolean {
  const tag = document.activeElement?.tagName.toLowerCase()
  const role = (document.activeElement as HTMLElement | null)?.getAttribute('role')
  return tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'textbox' ||
    !!(document.activeElement as HTMLElement | null)?.isContentEditable
}

// Scroll to the next/previous PostCard element relative to the viewport center
function scrollToCard(direction: 'next' | 'prev') {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-postcard]'))
  if (cards.length === 0) return

  const mid = window.innerHeight / 2
  const rects = cards.map((c) => c.getBoundingClientRect())

  if (direction === 'next') {
    const target = cards.find((_, i) => rects[i]!.top > mid + 10)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else {
    const prev = [...cards].reverse().find((_, i) => rects[cards.length - 1 - i]!.top < mid - 10)
    prev?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Find the PostCard closest to viewport center
function getCenteredCard(): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-postcard]'))
  if (cards.length === 0) return null
  const mid = window.innerHeight / 2
  return cards.reduce((best, card) => {
    const dist = Math.abs(card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2 - mid)
    const bestDist = Math.abs(best.getBoundingClientRect().top + best.getBoundingClientRect().height / 2 - mid)
    return dist < bestDist ? card : best
  })
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping()) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'j':
          e.preventDefault()
          scrollToCard('next')
          break
        case 'k':
          e.preventDefault()
          scrollToCard('prev')
          break
        case 'n':
          e.preventDefault()
          window.dispatchEvent(new Event('floq:focus-composer'))
          handlersRef.current.onNewPost?.()
          break
        case 'l': {
          e.preventDefault()
          const card = getCenteredCard()
          card?.querySelector<HTMLButtonElement>('[data-action="like"]')?.click()
          break
        }
        case 'r': {
          e.preventDefault()
          const card = getCenteredCard()
          card?.querySelector<HTMLButtonElement>('[data-action="reply"]')?.click()
          break
        }
        case 'b': {
          e.preventDefault()
          const card = getCenteredCard()
          card?.querySelector<HTMLButtonElement>('[data-action="boost"]')?.click()
          break
        }
        case '/':
          e.preventDefault()
          window.dispatchEvent(new Event('floq:focus-search'))
          break
        case '?':
          e.preventDefault()
          handlersRef.current.onToggleHelp?.()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
