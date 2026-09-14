import { describe, it, expect } from "vitest"
import {
  lgamma,
  erlangC,
  erlangCContinuous,
  wq,
  wqContinuous,
  offeredLoad,
  utilization,
  minStableC,
  continuousStabilityFloor,
  equityWeight,
  marginalSavings,
  priorityScore,
} from "./queueing-engine"

describe("lgamma", () => {
  it("matches ln(n!) for small integers", () => {
    expect(lgamma(1)).toBeCloseTo(Math.log(1), 10) // 0!
    expect(lgamma(2)).toBeCloseTo(Math.log(1), 10) // 1!
    expect(lgamma(3)).toBeCloseTo(Math.log(2), 10) // 2!
    expect(lgamma(4)).toBeCloseTo(Math.log(6), 10) // 3!
    expect(lgamma(6)).toBeCloseTo(Math.log(120), 10) // 5!
    expect(lgamma(11)).toBeCloseTo(Math.log(3628800), 8) // 10!
  })
})

describe("erlangC — known reference values", () => {
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
  it("stays finite for large c (no factorial overflow)", () => {
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

describe("erlangCContinuous — agrees with the discrete formula at integer c", () => {
  const cases: [number, number][] = [
    [3, 2],
    [2, 1],
    [1, 0.5],
    [5, 3],
    [10, 6],
    [4, 3.5],
  ]
  it.each(cases)("erlangCContinuous(%i, %f) ~= erlangC(%i, %f)", (c, R) => {
    expect(erlangCContinuous(c, R)).toBeCloseTo(erlangC(c, R), 6)
  })
  it("is continuous/monotone between integers", () => {
    const a = erlangCContinuous(4.0, 3)
    const mid = erlangCContinuous(4.5, 3)
    const b = erlangCContinuous(5.0, 3)
    expect(a).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(b)
  })
})

describe("offeredLoad / utilization / minStableC / continuousStabilityFloor", () => {
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
  it("continuousStabilityFloor = lambda/mu", () => {
    expect(continuousStabilityFloor(5, 2.55)).toBeCloseTo(1.960784, 5)
  })
})

describe("wq (discrete)", () => {
  it("M/M/1: Wq = lambda / (mu (mu - lambda))", () => {
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

describe("wqContinuous — agrees with wq at integer c", () => {
  it("matches at several integer c values", () => {
    expect(wqContinuous(5, 2.55, 3)).toBeCloseTo(wq(5, 2.55, 3), 6)
    expect(wqContinuous(5, 2.55, 5)).toBeCloseTo(wq(5, 2.55, 5), 6)
    expect(wqContinuous(1, 2, 1)).toBeCloseTo(0.5, 6)
  })
  it("is monotone decreasing in continuous c", () => {
    const lo = wqContinuous(6, 2.55, 3.2)
    const mid = wqContinuous(6, 2.55, 4.0)
    const hi = wqContinuous(6, 2.55, 4.8)
    expect(lo).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(hi)
  })
  it("returns Infinity at/under the continuous stability floor", () => {
    expect(wqContinuous(5, 2.55, continuousStabilityFloor(5, 2.55))).toBe(Number.POSITIVE_INFINITY)
  })
})

describe("equityWeight", () => {
  it("w = 1 + alpha * SVI", () => {
    expect(equityWeight(0.5, 2)).toBe(2)
    expect(equityWeight(0.9, 2)).toBeCloseTo(2.8, 10)
  })
})

describe("marginalSavings / priorityScore", () => {
  it("is non-increasing in c (submodularity)", () => {
    const ms3 = marginalSavings(6, 2.55, 3, 120)
    const ms4 = marginalSavings(6, 2.55, 4, 120)
    const ms5 = marginalSavings(6, 2.55, 5, 120)
    expect(ms3).toBeGreaterThanOrEqual(ms4)
    expect(ms4).toBeGreaterThanOrEqual(ms5)
  })
  it("matches C_w * lambda * (Wq(c) - Wq(c+1)) exactly", () => {
    const lambda = 6,
      mu = 2.55,
      c = 4,
      cW = 120
    const expected = cW * lambda * (wq(lambda, mu, c) - wq(lambda, mu, c + 1))
    expect(marginalSavings(lambda, mu, c, cW)).toBeCloseTo(expected, 8)
  })
  it("priorityScore = weight * marginalSavings", () => {
    const lambda = 6,
      mu = 2.55,
      c = 4,
      cW = 120,
      weight = 2.5
    expect(priorityScore(lambda, mu, c, cW, weight)).toBeCloseTo(
      weight * marginalSavings(lambda, mu, c, cW),
      10,
    )
  })
})
