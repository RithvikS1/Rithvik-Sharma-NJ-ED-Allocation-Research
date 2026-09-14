import { describe, it, expect } from "vitest"
import { allocate, allocateSweep, type AllocationHospitalInput } from "./allocation-engine"
import { equityWeight, marginalSavings, minStableC } from "./queueing-engine"

describe("allocate — hand-checkable 2-hospital case", () => {
  it("identical load, different SVI: the higher-weighted hospital wins the single unit", () => {
    // Same lambda/baselineC => identical marginal savings for both hospitals;
    // the only difference is equity weight, so the score comparison — and
    // therefore the winner — is fully determined by hand:
    //   score_H1 = (1 + 1*1.0) * MS = 2 * MS
    //   score_H2 = (1 + 1*0.0) * MS = 1 * MS
    // H1 must win the single physician in the budget.
    const hospitals: AllocationHospitalInput[] = [
      { id: "h1", name: "High SVI", lambda: 5, svi: 1.0, baselineC: 3 },
      { id: "h2", name: "Low SVI", lambda: 5, svi: 0.0, baselineC: 3 },
    ]
    const result = allocate(hospitals, { mu: 2.55, cW: 120, alpha: 1, budget: 1 })

    expect(result.log).toHaveLength(1)
    expect(result.log[0].hospitalId).toBe("h1")
    const h1 = result.hospitals.find((h) => h.id === "h1")!
    const h2 = result.hospitals.find((h) => h.id === "h2")!
    expect(h1.added).toBe(1)
    expect(h2.added).toBe(0)
  })

  it("matches the hand-computed score used to pick the first placement", () => {
    const hospitals: AllocationHospitalInput[] = [
      { id: "h1", name: "High SVI", lambda: 5, svi: 1.0, baselineC: 3 },
      { id: "h2", name: "Low SVI", lambda: 5, svi: 0.0, baselineC: 3 },
    ]
    const mu = 2.55,
      cW = 120,
      alpha = 1
    const expectedScoreH1 = equityWeight(1.0, alpha) * marginalSavings(5, mu, 3, cW)
    const result = allocate(hospitals, { mu, cW, alpha, budget: 1 })
    expect(result.log[0].score).toBeCloseTo(expectedScoreH1, 8)
  })
})

describe("allocate — 3-hospital synthetic run", () => {
  const hospitals: AllocationHospitalInput[] = [
    { id: "a", name: "A", lambda: 8, svi: 0.9, baselineC: 4 },
    { id: "b", name: "B", lambda: 3, svi: 0.2, baselineC: 3 },
    { id: "c", name: "C", lambda: 6, svi: 0.5, baselineC: 4 },
  ]
  const params = { mu: 2.55, cW: 120, alpha: 2, budget: 10 }

  it("distributes exactly the budget", () => {
    const res = allocate(hospitals, params)
    const totalAdded = res.hospitals.reduce((s, h) => s + h.added, 0)
    expect(res.budgetUsed).toBe(10)
    expect(totalAdded).toBe(10)
    expect(res.log).toHaveLength(10)
  })

  it("log remaining-budget counts down to zero", () => {
    const res = allocate(hospitals, params)
    expect(res.log[0].remainingBudget).toBe(9)
    expect(res.log[res.log.length - 1].remainingBudget).toBe(0)
  })

  it("log resultingC is monotone non-decreasing per hospital", () => {
    const res = allocate(hospitals, params)
    const seen: Record<string, number> = {}
    for (const step of res.log) {
      const prev = seen[step.hospitalId] ?? 0
      expect(step.resultingC).toBeGreaterThan(prev)
      seen[step.hospitalId] = step.resultingC
    }
  })

  it("before/after Wq comparison: minutesSaved matches wqBefore - wqAfter", () => {
    const res = allocate(hospitals, params)
    for (const h of res.hospitals) {
      if (Number.isFinite(h.wqBeforeMinutes) && Number.isFinite(h.wqAfterMinutes)) {
        expect(h.minutesSaved).toBeCloseTo(h.wqBeforeMinutes - h.wqAfterMinutes, 6)
      }
    }
  })

  it("bumps hospitals below the stability floor and warns", () => {
    const unstable: AllocationHospitalInput[] = [{ id: "u", name: "U", lambda: 9, svi: 0.5, baselineC: 1 }]
    const res = allocate(unstable, { mu: 2.55, cW: 120, alpha: 2, budget: 0 })
    expect(res.hospitals[0].stabilityAdjusted).toBe(true)
    expect(res.hospitals[0].cStart).toBe(minStableC(9, 2.55))
    expect(res.warnings.length).toBeGreaterThan(0)
  })

  it("equity weighting steers budget toward the high-SVI site", () => {
    const equityRes = allocate(hospitals, { ...params, alpha: 8 })
    const efficiencyRes = allocate(hospitals, { ...params, alpha: 0 })
    const highSviEquity = equityRes.hospitals.find((h) => h.id === "a")!.added
    const highSviEfficiency = efficiencyRes.hospitals.find((h) => h.id === "a")!.added
    expect(highSviEquity).toBeGreaterThanOrEqual(highSviEfficiency)
  })
})

describe("allocateSweep", () => {
  const hospitals: AllocationHospitalInput[] = [
    { id: "a", name: "A", lambda: 8, svi: 0.9, baselineC: 4 },
    { id: "b", name: "B", lambda: 3, svi: 0.2, baselineC: 3 },
    { id: "c", name: "C", lambda: 6, svi: 0.5, baselineC: 4 },
  ]

  it("runs one allocation per alpha and each uses the full budget", () => {
    const sweep = allocateSweep(hospitals, { mu: 2.55, cW: 120, budget: 10 }, [0, 2, 8])
    expect(sweep).toHaveLength(3)
    for (const { alpha, result } of sweep) {
      expect([0, 2, 8]).toContain(alpha)
      expect(result.budgetUsed).toBe(10)
    }
  })

  it("higher alpha never decreases the high-SVI hospital's allocation", () => {
    const sweep = allocateSweep(hospitals, { mu: 2.55, cW: 120, budget: 10 }, [0, 2, 8])
    const addedByAlpha = sweep.map((s) => s.result.hospitals.find((h) => h.id === "a")!.added)
    expect(addedByAlpha[1]).toBeGreaterThanOrEqual(addedByAlpha[0])
    expect(addedByAlpha[2]).toBeGreaterThanOrEqual(addedByAlpha[1])
  })
})
