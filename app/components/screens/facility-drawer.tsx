"use client"

import { useMemo } from "react"
import { Drawer, StatusBadge, Metric } from "@/components/dense"
import { useAppStore } from "@/lib/store"
import { wqMinAt } from "@/lib/derive"
import { minStableC } from "@/lib/queueing"
import { sviLabel } from "@/lib/svi"
import { fixed, int, pct } from "@/lib/format"
import type { DerivedFacility } from "@/lib/types"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function FacilityDrawer({
  facility,
  onClose,
}: {
  facility: DerivedFacility | null
  onClose: () => void
}) {
  const mu = useAppStore((s) => s.draftParams.mu)

  const curve = useMemo(() => {
    if (!facility) return []
    const rows: { c: number; wq: number; current: boolean }[] = []
    const maxC = Math.max(facility.physicians + 6, 14)
    for (let c = 1; c <= maxC; c++) {
      const v = wqMinAt(facility.lambda, mu, c)
      rows.push({
        c,
        wq: isFinite(v) ? Math.min(v, 600) : 600,
        current: c === facility.physicians,
      })
    }
    return rows
  }, [facility, mu])

  if (!facility) return null

  const floor = minStableC(facility.lambda, mu)
  const nextWq = wqMinAt(facility.lambda, mu, facility.physicians + 1)
  const marginalGain =
    facility.modeledWqMin !== null && isFinite(nextWq)
      ? facility.modeledWqMin - nextWq
      : null

  return (
    <Drawer open={!!facility} onClose={onClose} title={facility.name} width="w-[540px]">
      <div className="flex flex-col gap-4">
        {/* Identity */}
        <section className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">
              {facility.county} County · {int(facility.beds)} beds
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{facility.id}</span>
          </div>
          <StatusBadge status={facility.status} />
        </section>

        {/* Key forward metrics at KNOWN staffing */}
        <section className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border">
          <Metric label="Physicians (c)" value={int(facility.physicians)} />
          <Metric
            label="Modeled Wq"
            value={facility.modeledWqMin === null ? "unstable" : `${fixed(facility.modeledWqMin, 1)}m`}
            tone={facility.modeledWqMin === null ? "bad" : "default"}
          />
          <Metric
            label="Utilization ρ"
            value={pct(facility.rho, 1)}
            tone={facility.rho >= 1 ? "bad" : facility.rho >= 0.9 ? "warn" : "default"}
          />
          <Metric label="Arrival λ" value={`${fixed(facility.lambda, 2)}/h`} />
          <Metric label="Offered load A" value={`${fixed(facility.offeredLoad, 2)} Erl`} />
          <Metric label="P(wait)" value={pct(facility.prWait, 1)} />
        </section>

        {/* Queueing detail */}
        <section className="rounded-sm border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Queueing model · M/M/c
          </div>
          <dl className="divide-y divide-border text-[11px]">
            <Row k="Service rate μ" v={`${fixed(mu, 2)} pt/hr/phys`} />
            <Row k="Min stable physicians" v={int(floor)} />
            <Row
              k="Expected in queue Lq"
              v={facility.lq === null ? "∞ (unstable)" : fixed(facility.lq, 2)}
            />
            <Row
              k="Marginal gain of +1 phys"
              v={marginalGain === null ? "—" : `${fixed(marginalGain, 2)}m saved`}
            />
            <Row
              k="Stability"
              v={facility.stable ? "stable (c·μ > λ)" : "OVERLOADED (c·μ ≤ λ)"}
            />
          </dl>
        </section>

        {/* Wq(c) curve */}
        <section className="rounded-sm border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Wait curve · Wq(c) at λ={fixed(facility.lambda, 2)}, μ={fixed(mu, 2)}
          </div>
          <div className="h-44 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="wqfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis
                  dataKey="c"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  label={{ value: "physicians (c)", position: "insideBottom", offset: -2, fontSize: 9, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 2,
                    fontSize: 11,
                  }}
                  formatter={(v) => [`${Number(v).toFixed(1)}m`, "Wq"]}
                  labelFormatter={(c) => `c = ${c}`}
                />
                <Area
                  type="monotone"
                  dataKey="wq"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  fill="url(#wqfill)"
                />
                <ReferenceLine
                  x={floor}
                  stroke="var(--chart-4)"
                  strokeDasharray="3 3"
                  label={{ value: "min stable", fontSize: 9, fill: "var(--chart-4)", position: "insideTopLeft" }}
                />
                {facility.modeledWqMin !== null && (
                  <ReferenceDot
                    x={facility.physicians}
                    y={Math.min(facility.modeledWqMin, 600)}
                    r={4}
                    fill="var(--chart-1)"
                    stroke="var(--card)"
                    label={{ value: "current", fontSize: 9, fill: "var(--chart-1)", position: "top" }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Equity */}
        <section className="rounded-sm border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Equity context
          </div>
          <dl className="divide-y divide-border text-[11px]">
            <Row k="County SVI" v={`${fixed(facility.svi, 3)} (${sviLabel(facility.svi)})`} />
            <Row k="Equity weight w" v={fixed(facility.weight, 3)} />
            <Row k="Weight formula" v="1 + α · SVI" />
          </dl>
        </section>
      </div>
    </Drawer>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="num text-right text-foreground">{v}</dd>
    </div>
  )
}
