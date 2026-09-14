/**
 * lib/server/allocation-engine.ts — MODULE 2
 *
 * Equity-weighted greedy allocation of an additional-physician budget across
 * a hospital registry, using a max-heap so each step is O(log n) rather than
 * a brute-force rescan of every hospital.
 *
 * Shares all queueing math with the implied-capacity solver via
 * lib/server/queueing-engine.ts — no Erlang-C/Wq math is duplicated here.
 */

import {
  DEFAULT_MU,
  equityWeight,
  marginalSavings,
  minStableC,
  priorityScore,
  wq,
} from "./queueing-engine"

export const DEFAULT_COST_PER_WAIT_HOUR = 120.0

export interface AllocationHospitalInput {
  id: string
  name: string
  lambda: number
  svi: number
  /** Starting capacity: implied_c_rounded (from Module 1) or a known capacity. */
  baselineC: number
}

export interface AllocationParams {
  mu?: number
  /** Dollar-cost penalty per hour of aggregate patient wait. Default 120.0. */
  cW?: number
  /** Equity dial. */
  alpha: number
  /** Additional physicians to distribute. */
  budget: number
}

export interface AllocationLogEntry {
  step: number
  hospitalId: string
  hospitalName: string
  /** Capacity at this hospital immediately after this physician is placed. */
  resultingC: number
  /** Greedy priority score at the moment this hospital was selected. */
  score: number
  remainingBudget: number
}

export interface AllocationHospitalResult {
  id: string
  name: string
  svi: number
  lambda: number
  weight: number
  cStart: number
  cEnd: number
  added: number
  /** True if baselineC was below the stability floor and had to be bumped up first. */
  stabilityAdjusted: boolean
  /** Expected wait, MINUTES, before allocation (at cStart). Infinity if unstable. */
  wqBeforeMinutes: number
  /** Expected wait, MINUTES, after allocation (at cEnd). Infinity if unstable. */
  wqAfterMinutes: number
  /** wqBeforeMinutes - wqAfterMinutes. */
  minutesSaved: number
  marginalSavingsAtFinal: number
}

export interface AllocationResult {
  hospitals: AllocationHospitalResult[]
  /** Full step-by-step allocation order/log, in decision order. */
  log: AllocationLogEntry[]
  budgetRequested: number
  budgetUsed: number
  /** Human-readable notes, e.g. stability-floor bumps applied before the loop. */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Binary max-heap keyed on greedy score
// ---------------------------------------------------------------------------

interface HeapEntry {
  score: number
  index: number
}

class MaxHeap {
  private items: HeapEntry[] = []

  get size(): number {
    return this.items.length
  }

  push(entry: HeapEntry): void {
    this.items.push(entry)
    this.siftUp(this.items.length - 1)
  }

  pop(): HeapEntry | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const last = this.items.pop() as HeapEntry
    if (this.items.length > 0) {
      this.items[0] = last
      this.siftDown(0)
    }
    return top
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].score >= this.items[i].score) break
      ;[this.items[parent], this.items[i]] = [this.items[i], this.items[parent]]
      i = parent
    }
  }

  private siftDown(i: number): void {
    const n = this.items.length
    for (;;) {
      let largest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.items[l].score > this.items[largest].score) largest = l
      if (r < n && this.items[r].score > this.items[largest].score) largest = r
      if (largest === i) break
      ;[this.items[largest], this.items[i]] = [this.items[i], this.items[largest]]
      i = largest
    }
  }
}

// ---------------------------------------------------------------------------
// Greedy allocation
// ---------------------------------------------------------------------------

/**
 * Distribute `params.budget` additional physicians across `hospitals` by
 * equity-weighted marginal-savings priority.
 *
 * Wq is convex decreasing in c, so marginal savings is non-increasing as a
 * hospital receives more physicians — the objective is monotone submodular,
 * and this greedy algorithm attains at least (1 - 1/e) of the optimum under
 * the fixed-budget cardinality constraint (Nemhauser, Wolsey & Fisher 1978).
 */
export function allocate(
  hospitals: AllocationHospitalInput[],
  params: AllocationParams,
): AllocationResult {
  const mu = params.mu ?? DEFAULT_MU
  const cW = params.cW ?? DEFAULT_COST_PER_WAIT_HOUR
  const { alpha, budget } = params

  const warnings: string[] = []

  const state = hospitals.map((h) => {
    const weight = equityWeight(h.svi, alpha)
    const floor = minStableC(h.lambda, mu)
    let cStart = h.baselineC
    let stabilityAdjusted = false
    if (cStart * mu <= h.lambda) {
      warnings.push(
        `${h.name} (${h.id}): starting capacity ${cStart} is below the stability floor; bumped to ${floor} before allocation.`,
      )
      cStart = floor
      stabilityAdjusted = true
    }
    return { ...h, weight, cStart, c: cStart, stabilityAdjusted }
  })

  const heap = new MaxHeap()
  state.forEach((s, index) => {
    heap.push({ score: priorityScore(s.lambda, mu, s.c, cW, s.weight), index })
  })

  const log: AllocationLogEntry[] = []
  let remaining = budget

  for (let step = 0; step < budget; step++) {
    const top = heap.pop()
    if (!top) break
    const s = state[top.index]
    s.c += 1
    remaining -= 1
    log.push({
      step: step + 1,
      hospitalId: s.id,
      hospitalName: s.name,
      resultingC: s.c,
      score: top.score,
      remainingBudget: remaining,
    })
    heap.push({ score: priorityScore(s.lambda, mu, s.c, cW, s.weight), index: top.index })
  }

  const results: AllocationHospitalResult[] = state.map((s) => {
    const wqBeforeHours = wq(s.lambda, mu, s.cStart)
    const wqAfterHours = wq(s.lambda, mu, s.c)
    const wqBeforeMinutes = wqBeforeHours * 60
    const wqAfterMinutes = wqAfterHours * 60
    const minutesSaved =
      Number.isFinite(wqBeforeMinutes) && Number.isFinite(wqAfterMinutes)
        ? wqBeforeMinutes - wqAfterMinutes
        : Number.isFinite(wqAfterMinutes)
          ? Number.POSITIVE_INFINITY
          : 0
    return {
      id: s.id,
      name: s.name,
      svi: s.svi,
      lambda: s.lambda,
      weight: s.weight,
      cStart: s.cStart,
      cEnd: s.c,
      added: s.c - s.cStart,
      stabilityAdjusted: s.stabilityAdjusted,
      wqBeforeMinutes,
      wqAfterMinutes,
      minutesSaved,
      marginalSavingsAtFinal: marginalSavings(s.lambda, mu, s.c, cW),
    }
  })

  return {
    hospitals: results,
    log,
    budgetRequested: budget,
    budgetUsed: budget - remaining,
    warnings,
  }
}

/**
 * Alpha-sensitivity sweep: re-runs the greedy allocation once per alpha
 * value so the caller can see how allocation shifts as the equity dial moves.
 */
export function allocateSweep(
  hospitals: AllocationHospitalInput[],
  params: Omit<AllocationParams, "alpha">,
  alphas: number[],
): { alpha: number; result: AllocationResult }[] {
  return alphas.map((alpha) => ({ alpha, result: allocate(hospitals, { ...params, alpha }) }))
}
