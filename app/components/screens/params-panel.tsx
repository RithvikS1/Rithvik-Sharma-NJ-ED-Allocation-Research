"use client"

import { useAppStore } from "@/lib/store"
import { NumberStepper, SliderField } from "@/components/dense"

/**
 * Editable allocation parameters bound to `draftParams`. Changing any value
 * marks the model stale until the user re-runs the allocation.
 */
export function ParamsPanel({ compact = false }: { compact?: boolean }) {
  const p = useAppStore((s) => s.draftParams)
  const setDraftParams = useAppStore((s) => s.setDraftParams)

  return (
    <div className={compact ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-4"}>
      <SliderField
        label="Service rate μ"
        hint="patients / hour / physician"
        min={1}
        max={5}
        step={0.05}
        value={p.mu}
        onChange={(mu) => setDraftParams({ mu })}
        format={(v) => v.toFixed(2)}
      />
      <SliderField
        label="Wait cost C_w"
        hint="$ per patient-hour waiting"
        min={0}
        max={500}
        step={5}
        value={p.cW}
        onChange={(cW) => setDraftParams({ cW })}
        format={(v) => `$${v.toFixed(0)}`}
      />
      <SliderField
        label="Equity weight α"
        hint="w = 1 + α·SVI"
        min={0}
        max={5}
        step={0.1}
        value={p.alpha}
        onChange={(alpha) => setDraftParams({ alpha })}
        format={(v) => v.toFixed(1)}
      />
      <NumberStepper
        label="Physician budget"
        hint="additional physicians to distribute"
        min={0}
        max={200}
        step={1}
        value={p.budget}
        onChange={(budget) => setDraftParams({ budget })}
      />
    </div>
  )
}
