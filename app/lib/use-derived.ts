"use client"

import { useMemo } from "react"
import { useAppStore, useActiveNetwork } from "./store"
import { deriveAll, summarize } from "./derive"
import type { DerivedFacility } from "./types"

/**
 * Derives all non-archived facilities in the active network using the current
 * DRAFT parameters (mu, alpha). This is the single source of truth for the
 * registry, management, and console screens so numbers stay consistent.
 */
export function useDerived(): {
  derived: DerivedFacility[]
  summary: ReturnType<typeof summarize>
} {
  const net = useActiveNetwork()
  const mu = useAppStore((s) => s.draftParams.mu)
  const alpha = useAppStore((s) => s.draftParams.alpha)

  return useMemo(() => {
    const active = (net?.facilities ?? []).filter((f) => !f.archived)
    const derived = deriveAll(active, mu, alpha)
    return { derived, summary: summarize(derived) }
  }, [net?.facilities, mu, alpha])
}
