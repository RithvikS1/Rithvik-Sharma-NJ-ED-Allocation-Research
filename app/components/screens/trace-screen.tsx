"use client"

import { useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Maximize2 } from "lucide-react"
import { ScreenContainer } from "./screen-container"
import { Panel, Btn, Metric, StatusBadge, Slider, HeaderLabel, Modal } from "@/components/dense"
import { useAppStore, useActiveNetwork } from "@/lib/store"
import { COLUMN_HELP } from "@/lib/glossary"
import { wq, minStableC } from "@/lib/queueing"
import { fixed, int } from "@/lib/format"

interface EnrichedStep {
  step: number
  facilityId: string
  facilityName: string
  resultingC: number
  delta: number
  remainingBudget: number
  /** Minutes of aggregate patient-wait saved by THIS placement. */
  minutesSaved: number
  /** Cumulative minutes saved through this step. */
  cumulativeSaved: number
  svi: number
  weight: number
}

export function TraceScreen() {
  const results = useAppStore((s) => s.results)
  const draftParams = useAppStore((s) => s.draftParams)
  const setScreen = useAppStore((s) => s.setScreen)
  const net = useActiveNetwork()

  const { mu } = draftParams

  // Replay the trace to attribute marginal minutes-saved to each step. Wq is a
  // deterministic function of c, so we can reconstruct the pre/post wait at each
  // placement from the resulting c recorded in the trace.
  const steps = useMemo<EnrichedStep[]>(() => {
    if (!results || !net) return []
    const byId = new Map(net.facilities.map((f) => [f.id, f]))
    // Track current c per facility, seeded at the (stability-adjusted) baseline.
    const cById = new Map<string, number>()
    for (const f of results.facilities) cById.set(f.id, f.cBefore)

    let cumulative = 0
    return results.trace.map((t) => {
      const fac = byId.get(t.facilityId)
      const lambda = fac?.lambda ?? 0
      const svi = fac?.svi ?? 0
      const facResult = results.facilities.find((f) => f.id === t.facilityId)
      const cPrev = cById.get(t.facilityId) ?? minStableC(lambda, mu)
      const cNew = t.resultingC
      const wqBefore = wq(lambda, mu, cPrev)
      const wqAfter = wq(lambda, mu, cNew)
      const minutesSaved =
        (Number.isFinite(wqBefore) ? wqBefore : 0) * 60 * lambda -
        (Number.isFinite(wqAfter) ? wqAfter : 0) * 60 * lambda
      cById.set(t.facilityId, cNew)
      cumulative += Number.isFinite(minutesSaved) ? minutesSaved : 0
      return {
        step: t.step,
        facilityId: t.facilityId,
        facilityName: t.facilityName,
        resultingC: cNew,
        delta: t.delta,
        remainingBudget: t.remainingBudget,
        minutesSaved: Number.isFinite(minutesSaved) ? minutesSaved : 0,
        cumulativeSaved: cumulative,
        svi,
        weight: facResult?.weight ?? 1,
      }
    })
  }, [results, net, mu])

  const [cursor, setCursor] = useState<number>(0)
  const [expanded, setExpanded] = useState(false)

  const activeStep = steps.length ? Math.min(cursor, steps.length - 1) : 0

  const chartData = useMemo(
    () =>
      steps.map((s) => ({
        step: s.step,
        cumulative: Math.round(s.cumulativeSaved),
        marginal: Math.round(s.minutesSaved),
      })),
    [steps],
  )

  if (!results || steps.length === 0) {
    return (
      <ScreenContainer
        title="Allocation Trace"
        description="Step-by-step ledger of the greedy allocation loop."
      >
        <Panel title="No trace available">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[12px] text-muted-foreground">
              Run an allocation to generate a decision trace.
            </p>
            <Btn variant="primary" onClick={() => setScreen("console")}>
              Go to Allocation Console
            </Btn>
          </div>
        </Panel>
      </ScreenContainer>
    )
  }

  const cur = steps[activeStep]

  return (
    <ScreenContainer
      title="Allocation Trace"
      description="Each row is one physician placed by the equity-weighted greedy loop, in decision order."
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Physicians placed" value={int(results.trace.length)} />
          <Metric
            label="Total wait saved"
            value={`${int(steps[steps.length - 1]?.cumulativeSaved ?? 0)} min/h`}
            tone="ok"
          />
          <Metric
            label="First-placement gain"
            value={`${int(steps[0]?.minutesSaved ?? 0)} min/h`}
          />
          <Metric
            label="Last-placement gain"
            value={`${int(steps[steps.length - 1]?.minutesSaved ?? 0)} min/h`}
            tone={
              (steps[steps.length - 1]?.minutesSaved ?? 0) <
              (steps[0]?.minutesSaved ?? 0) / 4
                ? "warn"
                : "default"
            }
          />
        </div>

        <Panel
          title="Cumulative patient-wait saved (diminishing returns)"
          right={
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 rounded-[2px] px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Maximize2 className="h-3 w-3" /> Expand
            </button>
          }
        >
          <div className="p-1">
            <CumulativeChart data={chartData} cursorStep={cur.step} height={230} />
          </div>
          <p className="border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
            The dashed line marks the current step. Use the slider below to trace each placement.
          </p>
        </Panel>

        <Modal
          open={expanded}
          onClose={() => setExpanded(false)}
          title="Cumulative patient-wait saved"
          width="max-w-4xl"
        >
          <CumulativeChart data={chartData} cursorStep={cur.step} height={360} />
          <div className="mt-3 flex items-center gap-3">
            <Btn
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              disabled={activeStep === 0}
            >
              ‹ Prev
            </Btn>
            <div className="min-w-0 flex-1">
              <Slider
                value={activeStep}
                min={0}
                max={steps.length - 1}
                step={1}
                onValueChange={(v) => setCursor(v)}
              />
            </div>
            <Btn
              onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
              disabled={activeStep === steps.length - 1}
            >
              Next ›
            </Btn>
            <span className="num shrink-0 text-[11px] text-muted-foreground">
              step {cur.step} / {steps.length}
            </span>
          </div>
        </Modal>

        <Panel
          title="Step inspector"
          right={
            <span className="num text-[10px] text-muted-foreground">
              step {cur.step} / {steps.length}
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Btn
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                disabled={activeStep === 0}
              >
                ‹ Prev
              </Btn>
              <div className="min-w-0 flex-1">
                <Slider
                  value={activeStep}
                  min={0}
                  max={steps.length - 1}
                  step={1}
                  onValueChange={(v) => setCursor(v)}
                />
              </div>
              <Btn
                onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
                disabled={activeStep === steps.length - 1}
              >
                Next ›
              </Btn>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Facility" value={cur.facilityName} />
              <Metric label="New physician count" value={`c = ${int(cur.resultingC)}`} />
              <Metric label="Priority Δ" value={fixed(cur.delta, 1)} />
              <Metric label="Wait saved (step)" value={`${int(cur.minutesSaved)} min/h`} tone="ok" />
            </div>
          </div>
        </Panel>

        <Panel title="Decision ledger" bodyClassName="p-0">
          <div className="max-h-[420px] overflow-auto dense-scroll">
            <table className="w-full min-w-[720px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5 text-right font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Facility</th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="SVI" help={COLUMN_HELP.svi}>SVI</HeaderLabel>
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="Weight" help={COLUMN_HELP.weight}>Weight</HeaderLabel>
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="Resulting c" help={COLUMN_HELP.resultingC}>→ c</HeaderLabel>
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="Priority Δ" help={COLUMN_HELP.priorityDelta}>Priority Δ</HeaderLabel>
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="Saved (min/h)" help={COLUMN_HELP.savedStep}>Saved (min/h)</HeaderLabel>
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    <HeaderLabel label="Budget left" help={COLUMN_HELP.budgetLeft}>Budget left</HeaderLabel>
                  </th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr
                    key={s.step}
                    onClick={() => setCursor(i)}
                    className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-accent ${
                      i === activeStep ? "bg-primary/10" : ""
                    }`}
                  >
                    <td className="px-2 py-1 text-right num text-muted-foreground">{s.step}</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        {s.svi >= 0.75 ? <StatusBadge status="AT_RISK" /> : null}
                        <span className="truncate">{s.facilityName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right num text-muted-foreground">
                      {fixed(s.svi, 3)}
                    </td>
                    <td className="px-2 py-1 text-right num">{fixed(s.weight, 2)}</td>
                    <td className="px-2 py-1 text-right num">{int(s.resultingC)}</td>
                    <td className="px-2 py-1 text-right num text-muted-foreground">
                      {fixed(s.delta, 1)}
                    </td>
                    <td className="px-2 py-1 text-right num" style={{ color: "var(--pos)" }}>
                      {int(s.minutesSaved)}
                    </td>
                    <td className="px-2 py-1 text-right num text-muted-foreground">
                      {int(s.remainingBudget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </ScreenContainer>
  )
}

/**
 * Static cumulative-savings plot. The dashed reference line ("cursor") marks
 * the current step, which the step slider drives. Rendered inline (compact)
 * and in the expand modal (larger) — no pan/zoom, just the tracer.
 */
function CumulativeChart({
  data,
  cursorStep,
  height,
}: {
  data: { step: number; cumulative: number; marginal: number }[]
  cursorStep: number
  height: number
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 16, bottom: 8, left: 4 }}>
          <defs>
            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="step"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 10 }}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              fontSize: 11,
            }}
            formatter={(v, name) => [
              `${int(Number(v))} min/h`,
              name === "cumulative" ? "Cumulative" : "This step",
            ]}
            labelFormatter={(l) => `Step ${l}`}
          />
          <ReferenceLine
            x={cursorStep}
            stroke="var(--chart-4)"
            strokeDasharray="3 3"
            label={{ value: "cursor", fontSize: 9, fill: "var(--chart-4)", position: "insideTopRight" }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="var(--chart-1)"
            fill="url(#cumGrad)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
