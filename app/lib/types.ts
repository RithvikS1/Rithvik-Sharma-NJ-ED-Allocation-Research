/**
 * Operating status derived from utilization at the facility's KNOWN staffing:
 *  - OVERLOADED: rho >= 1, queue is unstable (wait unbounded) — needs physicians
 *  - AT_RISK:    rho above the risk threshold (heavy load, long waits)
 *  - OK:         comfortably stable
 */
export type FacilityStatus = "OK" | "AT_RISK" | "OVERLOADED"

export interface Facility {
  id: string
  name: string
  county: string
  /** Licensed bed count. */
  beds: number
  /** Arrival rate, patients/hour. */
  lambda: number
  /** KNOWN current physician staffing (parallel servers c), reported by the network. */
  physicians: number
  /**
   * Optional annual ED visit volume (county-level) used to derive lambda by
   * bed proportion. When present the UI can show the derivation.
   */
  countyAnnualVisits?: number
  /** County SVI (0..1); denormalized onto the facility for convenience. */
  svi: number
  archived: boolean
  /**
   * Raw observed queue wait time, in HOURS, for facilities where physician
   * capacity is not directly known. Feeds the backend's implied-capacity
   * root-finder (solves for the c that reproduces this wait under M/M/c).
   * Optional — only meaningful when `impliedCapacity` is not already set.
   */
  observedWqHours?: number
  /**
   * Already-known implied capacity (effective parallel servers), when a
   * facility supplies this directly instead of raw wait-time data. Optional.
   */
  impliedCapacity?: number
}

export interface DerivedFacility extends Facility {
  status: FacilityStatus
  /** Offered load A = lambda / mu (Erlangs). */
  offeredLoad: number
  /** Utilization rho = A / c. */
  rho: number
  /** Probability an arrival waits (Erlang C). */
  prWait: number
  /** Modeled queue wait at current staffing, in MINUTES (null if unstable). */
  modeledWqMin: number | null
  /** Expected number of patients waiting (null if unstable). */
  lq: number | null
  /** Equity weight w = 1 + alpha * SVI. */
  weight: number
  /** Whether the queue is stable at current staffing. */
  stable: boolean
  /** true when derived values are out of date relative to inputs. */
  stale?: boolean
}

export interface Network {
  id: string
  name: string
  facilities: Facility[]
}

export interface ScenarioSnapshot {
  id: string
  name: string
  createdAt: number
  networkName: string
  facilityCount: number
  params: AllocationParamsState
  /** Roster snapshot at save time (non-archived facilities). */
  roster: Facility[]
}

export interface AllocationParamsState {
  mu: number
  cW: number
  alpha: number
  budget: number
}

export const DEFAULT_PARAMS: AllocationParamsState = {
  mu: 2.55,
  cW: 120,
  alpha: 2,
  budget: 40,
}
