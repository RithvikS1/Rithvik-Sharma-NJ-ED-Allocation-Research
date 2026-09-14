/** Fixed-precision numeric formatting for right-aligned monospace columns. */

export function fixed(n: number | null | undefined, dp: number): string {
  if (n === null || n === undefined || !isFinite(n)) return "—"
  return n.toFixed(dp)
}

export function signedFixed(n: number | null | undefined, dp: number): string {
  if (n === null || n === undefined || !isFinite(n)) return "—"
  const s = n.toFixed(dp)
  return n > 0 ? `+${s}` : s
}

export function int(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—"
  return String(Math.round(n))
}

export function usd(n: number | null | undefined, dp = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

export function pct(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—"
  return `${(n * 100).toFixed(dp)}%`
}

export function hoursToMin(h: number | null | undefined): number | null {
  if (h === null || h === undefined || !isFinite(h)) return null
  return h * 60
}

export function timestamp(ms: number): string {
  const d = new Date(ms)
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z"
}

/** Alias for `int` used by shell components. */
export const fmtInt = int

/** Compact relative time, e.g. "12s ago", "3m ago". */
export function fmtRelTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 1000) return "just now"
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
