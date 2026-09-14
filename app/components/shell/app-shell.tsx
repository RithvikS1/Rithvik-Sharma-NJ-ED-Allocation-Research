"use client"

import { useEffect, useState } from "react"
import { useAppStore, SCREENS, type ScreenId } from "@/lib/store"
import { Sidebar } from "./sidebar"
import { MobileTabBar } from "./mobile-tab-bar"
import { StatusBar } from "./status-bar"
import { CommandPalette } from "./command-palette"

import { RegistryScreen } from "@/components/screens/registry-screen"
import { ManagementScreen } from "@/components/screens/management-screen"
import { ConsoleScreen } from "@/components/screens/console-screen"
import { TraceScreen } from "@/components/screens/trace-screen"

const SCREEN_COMPONENTS: Record<ScreenId, React.ComponentType> = {
  registry: RegistryScreen,
  management: ManagementScreen,
  console: ConsoleScreen,
  trace: TraceScreen,
}

// "g <key>" chord navigation, e.g. "g c" -> console.
const CHORD: Record<string, ScreenId> = Object.fromEntries(
  (Object.keys(SCREENS) as ScreenId[]).map((id) => [SCREENS[id].hotkey.split(" ")[1], id]),
) as Record<string, ScreenId>

export function AppShell() {
  const screen = useAppStore((s) => s.screen)
  const setScreen = useAppStore((s) => s.setScreen)

  // Zustand's persist middleware rehydrates from localStorage synchronously
  // before this effect runs, so gating on a post-mount flag guarantees the
  // first client render matches the SSR pass (both show the loader) and the
  // second render already has the persisted numbers.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let awaitingChord = false
    let timer: ReturnType<typeof setTimeout> | null = null
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!awaitingChord && e.key.toLowerCase() === "g") {
        awaitingChord = true
        timer = setTimeout(() => (awaitingChord = false), 900)
        return
      }
      if (awaitingChord) {
        const dest = CHORD[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          setScreen(dest)
        }
        awaitingChord = false
        if (timer) clearTimeout(timer)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setScreen])

  const Active = SCREEN_COMPONENTS[screen]

  // Gate on rehydration so the SSR pass (default seed) is never diffed against
  // the client's persisted numbers, which would trip a hydration mismatch.
  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2 font-mono text-[12px]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          initializing allocation console…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Active />
        </main>
        <MobileTabBar />
      </div>
      <CommandPalette />
    </div>
  )
}
