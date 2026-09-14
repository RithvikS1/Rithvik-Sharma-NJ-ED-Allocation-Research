"use client"

import { useMemo } from "react"
import { Play, RotateCcw } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { ScreenContainer } from "./screen-container"
import { ParamsPanel } from "./params-panel"
import { Panel, Btn, Metric, ThInfo } from "@/components/dense"
import { useAppStore, useActiveNetwork } from "@/lib/store"
import { COLUMN_HELP } from "@/lib/glossary"
import { deriveAll } from "@/lib/derive"
import { sviColor, SVI_GRADIENT } from "@/lib/svi"
import { fixed, int, signedFixed } from "@/lib/format"

export function ConsoleScreen() {
  const draftParams = useAppStore((s) => s.draftParams)
  const results = useAppStore((s) => s.results)
  const stale = useAppStore((s) => s.stale)
  const runAllocation = useAppStore((s) => s.runAllocation)
  const resetDraftParams = useAppStore((s) => s.resetDraftParams)
  const net = useActiveNetwork()

  // Pre-run projection of current overloaded/at-risk facilities for context.
  const derived = useMemo(
    () =>
      deriveAll(
        (net?.facilities ?? []).filter((f) => !f.archived),
        draftParams.mu,
        draftParams.alpha,
      ),
    [net?.facilities, draftParams.mu, draftParams.alpha],
  )
  const overloaded = derived.filter((d) => d.status === "OVERLOADED").length
  const atRisk = derived.filter((d) => d.status === "AT_RISK").length

  const summary = useMemo(() => {
    if (!results) return null
    const totalSaved = results.facilities.reduce(
      (a, f) => a + (Number.isFinite(f.minutesSaved) ? f.minutesSaved : 0),
      0,
    )
    // A facility is "stabilized" when it was overloaded at its reported staffing
    // (bumped to the stability floor before the greedy loop) and received at
    // least one additional physician on top of that floor.
    const stabilized = results.facilities.filter(
      (f) => f.stabilityAdjusted && f.cAfter > f.cBefore,
    ).length
    const boosted = results.facilities.filter((f) => f.received > 0).length
    return { totalSaved, stabilized, boosted }
  }, [results])

  const chartData = useMemo(() => {
    if (!results) return []
    return results.facilities
      .filter((f) => f.received > 0)
      .sort((a, b) => b.received - a.received)
      .slice(0, 14)
      .map((f) => ({
        name:
          f.name.replace(/(University|Regional|Medical Center|Hospital)/g, "").trim() || f.name,
        received: f.received,
        svi: f.svi,
      }))
  }, [results])

  return (
    <ScreenContainer
      title="Allocation Console"
      description="Distribute a physician budget by equity-weighted marginal benefit."
      actions={
        <div className="flex items-center gap-2">
          <Btn onClick={resetDraftParams}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Btn>
          <Btn variant="primary" onClick={runAllocation}>
            <Play className="h-3.5 w-3.5" /> Run allocation
          </Btn>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Parameters */}
        <div className="flex flex-col gap-4">
          <Panel title="Parameters">
            <div className="p-3">
              <ParamsPanel />
            </div>
          </Panel>
          <Panel title="Pre-run network state">
            <div className="grid grid-cols-2 gap-px bg-border">
              <Metric label="Active facilities" value={int(derived.length)} />
              <Metric label="Physician budget" value={int(draftParams.budget)} />
              <Metric
                label="Overloaded"
                value={int(overloaded)}
                tone={overloaded ? "bad" : "default"}
              />
              <Metric label="At risk" value={int(atRisk)} tone={atRisk ? "warn" : "default"} />
            </div>
          </Panel>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          {!results ? (
            <Panel title="Results">
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <p className="text-[12px] text-muted-foreground">No allocation has been run yet.</p>
                <Btn variant="primary" onClick={runAllocation}>
                  <Play className="h-3.5 w-3.5" /> Run allocation
                </Btn>
              </div>
            </Panel>
          ) : (
            <>
              {stale && (
                <div className="flex items-center gap-2 border border-[color-mix(in_srgb,var(--warn)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warn)_10%,var(--card))] px-3 py-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                  Parameters changed since last run — results are stale. Re-run to refresh.
                </div>
              )}

              <Panel title="Allocation summary">
                <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
                  <Metric label="Physicians allocated" value={int(results.budgetUsed)} />
                  <Metric label="Facilities boosted" value={int(summary?.boosted ?? 0)} />
                  <Metric
                    label="Facilities stabilized"
                    value={int(summary?.stabilized ?? 0)}
                    tone={summary?.stabilized ? "ok" : "default"}
                  />
                  <Metric
                    label="Patient-wait saved"
                    value={`${int(summary?.totalSaved ?? 0)} min/h`}
                    tone="ok"
                  />
                </div>
              </Panel>

              <Panel title={`Physicians received — top ${chartData.length}`}>
                <div className="h-56 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        angle={-35}
                        textAnchor="end"
                        height={64}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--accent)" }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 2,
                          fontSize: 11,
                        }}
                        formatter={(v, _n, item) => [
                          `${v} physicians · SVI ${fixed(item?.payload?.svi ?? 0, 2)}`,
                          "Received",
                        ]}
                      />
                      <Bar dataKey="received" radius={[2, 2, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={sviColor(d.svi)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">SVI</span>
                  <span>0.0</span>
                  <span
                    className="h-2 flex-1 rounded-[1px] border border-border"
                    style={{ background: SVI_GRADIENT }}
                    aria-hidden
                  />
                  <span>1.0</span>
                  <span className="text-muted-foreground">bar color = county vulnerability</span>
                </div>
              </Panel>

              <Panel title="Per-facility outcome" bodyClassName="p-0">
                <div className="max-h-[420px] overflow-auto dense-scroll">
                  <table className="w-full min-w-[720px] border-collapse text-[11px]">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr className="[&>th]:border-b [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                        <th>Facility</th>
                        <ThInfo right label="Weight" help={COLUMN_HELP.weight}>
                          Weight
                        </ThInfo>
                        <ThInfo right label="c before" help={COLUMN_HELP.physicians}>
                          c before
                        </ThInfo>
                        <ThInfo right label="+Δ" help={COLUMN_HELP.received}>
                          +Δ
                        </ThInfo>
                        <ThInfo right label="c after" help={COLUMN_HELP.cAfter}>
                          c after
                        </ThInfo>
                        <ThInfo right label="Wq before" help={COLUMN_HELP.wqBefore}>
                          Wq before
                        </ThInfo>
                        <ThInfo right label="Wq after" help={COLUMN_HELP.wqAfter}>
                          Wq after
                        </ThInfo>
                        <ThInfo right label="Min saved" help={COLUMN_HELP.minutesSaved}>
                          Min saved
                        </ThInfo>
                      </tr>
                    </thead>
                    <tbody>
                      {[...results.facilities]
                        .sort((a, b) => b.received - a.received || b.weight - a.weight)
                        .map((f) => (
                          <tr
                            key={f.id}
                            className="border-b border-border last:border-0 hover:bg-accent"
                          >
                            <td className="px-2 py-1 font-medium text-foreground">
                              {f.name}
                              {f.stabilityAdjusted && (
                                <span className="ml-1.5 rounded-[2px] bg-[color-mix(in_srgb,var(--info)_18%,transparent)] px-1 text-[9px] text-[var(--info)]">
                                  stab-adj
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-right num">{fixed(f.weight, 2)}</td>
                            <td className="px-2 py-1 text-right num">{int(f.cBefore)}</td>
                            <td
                              className="px-2 py-1 text-right num font-medium"
                              style={{ color: f.received > 0 ? "var(--primary)" : undefined }}
                            >
                              {f.received > 0 ? `+${f.received}` : "—"}
                            </td>
                            <td className="px-2 py-1 text-right num">{int(f.cAfter)}</td>
                            <td className="px-2 py-1 text-right num">
                              {Number.isFinite(f.wqBefore) ? `${fixed(f.wqBefore * 60, 1)}m` : "∞"}
                            </td>
                            <td className="px-2 py-1 text-right num">
                              {Number.isFinite(f.wqAfter) ? `${fixed(f.wqAfter * 60, 1)}m` : "∞"}
                            </td>
                            <td
                              className="px-2 py-1 text-right num"
                              style={{ color: f.minutesSaved > 0.05 ? "var(--pos)" : undefined }}
                            >
                              {Number.isFinite(f.minutesSaved) && f.minutesSaved > 0.05
                                ? signedFixed(f.minutesSaved, 1)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </ScreenContainer>
  )
}
