import { useState, useCallback, useEffect, useRef } from 'react'
import type { MediaEntry } from '../types'

export interface LightboxProps {
  items: MediaEntry[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

export function useLightbox(items: MediaEntry[]) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const scrollY = useRef(0)

  const isOpen = openIndex !== null
  const currentIndex = openIndex ?? 0

  const open = useCallback((index: number) => {
    scrollY.current = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY.current}px`
    document.body.style.width = '100%'
    setOpenIndex(index)
  }, [])

  const close = useCallback(() => {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    window.scrollTo(0, scrollY.current)
    setOpenIndex(null)
  }, [])

  const goNext = useCallback(() => {
    setOpenIndex(prev => prev !== null && prev < items.length - 1 ? prev + 1 : prev)
  }, [items.length])

  const goPrev = useCallback(() => {
    setOpenIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
    }
  }, [])

  const lightboxProps: LightboxProps = {
    items,
    currentIndex,
    isOpen,
    onClose: close,
    onNext: goNext,
    onPrev: goPrev,
  }

  return { isOpen, currentIndex, open, close, goNext, goPrev, lightboxProps }
}
