"use client"

import { useAppStore, type ScreenId } from "@/lib/store"
import { cn } from "@/lib/utils"
import { LayoutGrid, Database, Activity, GitBranch } from "lucide-react"

const TABS: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "registry", label: "Registry", icon: Database },
  { id: "management", label: "Manage", icon: LayoutGrid },
  { id: "console", label: "Console", icon: Activity },
  { id: "trace", label: "Trace", icon: GitBranch },
]

export function MobileTabBar() {
  const screen = useAppStore((s) => s.screen)
  const setScreen = useAppStore((s) => s.setScreen)

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 border-t border-panel-hair bg-panel pb-safe text-panel-foreground md:hidden"
    >
      {TABS.map((tab) => {
        const active = screen === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScreen(tab.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium transition-colors",
              active
                ? "text-white"
                : "text-panel-muted active:bg-panel-hair",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-9 items-center justify-center rounded-full transition-colors",
                active && "bg-panel-active",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="tracking-tight">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
