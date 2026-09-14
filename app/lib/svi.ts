/**
 * NJ county Social Vulnerability Index (CDC/ATSDR SVI).
 * Overall SVI percentile ranking, 0 (least vulnerable) .. 1 (most vulnerable).
 * Values are representative figures for a demonstration dataset.
 */
export interface CountyRecord {
  county: string
  svi: number
  /** Representative annual ED visit volume for the county. */
  annualEdVisits: number
}

export const NJ_COUNTIES: CountyRecord[] = [
  { county: "Atlantic", svi: 0.72, annualEdVisits: 210000 },
  { county: "Bergen", svi: 0.31, annualEdVisits: 520000 },
  { county: "Burlington", svi: 0.38, annualEdVisits: 260000 },
  { county: "Camden", svi: 0.81, annualEdVisits: 410000 },
  { county: "Cape May", svi: 0.44, annualEdVisits: 78000 },
  { county: "Cumberland", svi: 0.93, annualEdVisits: 138000 },
  { county: "Essex", svi: 0.9, annualEdVisits: 640000 },
  { county: "Gloucester", svi: 0.41, annualEdVisits: 190000 },
  { county: "Hudson", svi: 0.88, annualEdVisits: 470000 },
  { county: "Hunterdon", svi: 0.07, annualEdVisits: 58000 },
  { county: "Mercer", svi: 0.63, annualEdVisits: 250000 },
  { county: "Middlesex", svi: 0.55, annualEdVisits: 540000 },
  { county: "Monmouth", svi: 0.29, annualEdVisits: 360000 },
  { county: "Morris", svi: 0.12, annualEdVisits: 280000 },
  { county: "Ocean", svi: 0.47, annualEdVisits: 430000 },
  { county: "Passaic", svi: 0.86, annualEdVisits: 400000 },
  { county: "Salem", svi: 0.69, annualEdVisits: 52000 },
  { county: "Somerset", svi: 0.09, annualEdVisits: 210000 },
  { county: "Sussex", svi: 0.22, annualEdVisits: 95000 },
  { county: "Union", svi: 0.74, annualEdVisits: 420000 },
  { county: "Warren", svi: 0.34, annualEdVisits: 72000 },
]

export const NJ_COUNTY_MAP: Record<string, CountyRecord> = Object.fromEntries(
  NJ_COUNTIES.map((c) => [c.county, c]),
)

export function sviForCounty(county: string): number {
  return NJ_COUNTY_MAP[county]?.svi ?? 0.5
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/* Blue ramp anchors: light (low vulnerability) → deep navy (high). Keeping
 * the whole scale within the theme's blues so encoding stays consistent. */
const SVI_LOW_RGB = [206, 226, 238] as const // #cee2ee
const SVI_HIGH_RGB = [7, 55, 99] as const // #073763 (brand navy)

/**
 * Continuous CSS color for a county's Social Vulnerability Index. SVI is a
 * single yearly value in [0,1]; it is encoded as one continuous shade of
 * blue — light for low vulnerability, deep navy for high — rather than
 * bucketed into quartiles.
 */
export function sviColor(svi: number): string {
  const t = clamp01(svi)
  const mix = (i: 0 | 1 | 2) =>
    Math.round(SVI_LOW_RGB[i] + (SVI_HIGH_RGB[i] - SVI_LOW_RGB[i]) * t)
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`
}

/** Short qualitative descriptor for a continuous SVI value (display only). */
export function sviLabel(svi: number): string {
  if (svi < 0.35) return "low"
  if (svi < 0.65) return "moderate"
  if (svi < 0.85) return "high"
  return "very high"
}

/** CSS gradient spanning the full SVI scale, for a continuous legend bar. */
export const SVI_GRADIENT = `linear-gradient(90deg, ${sviColor(0)} 0%, ${sviColor(
  0.5,
)} 50%, ${sviColor(1)} 100%)`

/** Fuzzy county name match for CSV import (case/space/punctuation tolerant). */
export function fuzzyMatchCounty(raw: string): string | null {
  if (!raw) return null
  const norm = (s: string) => s.toLowerCase().replace(/county/g, "").replace(/[^a-z]/g, "")
  const target = norm(raw)
  if (!target) return null
  // exact normalized match
  for (const c of NJ_COUNTIES) {
    if (norm(c.county) === target) return c.county
  }
  // prefix / contains match
  for (const c of NJ_COUNTIES) {
    const n = norm(c.county)
    if (n.startsWith(target) || target.startsWith(n)) return c.county
  }
  // Levenshtein within distance 2
  let best: { county: string; dist: number } | null = null
  for (const c of NJ_COUNTIES) {
    const d = levenshtein(target, norm(c.county))
    if (best === null || d < best.dist) best = { county: c.county, dist: d }
  }
  if (best && best.dist <= 2) return best.county
  return null
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      prev = tmp
    }
  }
  return dp[n]
}
