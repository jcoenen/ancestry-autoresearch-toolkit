import { useEffect, useRef, type RefObject } from 'react'

interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  enabled?: boolean
}

export function useSwipe(ref: RefObject<HTMLElement | null>, options: UseSwipeOptions) {
  const { onSwipeLeft, onSwipeRight, threshold = 50, enabled = true } = options
  const startX = useRef(0)
  const startY = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = e.changedTouches[0].clientY - startY.current
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) onSwipeLeft?.()
        else onSwipeRight?.()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [ref, onSwipeLeft, onSwipeRight, threshold, enabled])
}
