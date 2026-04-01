import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { LightboxProps } from '../hooks/useLightbox'
import { useSwipe } from '../hooks/useSwipe'
import { MEDIA_BASE } from '../useData'

const TYPE_LABELS: Record<string, string> = {
  gravestone: 'Gravestone',
  portrait: 'Portrait',
  newspaper: 'Newspaper',
  document: 'Document',
  group_photo: 'Group Photo',
  scan: 'Scan',
  other: 'Other',
}

export default function Lightbox({ items, currentIndex, isOpen, onClose, onNext, onPrev }: LightboxProps) {
  const [visible, setVisible] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const item = items[currentIndex]
  const url = item ? `${MEDIA_BASE}${item.path}` : ''
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < items.length - 1

  // Stable callbacks for swipe
  const handleSwipeLeft = useCallback(() => { if (hasNext) onNext() }, [hasNext, onNext])
  const handleSwipeRight = useCallback(() => { if (hasPrev) onPrev() }, [hasPrev, onPrev])

  useSwipe(containerRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    enabled: isOpen,
  })

  // Fade-in on open
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  // Focus the container when open
  useEffect(() => {
    if (isOpen && visible) {
      containerRef.current?.focus()
    }
  }, [isOpen, visible])

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [isOpen])

  // Reset image loaded state on index change
  useEffect(() => {
    setImageLoaded(false)
  }, [currentIndex])

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen) return
    if (currentIndex > 0) {
      const img = new Image()
      img.src = `${MEDIA_BASE}${items[currentIndex - 1].path}`
    }
    if (currentIndex < items.length - 1) {
      const img = new Image()
      img.src = `${MEDIA_BASE}${items[currentIndex + 1].path}`
    }
  }, [isOpen, currentIndex, items])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, onNext, onPrev])

  if (!isOpen || !item) return null

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center outline-none transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous button */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          aria-label="Previous image"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          aria-label="Next image"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="relative z-[1] flex items-center justify-center w-full h-full px-12 sm:px-20 pt-16 pb-28">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <img
          src={url}
          alt={item.description}
          className={`max-w-full max-h-full object-contain select-none transition-opacity duration-150 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Bottom metadata bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 sm:px-6 pb-4 sm:pb-6 pt-12">
        <div className="max-w-3xl mx-auto text-white">
          <div className="font-medium text-sm sm:text-base">{item.person}</div>
          {item.description && (
            <div className="text-white/70 text-xs sm:text-sm mt-1">{item.description}</div>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] sm:text-xs font-medium">
              {TYPE_LABELS[item.type] || item.type}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] sm:text-xs text-amber-300 hover:text-amber-200"
              onClick={(e) => e.stopPropagation()}
            >
              Open original ↗
            </a>
            <span className="text-[10px] sm:text-xs text-white/50 ml-auto">
              {currentIndex + 1} of {items.length}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
