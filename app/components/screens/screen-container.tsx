"use client"

import type { ReactNode } from "react"

export function ScreenContainer({
  title,
  description,
  actions,
  children,
  noPad = false,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  noPad?: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4">
        <div className="min-w-0">
          <h1 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">{actions}</div>
        )}
      </div>
      <div className={noPad ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto dense-scroll p-3 sm:p-4"}>
        {children}
      </div>
    </div>
  )
}

export function Placeholder({ name }: { name: string }) {
  return (
    <ScreenContainer title={name}>
      <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
        {name} — under construction
      </div>
    </ScreenContainer>
  )
}
