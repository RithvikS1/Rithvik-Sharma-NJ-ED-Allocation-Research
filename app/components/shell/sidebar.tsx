"use client"

import { useAppStore, SCREENS, type ScreenId } from "@/lib/store"
import { cn } from "@/lib/utils"
import { LayoutGrid, Database, Activity, GitBranch } from "lucide-react"

const NAV: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { id: "registry", label: "Facility Registry", icon: Database, group: "Data" },
  { id: "management", label: "Facility Management", icon: LayoutGrid, group: "Data" },
  { id: "console", label: "Allocation Console", icon: Activity, group: "Model" },
  { id: "trace", label: "Allocation Trace", icon: GitBranch, group: "Model" },
]

export function Sidebar() {
  const screen = useAppStore((s) => s.screen)
  const setScreen = useAppStore((s) => s.setScreen)

  let lastGroup = ""

  return (
    <nav
      aria-label="Primary"
      className="hidden w-56 shrink-0 flex-col border-r border-panel-hair bg-panel text-panel-foreground md:flex"
    >
      <div className="flex h-11 items-center gap-2.5 border-b border-panel-hair px-3">
        <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#4d8bb8] to-[#2b5c82] shadow-sm ring-1 ring-inset ring-white/15">
          <Activity className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#5fb0a8] ring-2 ring-panel" />
        </div>
        <span className="text-[12px] font-semibold tracking-tight text-panel-foreground">
          ED Allocation
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {NAV.map((item) => {
          const showGroup = item.group !== lastGroup
          lastGroup = item.group
          const active = screen === item.id
          const Icon = item.icon
          return (
            <div key={item.id}>
              {showGroup && (
                <div className="px-3 pb-1 pt-3 text-[9px] font-mono uppercase tracking-widest text-panel-muted">
                  {item.group}
                </div>
              )}
              <button
                type="button"
                onClick={() => setScreen(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
                  active
                    ? "bg-panel-active text-white border-l-2 border-[#3f7ba6] pl-[10px]"
                    : "border-l-2 border-transparent text-panel-muted hover:bg-panel-hair hover:text-panel-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto font-mono text-[9px] text-panel-muted/70">
                  {SCREENS[item.id]?.hotkey}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
