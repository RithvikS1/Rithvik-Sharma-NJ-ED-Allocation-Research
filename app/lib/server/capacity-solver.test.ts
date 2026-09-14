import { describe, it, expect } from "vitest"
import { solveImpliedCapacity, solveImpliedCapacityBatch } from "./capacity-solver"
import { minStableC, wq, wqContinuous } from "./queueing-engine"

const MU = 2.55

describe("solveImpliedCapacity — recovers a known integer c", () => {
  it("lambda=5, c=3", () => {
    const lambda = 5
    const target = wq(lambda, MU, 3) // hand-computable via Erlang C at c=3
    const result = solveImpliedCapacity({ id: "h1", lambda, observedWqHours: target, mu: MU })
    expect(result.converged).toBe(true)
    expect(result.impliedC).not.toBeNull()
    expect(result.impliedC as number).toBeCloseTo(3, 4)
    expect(result.impliedCRounded).toBe(3)
    expect(result.flooredUp).toBe(false)
  })

  it("lambda=9, c=5", () => {
    const lambda = 9
    const target = wq(lambda, MU, 5)
    const result = solveImpliedCapacity({ id: "h2", lambda, observedWqHours: target, mu: MU })
    expect(result.converged).toBe(true)
    expect(result.impliedCRounded).toBe(5)
  })

  it("batch solves independently", () => {
    const results = solveImpliedCapacityBatch([
      { id: "a", lambda: 5, observedWqHours: wq(5, MU, 3), mu: MU },
      { id: "b", lambda: 9, observedWqHours: wq(9, MU, 5), mu: MU },
    ])
    expect(results.map((r) => r.impliedCRounded)).toEqual([3, 5])
  })
})

describe("solveImpliedCapacity — stability-floor clamp", () => {
  it("bumps a sub-floor rounded root up to cMin and flags it", () => {
    // lambda/mu = 5.61/2.55 = 2.2 -> floor=2, cMin=3. A continuous root at
    // 2.25 (just above the 2.2 stability floor, implying a very long wait)
    // rounds to 2, which is below cMin and must be clamped.
    const lambda = 5.61
    const cMin = minStableC(lambda, MU)
    expect(cMin).toBe(3)
    const target = wqContinuous(lambda, MU, 2.25)
    const result = solveImpliedCapacity({ id: "h3", lambda, observedWqHours: target, mu: MU })
    expect(result.converged).toBe(true)
    expect(result.impliedC as number).toBeCloseTo(2.25, 3)
    expect(result.flooredUp).toBe(true)
    expect(result.impliedCRounded).toBe(cMin)
  })
})

describe("solveImpliedCapacity — non-convergent inputs are flagged, not guessed", () => {
  it("rejects a zero or negative observed wait", () => {
    expect(solveImpliedCapacity({ id: "x", lambda: 5, observedWqHours: 0, mu: MU }).converged).toBe(false)
    expect(solveImpliedCapacity({ id: "x", lambda: 5, observedWqHours: -1, mu: MU }).converged).toBe(false)
  })

  it("non-convergent result carries a message and null implied values", () => {
    const result = solveImpliedCapacity({ id: "x", lambda: 5, observedWqHours: -1, mu: MU })
    expect(result.impliedC).toBeNull()
    expect(result.impliedCRounded).toBeNull()
    expect(result.message).toBeTruthy()
  })

  it("still solves a very small (but positive) target wait", () => {
    const result = solveImpliedCapacity({ id: "y", lambda: 5, observedWqHours: 0.001, mu: MU })
    expect(result.converged).toBe(true)
    expect(result.impliedCRounded as number).toBeGreaterThan(minStableC(5, MU))
  })
})
