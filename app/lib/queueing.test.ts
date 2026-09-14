import { describe, it, expect } from "vitest"
import {
  lgamma,
  erlangC,
  wq,
  offeredLoad,
  utilization,
  minStableC,
  facilityMetrics,
  equityWeight,
  marginalSavings,
  allocate,
} from "./queueing"

describe("lgamma", () => {
  it("matches ln(n!) for small integers", () => {
    // lgamma(n+1) === ln(n!)
    expect(lgamma(1)).toBeCloseTo(Math.log(1), 10) // 0! = 1
    expect(lgamma(2)).toBeCloseTo(Math.log(1), 10) // 1! = 1
    expect(lgamma(3)).toBeCloseTo(Math.log(2), 10) // 2! = 2
    expect(lgamma(4)).toBeCloseTo(Math.log(6), 10) // 3! = 6
    expect(lgamma(6)).toBeCloseTo(Math.log(120), 10) // 5! = 120
    expect(lgamma(11)).toBeCloseTo(Math.log(3628800), 8) // 10! = 3628800
  })
})

describe("erlangC — reference values", () => {
  it("A=2, c=3 => 4/9", () => {
    expect(erlangC(3, 2)).toBeCloseTo(4 / 9, 10)
  })
  it("A=1, c=2 => 1/3", () => {
    expect(erlangC(2, 1)).toBeCloseTo(1 / 3, 10)
  })
  it("M/M/1: A=0.5, c=1 => rho (0.5)", () => {
    expect(erlangC(1, 0.5)).toBeCloseTo(0.5, 10)
  })
  it("returns 1 when unstable (rho >= 1)", () => {
    expect(erlangC(2, 2)).toBe(1)
    expect(erlangC(2, 3)).toBe(1)
  })
  it("is stable and finite for large c (no factorial overflow)", () => {
    const p = erlangC(200, 180)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
    expect(Number.isFinite(p)).toBe(true)
  })
  it("is strictly decreasing in c", () => {
    const a = erlangC(5, 3)
    const b = erlangC(6, 3)
    const c = erlangC(7, 3)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })
})

describe("offeredLoad / utilization / minStableC", () => {
  it("A = lambda / mu", () => {
    expect(offeredLoad(5, 2.55)).toBeCloseTo(1.960784, 5)
  })
  it("rho = A / c", () => {
    expect(utilization(5, 2.55, 3)).toBeCloseTo(0.653595, 5)
  })
  it("minStableC = floor(lambda/mu) + 1", () => {
    expect(minStableC(5, 2.55)).toBe(2)
    expect(minStableC(9, 2.55)).toBe(4)
  })
})

describe("wq", () => {
  it("M/M/1: Wq = lambda / (mu (mu - lambda))", () => {
    // lambda=1, mu=2, c=1 -> 0.5
    expect(wq(1, 2, 1)).toBeCloseTo(0.5, 10)
  })
  it("returns Infinity when unstable", () => {
    expect(wq(5, 2.55, 1)).toBe(Number.POSITIVE_INFINITY)
    expect(wq(5, 2.55, 2)).not.toBe(Number.POSITIVE_INFINITY)
  })
  it("decreases as c increases", () => {
    expect(wq(5, 2.55, 3)).toBeGreaterThan(wq(5, 2.55, 4))
  })
})

describe("facilityMetrics — forward computation at KNOWN staffing", () => {
  it("computes utilization and a finite wait for a stable facility", () => {
    const m = facilityMetrics(6, 2.55, 4)
    expect(m.stable).toBe(true)
    expect(m.rho).toBeCloseTo(6 / (4 * 2.55), 6)
    expect(Number.isFinite(m.wqHours)).toBe(true)
    expect(m.wqHours).toBeGreaterThan(0)
  })

  it("Wq matches the standalone wq() at the same c", () => {
    const m = facilityMetrics(6, 2.55, 4)
    expect(m.wqHours).toBeCloseTo(wq(6, 2.55, 4), 10)
  })

  it("flags an understaffed facility as unstable with infinite wait", () => {
    // lambda=8.7, c=3 => 3*2.55=7.65 < 8.7 => overloaded
    const m = facilityMetrics(8.7, 2.55, 3)
    expect(m.stable).toBe(false)
    expect(m.wqHours).toBe(Number.POSITIVE_INFINITY)
    expect(m.lq).toBe(Number.POSITIVE_INFINITY)
    expect(m.rho).toBeGreaterThan(1)
  })

  it("Lq = lambda * Wq for a stable facility (Little's law)", () => {
    const m = facilityMetrics(5, 2.55, 3)
    expect(m.lq).toBeCloseTo(5 * m.wqHours, 10)
  })
})

describe("equityWeight", () => {
  it("w = 1 + alpha * SVI", () => {
    expect(equityWeight(0.5, 2)).toBe(2)
    expect(equityWeight(0.9, 2)).toBeCloseTo(2.8, 10)
  })
})

describe("marginalSavings", () => {
  it("is non-increasing in c (submodularity)", () => {
    const ms3 = marginalSavings(6, 2.55, 3, 120)
    const ms4 = marginalSavings(6, 2.55, 4, 120)
    const ms5 = marginalSavings(6, 2.55, 5, 120)
    expect(ms3).toBeGreaterThanOrEqual(ms4)
    expect(ms4).toBeGreaterThanOrEqual(ms5)
  })
})

describe("allocate", () => {
  const inputs = [
    { id: "a", name: "A", lambda: 8, svi: 0.9, baselineC: 4 },
    { id: "b", name: "B", lambda: 3, svi: 0.2, baselineC: 3 },
    { id: "c", name: "C", lambda: 6, svi: 0.5, baselineC: 4 },
  ]
  const params = { mu: 2.55, cW: 120, alpha: 2, budget: 10 }

  it("distributes exactly the budget", () => {
    const res = allocate(inputs, params)
    const totalReceived = res.facilities.reduce((s, f) => s + f.received, 0)
    expect(res.budgetUsed).toBe(10)
    expect(totalReceived).toBe(10)
    expect(res.trace).toHaveLength(10)
  })

  it("trace remaining budget counts down to zero", () => {
    const res = allocate(inputs, params)
    expect(res.trace[0].remainingBudget).toBe(9)
    expect(res.trace[res.trace.length - 1].remainingBudget).toBe(0)
  })

  it("bumps facilities below the stability floor and records it", () => {
    const unstable = [{ id: "u", name: "U", lambda: 9, svi: 0.5, baselineC: 1 }]
    const res = allocate(unstable, { mu: 2.55, cW: 120, alpha: 2, budget: 0 })
    expect(res.facilities[0].stabilityAdjusted).toBe(true)
    expect(res.facilities[0].cBefore).toBe(minStableC(9, 2.55))
  })

  it("equity weighting steers budget toward high-SVI sites", () => {
    const equityRes = allocate(inputs, { ...params, alpha: 8 })
    const efficiencyRes = allocate(inputs, { ...params, alpha: 0 })
    const highSviEquity = equityRes.facilities.find((f) => f.id === "a")!.received
    const highSviEfficiency = efficiencyRes.facilities.find((f) => f.id === "a")!.received
    expect(highSviEquity).toBeGreaterThanOrEqual(highSviEfficiency)
  })
})
