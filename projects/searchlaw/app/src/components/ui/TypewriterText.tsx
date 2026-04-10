import { useState, useEffect, useCallback, useRef } from 'react'

interface TypewriterTextProps {
  texts: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
}

export default function TypewriterText({
  texts,
  typingSpeed = 50,
  deletingSpeed = 25,
  pauseDuration = 2000,
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const pauseStartRef = useRef<number>(0)

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Reduced motion: just cycle text every 3s
  useEffect(() => {
    if (!prefersReducedMotion || texts.length === 0) return
    setDisplayText(texts[0])
    const interval = setInterval(() => {
      setTextIndex((prev) => {
        const next = (prev + 1) % texts.length
        setDisplayText(texts[next])
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [prefersReducedMotion, texts])

  // Typewriter animation loop using rAF
  const animate = useCallback(
    (timestamp: number) => {
      if (prefersReducedMotion || texts.length === 0) return

      const currentFullText = texts[textIndex]

      // Handle pause between typing and deleting
      if (isPausedRef.current) {
        if (timestamp - pauseStartRef.current >= pauseDuration) {
          isPausedRef.current = false
          setIsDeleting(true)
          lastTickRef.current = timestamp
        }
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      const speed = isDeleting ? deletingSpeed : typingSpeed
      if (timestamp - lastTickRef.current < speed) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      lastTickRef.current = timestamp

      if (!isDeleting) {
        // Typing forward
        setDisplayText((prev) => {
          const nextLen = prev.length + 1
          if (nextLen > currentFullText.length) {
            // Finished typing — start pause
            isPausedRef.current = true
            pauseStartRef.current = timestamp
            return currentFullText
          }
          return currentFullText.slice(0, nextLen)
        })
      } else {
        // Deleting backward
        setDisplayText((prev) => {
          const nextLen = prev.length - 1
          if (nextLen <= 0) {
            setIsDeleting(false)
            setTextIndex((i) => (i + 1) % texts.length)
            return ''
          }
          return prev.slice(0, nextLen)
        })
      }

      rafRef.current = requestAnimationFrame(animate)
    },
    [textIndex, isDeleting, texts, typingSpeed, deletingSpeed, pauseDuration, prefersReducedMotion],
  )

  useEffect(() => {
    if (prefersReducedMotion || texts.length === 0) return
    lastTickRef.current = performance.now()
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate, prefersReducedMotion, texts])

  if (texts.length === 0) return null

  return (
    <span className="inline" aria-live="polite" aria-atomic="true">
      {displayText}
      {!prefersReducedMotion && (
        <span
          className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse bg-brand-500"
          aria-hidden="true"
        />
      )}
    </span>
  )
}
