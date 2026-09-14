"use client"

import { useAppStore, useActiveNetwork, SCREENS } from "@/lib/store"
import { StatusDot } from "@/components/dense"
import { fmtInt, fmtRelTime } from "@/lib/format"
import { Activity } from "lucide-react"

export function StatusBar() {
  const screen = useAppStore((s) => s.screen)
  const stale = useAppStore((s) => s.stale)
  const results = useAppStore((s) => s.results)
  const lastComputedAt = useAppStore((s) => s.lastComputedAt)
  const net = useActiveNetwork()

  const activeCount = net?.facilities.filter((f) => !f.archived).length ?? 0
  const allocated = results?.budgetUsed ?? 0
  const boosted = results?.facilities.filter((f) => f.received > 0).length ?? 0

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-panel-hair bg-statusbar px-3 text-statusbar-foreground sm:gap-4 sm:px-4">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#4d8bb8] to-[#2b5c82] ring-1 ring-inset ring-white/15 md:hidden">
        <Activity className="h-3 w-3 text-white" strokeWidth={2.5} />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-panel-muted sm:inline">
          Screen
        </span>
        <span className="truncate text-[12px] font-medium text-panel-foreground">
          {SCREENS[screen].label}
        </span>
      </div>

      <div className="hidden h-4 w-px bg-panel-hair md:block" />

      <div className="hidden items-center gap-4 text-[11px] md:flex">
        <div className="flex items-center gap-1.5">
          <span className="text-panel-muted">Facilities</span>
          <span className="num tabular-nums text-panel-foreground">{fmtInt(activeCount)}</span>
        </div>
        {results && (
          <>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="info" />
              <span className="num tabular-nums text-panel-foreground">{fmtInt(allocated)}</span>
              <span className="text-panel-muted">physicians allocated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="violet" />
              <span className="num tabular-nums text-panel-foreground">{fmtInt(boosted)}</span>
              <span className="text-panel-muted">facilities boosted</span>
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          {stale ? (
            <>
              <StatusDot tone="warn" pulse />
              <span className="text-[#e0b64a]">Model stale</span>
            </>
          ) : (
            <>
              <StatusDot tone="teal" />
              <span className="text-panel-muted">
                Computed {lastComputedAt ? fmtRelTime(lastComputedAt) : "—"}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
