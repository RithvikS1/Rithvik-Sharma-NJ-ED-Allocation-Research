"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore, SCREENS, type ScreenId } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CornerDownLeft, Play } from "lucide-react"

type Command = {
  id: string
  label: string
  hint?: string
  group: string
  run: () => void
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  const setScreen = useAppStore((s) => s.setScreen)
  const runAllocation = useAppStore((s) => s.runAllocation)

  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useAppStore.getState().commandOpen)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery("")
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const nav = (Object.keys(SCREENS) as ScreenId[]).map((id) => ({
      id: `nav-${id}`,
      label: SCREENS[id].label,
      hint: SCREENS[id].hotkey,
      group: "Navigate",
      run: () => {
        setScreen(id)
        setOpen(false)
      },
    }))
    const actions: Command[] = [
      {
        id: "act-run",
        label: "Run allocation",
        hint: "compute",
        group: "Actions",
        run: () => {
          runAllocation()
          setScreen("console")
          setOpen(false)
        },
      },
    ]
    return [...nav, ...actions]
  }, [setScreen, setOpen, runAllocation])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-3 pt-[12vh] sm:px-0"
      onMouseDown={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, filtered.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                filtered[cursor]?.run()
              }
            }}
            placeholder="Jump to a screen or run an action…"
            className="w-full bg-transparent px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-1 dense-scroll">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No matching commands
            </li>
          )}
          {filtered.map((c, i) => {
            const prevGroup = filtered[i - 1]?.group
            const showGroup = c.group !== prevGroup
            return (
              <li key={c.id}>
                {showGroup && (
                  <div className="px-3 pb-1 pt-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                    {c.group}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => c.run()}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px]",
                    i === cursor ? "bg-accent text-accent-foreground" : "text-foreground",
                  )}
                >
                  {c.group === "Actions" ? (
                    <Play className="h-3.5 w-3.5 shrink-0 text-info" />
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && (
                    <span className="font-mono text-[9px] text-muted-foreground">{c.hint}</span>
                  )}
                  {i === cursor && <CornerDownLeft className="h-3 w-3 text-muted-foreground" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
