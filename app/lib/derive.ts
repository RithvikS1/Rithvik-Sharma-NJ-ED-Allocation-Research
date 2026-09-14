import type { DerivedFacility, Facility, FacilityStatus } from "./types"
import { facilityMetrics, equityWeight, wq } from "./queueing"

/** Utilization at/above this fraction flags a facility AT_RISK. */
export const RISK_RHO = 0.9

/**
 * Compute forward, display-ready metrics for a single facility. Physician
 * staffing is a KNOWN input from the network — there is no inversion or
 * convergence step. `mu` and `alpha` come from the active parameter set.
 */
export function deriveFacility(f: Facility, mu: number, alpha: number): DerivedFacility {
  const m = facilityMetrics(f.lambda, mu, f.physicians)
  const weight = equityWeight(f.svi, alpha)

  let status: FacilityStatus
  if (!m.stable) status = "OVERLOADED"
  else if (m.rho >= RISK_RHO) status = "AT_RISK"
  else status = "OK"

  return {
    ...f,
    status,
    offeredLoad: m.offeredLoad,
    rho: m.rho,
    prWait: m.prWait,
    modeledWqMin: m.stable ? m.wqHours * 60 : null,
    lq: m.stable ? m.lq : null,
    weight,
    stable: m.stable,
  }
}

export function deriveAll(
  facilities: Facility[],
  mu: number,
  alpha: number,
): DerivedFacility[] {
  return facilities.map((f) => deriveFacility(f, mu, alpha))
}

export interface RegistrySummary {
  count: number
  ok: number
  atRisk: number
  overloaded: number
  meanLambda: number
  meanWqMin: number
  medianSvi: number
  totalPhysicians: number
}

export function summarize(derived: DerivedFacility[]): RegistrySummary {
  const count = derived.length
  const ok = derived.filter((d) => d.status === "OK").length
  const atRisk = derived.filter((d) => d.status === "AT_RISK").length
  const overloaded = derived.filter((d) => d.status === "OVERLOADED").length
  const meanLambda = count ? derived.reduce((s, d) => s + d.lambda, 0) / count : 0
  const stableWaits = derived.filter((d) => d.modeledWqMin !== null)
  const meanWqMin = stableWaits.length
    ? stableWaits.reduce((s, d) => s + (d.modeledWqMin ?? 0), 0) / stableWaits.length
    : 0
  const sviSorted = derived.map((d) => d.svi).sort((a, b) => a - b)
  const medianSvi = sviSorted.length
    ? sviSorted.length % 2
      ? sviSorted[(sviSorted.length - 1) / 2]
      : (sviSorted[sviSorted.length / 2 - 1] + sviSorted[sviSorted.length / 2]) / 2
    : 0
  const totalPhysicians = derived.reduce((s, d) => s + d.physicians, 0)
  return { count, ok, atRisk, overloaded, meanLambda, meanWqMin, medianSvi, totalPhysicians }
}

/** Wq (minutes) at an arbitrary c, for provenance/marginal curves. */
export function wqMinAt(lambda: number, mu: number, c: number): number {
  const v = wq(lambda, mu, c)
  return isFinite(v) ? v * 60 : Number.POSITIVE_INFINITY
}
