import type { Facility, Network } from "./types"
import { sviForCounty } from "./svi"

interface SeedRow {
  name: string
  county: string
  beds: number
  /** Arrival rate, patients/hour. */
  lambda: number
  /** KNOWN current physician staffing reported by the network. */
  physicians: number
}

// 25 New Jersey emergency departments with their KNOWN current physician
// staffing. At the default service rate (mu = 2.55 patients/hr/physician) this
// roster spans a realistic operating spread: a few departments are OVERLOADED
// (rho >= 1, unbounded wait) and are the primary allocation targets, several
// run AT_RISK (rho >= 0.9), and the remainder are comfortably stable.
const SEED_ROWS: SeedRow[] = [
  { name: "University Hospital", county: "Essex", beds: 519, lambda: 8.7, physicians: 3 },
  { name: "Newark Beth Israel Medical Center", county: "Essex", beds: 665, lambda: 7.9, physicians: 4 },
  { name: "Hackensack University Medical Center", county: "Bergen", beds: 781, lambda: 8.2, physicians: 4 },
  { name: "Jersey City Medical Center", county: "Hudson", beds: 316, lambda: 7.1, physicians: 3 },
  { name: "Cooper University Hospital", county: "Camden", beds: 635, lambda: 7.6, physicians: 3 },
  { name: "St. Joseph's University Medical Center", county: "Passaic", beds: 651, lambda: 8.0, physicians: 3 },
  { name: "Robert Wood Johnson University Hospital", county: "Middlesex", beds: 610, lambda: 7.4, physicians: 3 },
  { name: "Morristown Medical Center", county: "Morris", beds: 703, lambda: 6.8, physicians: 3 },
  { name: "Virtua Voorhees Hospital", county: "Camden", beds: 460, lambda: 6.1, physicians: 3 },
  { name: "Monmouth Medical Center", county: "Monmouth", beds: 527, lambda: 5.4, physicians: 3 },
  { name: "Ocean University Medical Center", county: "Ocean", beds: 358, lambda: 5.9, physicians: 3 },
  { name: "AtlantiCare Regional Medical Center", county: "Atlantic", beds: 567, lambda: 6.3, physicians: 3 },
  { name: "Inspira Medical Center Vineland", county: "Cumberland", beds: 292, lambda: 5.2, physicians: 2 },
  { name: "Trinitas Regional Medical Center", county: "Union", beds: 531, lambda: 5.7, physicians: 3 },
  { name: "Capital Health Regional Medical Center", county: "Mercer", beds: 280, lambda: 5.5, physicians: 3 },
  { name: "Overlook Medical Center", county: "Union", beds: 504, lambda: 5.0, physicians: 2 },
  { name: "The Valley Hospital", county: "Bergen", beds: 451, lambda: 4.6, physicians: 2 },
  { name: "JFK University Medical Center", county: "Middlesex", beds: 498, lambda: 4.9, physicians: 2 },
  { name: "Bayshore Medical Center", county: "Monmouth", beds: 194, lambda: 3.8, physicians: 2 },
  { name: "Chilton Medical Center", county: "Morris", beds: 252, lambda: 3.4, physicians: 2 },
  { name: "Southern Ocean Medical Center", county: "Ocean", beds: 176, lambda: 3.1, physicians: 2 },
  { name: "CentraState Medical Center", county: "Monmouth", beds: 284, lambda: 3.6, physicians: 2 },
  { name: "Salem Medical Center", county: "Salem", beds: 126, lambda: 1.6, physicians: 1 },
  { name: "Cape Regional Medical Center", county: "Cape May", beds: 242, lambda: 1.9, physicians: 1 },
  { name: "Hunterdon Medical Center", county: "Hunterdon", beds: 178, lambda: 2.0, physicians: 1 },
]

export function buildSeedFacilities(): Facility[] {
  return SEED_ROWS.map((r, i) => ({
    id: `njf-${String(i + 1).padStart(3, "0")}`,
    name: r.name,
    county: r.county,
    beds: r.beds,
    lambda: r.lambda,
    physicians: r.physicians,
    svi: sviForCounty(r.county),
    archived: false,
  }))
}

export function buildSeedNetwork(): Network {
  return {
    id: "net-nj-primary",
    name: "New Jersey Statewide Network",
    facilities: buildSeedFacilities(),
  }
}

/**
 * An empty network used as the initial state. The registry starts blank so the
 * user can choose to upload a CSV, add facilities manually, or load the
 * built-in diverse mock roster.
 */
export function buildBlankNetwork(): Network {
  return {
    id: "net-nj-primary",
    name: "New Jersey Statewide Network",
    facilities: [],
  }
}
