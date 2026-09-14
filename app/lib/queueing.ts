/**
 * lib/queueing.ts
 *
 * M/M/c queueing model for emergency-department physician allocation.
 *
 * Each emergency department is modeled as an M/M/c queue:
 *   - Poisson arrivals at rate lambda (patients/hour)
 *   - Exponential service at rate mu (patients/hour) per physician
 *   - c physicians serving in parallel
 *
 * Core relations:
 *   A       = lambda / mu                         // offered load (Erlangs)
 *   rho     = A / c                               // utilization
 *   P_wait  = erlangC(c, A)                       // probability an arrival waits
 *   Wq(c)   = P_wait / (c * mu - lambda)          // expected queue wait, hours
 *
 * Erlang C is evaluated in log space with lgamma to avoid factorial overflow
 * and with max-subtraction for numerical stability.
 */

// ---------------------------------------------------------------------------
// Special functions
// ---------------------------------------------------------------------------

const LGAMMA_G = 7
const LGAMMA_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]

/**
 * Natural log of the gamma function via the Lanczos approximation.
 * lgamma(n+1) === ln(n!) for non-negative integers n.
 */
export function lgamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula: Gamma(x)Gamma(1-x) = pi / sin(pi x)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  }
  x -= 1
  let a = LGAMMA_C[0]
  const t = x + LGAMMA_G + 0.5
  for (let i = 1; i < LGAMMA_G + 2; i++) {
    a += LGAMMA_C[i] / (x + i)
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

// ---------------------------------------------------------------------------
// Offered load and utilization
// ---------------------------------------------------------------------------

/** Offered load A = lambda / mu, in Erlangs. */
export function offeredLoad(lambda: number, mu: number): number {
  return lambda / mu
}

/** Utilization rho = A / c = lambda / (c * mu). */
export function utilization(lambda: number, mu: number, c: number): number {
  return offeredLoad(lambda, mu) / c
}

// ---------------------------------------------------------------------------
// Erlang C
// ---------------------------------------------------------------------------

/**
 * Erlang C formula: probability that an arriving customer must wait.
 *
 *   P_wait = [A^c / (c! (1 - rho))] / [ sum_{k=0}^{c-1} A^k/k! + A^c/(c!(1-rho)) ]
 *
 * Computed entirely in log space. Returns 1.0 when the system is unstable
 * (rho >= 1), since an unstable queue grows without bound and every arrival
 * eventually waits.
 *
 * @param c number of parallel servers (physicians), integer >= 1
 * @param A offered load in Erlangs (lambda / mu)
 */
export function erlangC(c: number, A: number): number {
  if (c <= 0) return 1
  if (A <= 0) return 0
  const rho = A / c
  if (rho >= 1) return 1

  const lnA = Math.log(A)

  // Log of each finite-sum term k = 0..c-1:  ln(A^k / k!) = k*lnA - lgamma(k+1)
  const logTerms: number[] = new Array(c)
  for (let k = 0; k < c; k++) {
    logTerms[k] = k * lnA - lgamma(k + 1)
  }

  // Log of the "waiting" (busy) term: ln(A^c / (c! (1 - rho)))
  const logWait = c * lnA - lgamma(c + 1) - Math.log(1 - rho)

  // Max-subtraction for stability across all log terms.
  let maxLog = logWait
  for (let k = 0; k < c; k++) {
    if (logTerms[k] > maxLog) maxLog = logTerms[k]
  }

  let sumFinite = 0
  for (let k = 0; k < c; k++) {
    sumFinite += Math.exp(logTerms[k] - maxLog)
  }
  const waitTerm = Math.exp(logWait - maxLog)

  return waitTerm / (sumFinite + waitTerm)
}

// ---------------------------------------------------------------------------
// Expected queue wait
// ---------------------------------------------------------------------------

/**
 * Expected waiting time in queue Wq, in the same time units as 1/mu (hours).
 *
 *   Wq(c) = P_wait / (c * mu - lambda)
 *
 * Returns Infinity when the system is unstable (c * mu <= lambda).
 */
export function wq(lambda: number, mu: number, c: number): number {
  if (c * mu <= lambda) return Number.POSITIVE_INFINITY
  const A = offeredLoad(lambda, mu)
  const pWait = erlangC(c, A)
  return pWait / (c * mu - lambda)
}

/** Minimum integer server count required for a stable queue (c * mu > lambda). */
export function minStableC(lambda: number, mu: number): number {
  return Math.floor(lambda / mu) + 1
}

// ---------------------------------------------------------------------------
// Forward facility metrics (staffing is a KNOWN input)
// ---------------------------------------------------------------------------

export interface FacilityMetrics {
  /** Offered load A = lambda / mu (Erlangs). */
  offeredLoad: number
  /** Utilization rho = A / c. */
  rho: number
  /** Probability an arrival must wait (Erlang C). */
  prWait: number
  /** Expected queue wait Wq, in HOURS (Infinity if unstable). */
  wqHours: number
  /** Expected number waiting Lq = lambda * Wq. */
  lq: number
  /** Whether the queue is stable at this staffing (c * mu > lambda). */
  stable: boolean
}

/**
 * Compute forward M/M/c metrics for a facility whose physician count `c` is
 * KNOWN (reported by the network). No inversion is performed.
 */
export function facilityMetrics(lambda: number, mu: number, c: number): FacilityMetrics {
  const A = offeredLoad(lambda, mu)
  const rho = A / c
  const stable = c * mu > lambda
  const prWait = erlangC(c, A)
  const wqHours = stable ? prWait / (c * mu - lambda) : Number.POSITIVE_INFINITY
  const lq = stable ? lambda * wqHours : Number.POSITIVE_INFINITY
  return { offeredLoad: A, rho, prWait, wqHours, lq, stable }
}

// ---------------------------------------------------------------------------
// Equity-weighted greedy allocation
// ---------------------------------------------------------------------------

export interface AllocationFacilityInput {
  id: string
  name: string
  lambda: number
  svi: number
  /** Baseline recovered physician count (implied c). */
  baselineC: number
}

export interface AllocationParams {
  mu: number
  /** Cost per patient-hour of waiting, dollars. */
  cW: number
  /** Equity weight coefficient. */
  alpha: number
  /** Additional physicians to distribute. */
  budget: number
}

export interface AllocationTraceStep {
  step: number
  facilityId: string
  facilityName: string
  /** Resulting c AFTER this physician is placed. */
  resultingC: number
  /** Delta priority score at the time of selection. */
  delta: number
  remainingBudget: number
}

export interface AllocationFacilityResult {
  id: string
  name: string
  svi: number
  lambda: number
  weight: number
  cBefore: number
  cAfter: number
  received: number
  wqBefore: number
  wqAfter: number
  minutesSaved: number
  marginalSavingsAtFinal: number
  /** True if bumped up to the stability floor before the greedy loop. */
  stabilityAdjusted: boolean
}

export interface AllocationResult {
  facilities: AllocationFacilityResult[]
  trace: AllocationTraceStep[]
  budgetUsed: number
}

/** Equity weight w_h = 1 + alpha * SVI_h. */
export function equityWeight(svi: number, alpha: number): number {
  return 1 + alpha * svi
}

/**
 * Marginal savings of adding one physician at a facility currently staffed at c:
 *   MS(h,c) = C_w * lambda_h * [Wq(c) - Wq(c+1)]
 * Dollars per hour of aggregate waiting time avoided.
 */
export function marginalSavings(
  lambda: number,
  mu: number,
  c: number,
  cW: number,
): number {
  const before = wq(lambda, mu, c)
  const after = wq(lambda, mu, c + 1)
  if (!isFinite(before)) {
    // Moving from unstable to stable is treated as a large but finite gain.
    if (isFinite(after)) return cW * lambda * (1e6 - after)
    return cW * lambda * 1e6
  }
  return cW * lambda * (before - after)
}

/** Priority score delta = w_h * MS(h,c). */
export function priorityDelta(
  lambda: number,
  mu: number,
  c: number,
  cW: number,
  weight: number,
): number {
  return weight * marginalSavings(lambda, mu, c, cW)
}

// Simple binary max-heap keyed on `delta`.
interface HeapNode {
  delta: number
  idx: number
}
class MaxHeap {
  private data: HeapNode[] = []
  get size() {
    return this.data.length
  }
  push(node: HeapNode) {
    this.data.push(node)
    this.bubbleUp(this.data.length - 1)
  }
  pop(): HeapNode | undefined {
    if (this.data.length === 0) return undefined
    const top = this.data[0]
    const last = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = last
      this.bubbleDown(0)
    }
    return top
  }
  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.data[parent].delta >= this.data[i].delta) break
      ;[this.data[parent], this.data[i]] = [this.data[i], this.data[parent]]
      i = parent
    }
  }
  private bubbleDown(i: number) {
    const n = this.data.length
    while (true) {
      let largest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.data[l].delta > this.data[largest].delta) largest = l
      if (r < n && this.data[r].delta > this.data[largest].delta) largest = r
      if (largest === i) break
      ;[this.data[largest], this.data[i]] = [this.data[i], this.data[largest]]
      i = largest
    }
  }
}

/**
 * STEP 2 — Equity-weighted greedy allocation of `budget` additional physicians.
 *
 * Wq is convex decreasing in c so MS is non-increasing; the objective is
 * monotone submodular and greedy attains at least (1 - 1/e) ~= 63% of optimal
 * under the fixed-budget cardinality constraint (Nemhauser, Wolsey & Fisher 1978).
 */
export function allocate(
  inputs: AllocationFacilityInput[],
  params: AllocationParams,
): AllocationResult {
  const { mu, cW, alpha, budget } = params

  const state = inputs.map((f) => {
    const weight = equityWeight(f.svi, alpha)
    let c = f.baselineC
    let stabilityAdjusted = false
    const floor = minStableC(f.lambda, mu)
    if (c * mu <= f.lambda) {
      c = floor
      stabilityAdjusted = true
    }
    return {
      ...f,
      weight,
      cBefore: c,
      c,
      stabilityAdjusted,
    }
  })

  const heap = new MaxHeap()
  state.forEach((s, idx) => {
    heap.push({ delta: priorityDelta(s.lambda, mu, s.c, cW, s.weight), idx })
  })

  const trace: AllocationTraceStep[] = []
  let remaining = budget

  for (let step = 0; step < budget; step++) {
    const top = heap.pop()
    if (!top) break
    const s = state[top.idx]
    s.c += 1
    remaining -= 1
    trace.push({
      step: step + 1,
      facilityId: s.id,
      facilityName: s.name,
      resultingC: s.c,
      delta: top.delta,
      remainingBudget: remaining,
    })
    heap.push({ delta: priorityDelta(s.lambda, mu, s.c, cW, s.weight), idx: top.idx })
  }

  const facilities: AllocationFacilityResult[] = state.map((s) => {
    const wqBefore = wq(s.lambda, mu, s.cBefore)
    const wqAfter = wq(s.lambda, mu, s.c)
    const minutesSaved =
      (isFinite(wqBefore) ? wqBefore : 0) * 60 - (isFinite(wqAfter) ? wqAfter : 0) * 60
    return {
      id: s.id,
      name: s.name,
      svi: s.svi,
      lambda: s.lambda,
      weight: s.weight,
      cBefore: s.cBefore,
      cAfter: s.c,
      received: s.c - s.cBefore,
      wqBefore,
      wqAfter,
      minutesSaved: isFinite(wqBefore) ? minutesSaved : Number.POSITIVE_INFINITY,
      marginalSavingsAtFinal: marginalSavings(s.lambda, mu, s.c, cW),
      stabilityAdjusted: s.stabilityAdjusted,
    }
  })

  return { facilities, trace, budgetUsed: budget - remaining }
}
