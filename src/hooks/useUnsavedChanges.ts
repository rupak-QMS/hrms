/**
 * useUnsavedChanges — warns the user before navigating away with unsaved form changes.
 *
 * Usage:
 *   const { markDirty, markClean, isDirty } = useUnsavedChanges()
 *
 *   // In your form onChange handler:
 *   markDirty()
 *
 *   // After a successful save:
 *   markClean()
 *
 *   // Or pass isDirty directly if you track it yourself:
 *   useUnsavedChanges(isDirtyFromForm)
 *
 * Handles two scenarios:
 *   1. Browser navigation / tab close  → window.beforeunload
 *   2. Next.js client-side navigation  → router.events (App Router compatible)
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useUnsavedChanges(externalDirty?: boolean) {
  const [isDirty, setIsDirty] = useState(false)
  const dirtyRef = useRef(false)

  // Sync with external dirty state if provided
  useEffect(() => {
    if (externalDirty !== undefined) {
      dirtyRef.current = externalDirty
      setIsDirty(externalDirty)
    }
  }, [externalDirty])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setIsDirty(true)
  }, [])

  const markClean = useCallback(() => {
    dirtyRef.current = false
    setIsDirty(false)
  }, [])

  // 1. Browser/tab close or hard navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      // Chrome requires returnValue to be set
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // 2. Next.js App Router soft navigation
  // App Router doesn't expose router.events, so we intercept history.pushState / replaceState
  useEffect(() => {
    const originalPush    = history.pushState.bind(history)
    const originalReplace = history.replaceState.bind(history)

    const guard = (fn: typeof history.pushState, ...args: Parameters<typeof history.pushState>) => {
      if (dirtyRef.current) {
        const ok = window.confirm('You have unsaved changes. Leave this page?')
        if (!ok) return
        dirtyRef.current = false
        setIsDirty(false)
      }
      fn(...args)
    }

    history.pushState    = (...args) => guard(originalPush, ...args)
    history.replaceState = (...args) => guard(originalReplace, ...args)

    return () => {
      history.pushState    = originalPush
      history.replaceState = originalReplace
    }
  }, [])

  return { isDirty, markDirty, markClean }
}
