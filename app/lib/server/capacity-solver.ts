/**
 * lib/server/capacity-solver.ts — MODULE 1
 *
 * Back-calculates a hospital's implied physician capacity from an observed
 * queue wait time, by root-finding the continuous c that reproduces it under
 * the M/M/c model:
 *
 *   find c such that E[W](c) == Wq_hours
 *
 * E[W] is strictly decreasing in c (from +Infinity just above the stability
 * floor, down toward 0 as c grows), so for any Wq_hours > 0 a unique root
 * exists and bisection on a bracketing interval is guaranteed to converge.
 * The theoretical floor on achievable wait is 0 (approached as c -> Infinity)
 * — an observed wait at or below that floor has no root and is flagged as
 * non-convergent rather than guessed at.
 */

import { DEFAULT_MU, continuousStabilityFloor, minStableC, wqContinuous } from "./queueing-engine"

const BISECTION_TOL_C = 1e-9
const BISECTION_MAX_ITER = 200
const BRACKET_EXPAND_MAX_ITER = 64

export interface CapacitySolveInput {
  id: string
  lambda: number
  /** Observed queue wait time, in HOURS, to back-solve capacity from. */
  observedWqHours: number
  mu?: number
}

export interface CapacitySolveResult {
  id: string
  lambda: number
  mu: number
  observedWqHours: number
  /** Integer stability floor: floor(lambda/mu) + 1. */
  cMin: number
  /** Continuous root, or null if the solver did not converge. */
  impliedC: number | null
  /** Rounded implied capacity, clamped to be >= cMin. Null if non-convergent. */
  impliedCRounded: number | null
  converged: boolean
  /** True if the rounded root fell below cMin and had to be bumped up. */
  flooredUp: boolean
  iterations: number
  message?: string
}

/**
 * Solve for implied capacity at a single hospital via bisection.
 */
export function solveImpliedCapacity(input: CapacitySolveInput): CapacitySolveResult {
  const { id, lambda, observedWqHours } = input
  const mu = input.mu ?? DEFAULT_MU
  const cMin = minStableC(lambda, mu)

  const notConverged = (message: string, iterations = 0): CapacitySolveResult => ({
    id,
    lambda,
    mu,
    observedWqHours,
    cMin,
    impliedC: null,
    impliedCRounded: null,
    converged: false,
    flooredUp: false,
    iterations,
    message,
  })

  if (!Number.isFinite(observedWqHours) || observedWqHours <= 0) {
    return notConverged(
      "Observed wait time is at or below the theoretical floor (0 hours) — no finite capacity reproduces it.",
    )
  }

  const floor = continuousStabilityFloor(lambda, mu)
  // Bracket just above the stability floor: Wq -> +Infinity as c -> floor+.
  const epsilon = Math.max(floor, 1) * 1e-9
  let lo = floor + epsilon
  const f = (c: number) => wqContinuous(lambda, mu, c) - observedWqHours

  const fLo = f(lo)
  if (!(fLo > 0)) {
    // Degenerate: even infinitesimally above the floor the model wait is
    // already at/under target. Nudge lo further out and re-check once.
    lo = floor + epsilon * 10
    if (!(f(lo) > 0)) {
      return notConverged(
        "Could not bracket a root just above the stability floor — observed wait time is implausibly low for this arrival rate.",
      )
    }
  }

  // Expand hi until f(hi) <= 0 (Wq(hi) <= target), doubling the span each time.
  let span = Math.max(cMin, 1) * 2
  let hi = floor + span
  let expandIters = 0
  while (f(hi) > 0 && expandIters < BRACKET_EXPAND_MAX_ITER) {
    span *= 2
    hi = floor + span
    expandIters++
  }
  if (f(hi) > 0) {
    return notConverged(
      "Observed wait time is below the theoretical floor achievable within the search bounds — could not bracket a root.",
      expandIters,
    )
  }

  let iterations = 0
  let mid = lo
  for (; iterations < BISECTION_MAX_ITER; iterations++) {
    mid = (lo + hi) / 2
    const fm = f(mid)
    if (Math.abs(hi - lo) < BISECTION_TOL_C) break
    if (fm > 0) {
      lo = mid
    } else {
      hi = mid
    }
  }

  const impliedC = mid
  let impliedCRounded = Math.round(impliedC)
  let flooredUp = false
  if (impliedCRounded < cMin) {
    impliedCRounded = cMin
    flooredUp = true
  }

  return {
    id,
    lambda,
    mu,
    observedWqHours,
    cMin,
    impliedC,
    impliedCRounded,
    converged: true,
    flooredUp,
    iterations,
  }
}

/** Solve implied capacity for a batch of hospitals. */
export function solveImpliedCapacityBatch(inputs: CapacitySolveInput[]): CapacitySolveResult[] {
  return inputs.map(solveImpliedCapacity)
}
