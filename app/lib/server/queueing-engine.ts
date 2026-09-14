/**
 * lib/server/queueing-engine.ts
 *
 * Single source of truth for the M/M/c queueing math used by the backend.
 * Both the implied-capacity solver (capacity-solver.ts) and the greedy
 * allocation engine (allocation-engine.ts) import from here — no Erlang-C
 * math is duplicated between them.
 *
 * This module is independent from the client-side lib/queueing.ts that
 * already powers the registry/console UI. lib/queueing.ts assumes physician
 * count (c) is always a known integer input; this module additionally
 * supports evaluating the M/M/c formulas at a continuous (non-integer) c,
 * which the capacity solver needs for root-finding.
 *
 * Fixed model parameter (per spec): mu = 2.55 patients/hour/physician.
 */

export const DEFAULT_MU = 2.55

// ---------------------------------------------------------------------------
// Special functions: log-gamma and the regularized incomplete gamma function
// ---------------------------------------------------------------------------

const LANCZOS_G = 7
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]

/** Natural log of the gamma function (Lanczos approximation). lgamma(n+1) === ln(n!). */
export function lgamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  }
  x -= 1
  let a = LANCZOS_COEF[0]
  const t = x + LANCZOS_G + 0.5
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_COEF[i] / (x + i)
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

const GAMMA_ITMAX = 500
const GAMMA_EPS = 1e-14
const GAMMA_FPMIN = 1e-300

/** Lower regularized incomplete gamma P(a,x), via series expansion. Valid for x < a+1. */
function gammaSeries(a: number, x: number): number {
  if (x <= 0) return 0
  const gln = lgamma(a)
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 0; n < GAMMA_ITMAX; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * GAMMA_EPS) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln)
}

/** Upper regularized incomplete gamma Q(a,x), via modified Lentz continued fraction. Valid for x >= a+1. */
function gammaContinuedFraction(a: number, x: number): number {
  const gln = lgamma(a)
  let b = x + 1 - a
  let c = 1 / GAMMA_FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= GAMMA_ITMAX; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < GAMMA_FPMIN) d = GAMMA_FPMIN
    c = b + an / c
    if (Math.abs(c) < GAMMA_FPMIN) c = GAMMA_FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < GAMMA_EPS) break
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h
}

/**
 * Upper regularized incomplete gamma Q(a,x) = Gamma(a,x) / Gamma(a), for real a > 0, x >= 0.
 * For integer a = n+1 this equals the Poisson(x) survival-complement:
 *   Q(n+1, x) = sum_{k=0}^{n} e^{-x} x^k / k!
 * That identity is the bridge that lets the Erlang formulas below be evaluated
 * at a continuous (non-integer) number of servers.
 */
export function regularizedUpperIncompleteGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN
  if (x === 0) return 1
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x)
}

// ---------------------------------------------------------------------------
// Offered load, utilization, stability
// ---------------------------------------------------------------------------

/** Offered load A = lambda / mu, in Erlangs. */
export function offeredLoad(lambda: number, mu: number): number {
  return lambda / mu
}

/** Utilization rho = A / c. */
export function utilization(lambda: number, mu: number, c: number): number {
  return offeredLoad(lambda, mu) / c
}

/** Minimum INTEGER server count required for a stable queue (c * mu > lambda). */
export function minStableC(lambda: number, mu: number): number {
  return Math.floor(lambda / mu) + 1
}

/** Continuous stability floor: any c must strictly exceed lambda/mu to be stable. */
export function continuousStabilityFloor(lambda: number, mu: number): number {
  return lambda / mu
}

// ---------------------------------------------------------------------------
// Erlang C — discrete (integer c), evaluated directly per the spec formula
// ---------------------------------------------------------------------------

/**
 * Erlang C probability of waiting, for an INTEGER number of servers c.
 *
 *   P_wait(c, R) = [R^c/c! * 1/(1-rho)] / [sum_{k=0}^{c-1} R^k/k! + R^c/c! * 1/(1-rho)]
 *
 * Computed in log space (log-gamma) to avoid factorial overflow. Returns 1.0
 * (system saturated) when rho = R/c >= 1.
 */
export function erlangC(c: number, R: number): number {
  if (c <= 0) return 1
  if (R <= 0) return 0
  const rho = R / c
  if (rho >= 1) return 1

  const lnR = Math.log(R)
  const logTerms: number[] = new Array(c)
  for (let k = 0; k < c; k++) {
    logTerms[k] = k * lnR - lgamma(k + 1)
  }
  const logWaitTerm = c * lnR - lgamma(c + 1) - Math.log(1 - rho)

  let maxLog = logWaitTerm
  for (let k = 0; k < c; k++) if (logTerms[k] > maxLog) maxLog = logTerms[k]

  let sumFinite = 0
  for (let k = 0; k < c; k++) sumFinite += Math.exp(logTerms[k] - maxLog)
  const waitTerm = Math.exp(logWaitTerm - maxLog)

  return waitTerm / (sumFinite + waitTerm)
}

// ---------------------------------------------------------------------------
// Erlang C — continuous (real-valued c), via the incomplete-gamma extension
// ---------------------------------------------------------------------------

/**
 * Erlang B (blocking probability) generalized to a real-valued number of
 * servers c, via:
 *
 *   B(c, R) = [R^c / c!] / [e^R * Q(c+1, R)]
 *           = exp(c*ln(R) - lgamma(c+1) - R - ln(Q(c+1, R)))
 *
 * This is the standard continuous extension of Erlang B used for fractional
 * trunk/server dimensioning, built on the Poisson-CDF <-> incomplete-gamma
 * identity (see regularizedUpperIncompleteGamma).
 */
export function erlangBContinuous(c: number, R: number): number {
  if (c <= 0) return 1
  if (R <= 0) return 0
  const logQ = Math.log(regularizedUpperIncompleteGamma(c + 1, R))
  const logB = c * Math.log(R) - lgamma(c + 1) - R - logQ
  return Math.exp(logB)
}

/**
 * Erlang C probability of waiting at a real-valued (continuous) number of
 * servers c, derived from the continuous Erlang B via the standard
 * B-to-C conversion:
 *
 *   C(c, R) = B(c, R) / (1 - (R/c) * (1 - B(c, R)))
 *
 * Returns 1.0 when rho = R/c >= 1 (unstable).
 */
export function erlangCContinuous(c: number, R: number): number {
  if (c <= 0) return 1
  if (R <= 0) return 0
  const rho = R / c
  if (rho >= 1) return 1
  const B = erlangBContinuous(c, R)
  const denom = 1 - rho * (1 - B)
  return B / denom
}

// ---------------------------------------------------------------------------
// Expected queue wait E[W]
// ---------------------------------------------------------------------------

/**
 * Expected wait in queue, hours, at an INTEGER number of servers c.
 *   E[W](c) = P_wait(c, R) / (c*mu - lambda)
 * Returns +Infinity when unstable (c*mu <= lambda).
 */
export function wq(lambda: number, mu: number, c: number): number {
  if (c * mu <= lambda) return Number.POSITIVE_INFINITY
  const R = offeredLoad(lambda, mu)
  return erlangC(c, R) / (c * mu - lambda)
}

/**
 * Expected wait in queue, hours, at a continuous (real-valued) c. Used by the
 * implied-capacity root-finder. Returns +Infinity when unstable (c*mu <= lambda).
 */
export function wqContinuous(lambda: number, mu: number, c: number): number {
  if (c * mu <= lambda) return Number.POSITIVE_INFINITY
  const R = offeredLoad(lambda, mu)
  return erlangCContinuous(c, R) / (c * mu - lambda)
}

// ---------------------------------------------------------------------------
// Equity weighting and marginal savings (shared by the allocation engine)
// ---------------------------------------------------------------------------

/** Equity weight w_i = 1 + alpha * SVI_i. */
export function equityWeight(svi: number, alpha: number): number {
  return 1 + alpha * svi
}

/**
 * Marginal savings of adding one more physician at a facility currently
 * staffed at c (integer):
 *   MS(c) = C_w * lambda * (E[W](c) - E[W](c+1))
 * Dollars per hour of aggregate waiting time avoided. A transition out of
 * instability (before = Infinity, after finite) is treated as a large but
 * finite gain rather than Infinity, so it stays comparable on a max-heap.
 */
export function marginalSavings(lambda: number, mu: number, c: number, cW: number): number {
  const before = wq(lambda, mu, c)
  const after = wq(lambda, mu, c + 1)
  const LARGE_WAIT_HOURS = 1e6
  if (!Number.isFinite(before)) {
    const effectiveBefore = LARGE_WAIT_HOURS
    const effectiveAfter = Number.isFinite(after) ? after : LARGE_WAIT_HOURS
    return cW * lambda * (effectiveBefore - effectiveAfter)
  }
  return cW * lambda * (before - after)
}

/** Greedy priority score: score_i(c) = w_i * MS_i(c). */
export function priorityScore(
  lambda: number,
  mu: number,
  c: number,
  cW: number,
  weight: number,
): number {
  return weight * marginalSavings(lambda, mu, c, cW)
}
