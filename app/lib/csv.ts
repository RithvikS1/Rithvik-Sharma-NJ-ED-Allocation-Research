import type { Facility } from "./types"
import { sviForCounty } from "./svi"

/** Columns in the canonical facility CSV, in order. */
export const CSV_COLUMNS = ["name", "county", "beds", "lambda", "physicians", "archived"] as const

/**
 * Optional columns, only recognized when a header row is present (they have
 * no fixed position in the legacy no-header positional format).
 */
export const CSV_OPTIONAL_COLUMNS = ["wq_hours", "implied_capacity"] as const

export interface CsvParseResult {
  facilities: Omit<Facility, "id">[]
  errors: string[]
  rowCount: number
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/**
 * Parse a facility CSV. Tolerates a header row in any column order (matched by
 * name), validates numeric ranges, and returns per-row errors instead of
 * throwing so the importer can show a reviewable report.
 */
export function parseFacilityCsv(text: string): CsvParseResult {
  const errors: string[] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { facilities: [], errors: ["File is empty."], rowCount: 0 }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = header.includes("name") && (header.includes("lambda") || header.includes("beds"))
  const colIndex = (name: string) => header.indexOf(name.toLowerCase())

  const idx = hasHeader
    ? {
        name: colIndex("name"),
        county: colIndex("county"),
        beds: colIndex("beds"),
        lambda: colIndex("lambda"),
        physicians: colIndex("physicians") >= 0 ? colIndex("physicians") : colIndex("docs"),
        archived: colIndex("archived"),
        wqHours: colIndex("wq_hours"),
        impliedCapacity: colIndex("implied_capacity"),
      }
    : { name: 0, county: 1, beds: 2, lambda: 3, physicians: 4, archived: 5, wqHours: -1, impliedCapacity: -1 }

  const dataLines = hasHeader ? lines.slice(1) : lines
  const facilities: Omit<Facility, "id">[] = []

  dataLines.forEach((line, i) => {
    const row = i + (hasHeader ? 2 : 1)
    const cells = splitCsvLine(line)
    const name = idx.name >= 0 ? cells[idx.name] : undefined
    if (!name) {
      errors.push(`Row ${row}: missing facility name — skipped.`)
      return
    }
    const county = idx.county >= 0 ? cells[idx.county] || "Unknown" : "Unknown"
    const beds = Number(idx.beds >= 0 ? cells[idx.beds] : NaN)
    const lambda = Number(idx.lambda >= 0 ? cells[idx.lambda] : NaN)
    const physicians = Number(idx.physicians >= 0 ? cells[idx.physicians] : NaN)

    if (!Number.isFinite(lambda) || lambda <= 0) {
      errors.push(`Row ${row} (${name}): invalid arrival rate λ — skipped.`)
      return
    }
    if (!Number.isFinite(physicians) || physicians < 1 || !Number.isInteger(physicians)) {
      errors.push(`Row ${row} (${name}): physician count must be a positive integer — skipped.`)
      return
    }

    const archivedRaw = idx.archived >= 0 ? (cells[idx.archived] || "").toLowerCase() : ""
    const wqHours = idx.wqHours >= 0 ? Number(cells[idx.wqHours]) : NaN
    const impliedCapacity = idx.impliedCapacity >= 0 ? Number(cells[idx.impliedCapacity]) : NaN
    facilities.push({
      name,
      county,
      beds: Number.isFinite(beds) && beds > 0 ? Math.round(beds) : 0,
      lambda,
      physicians,
      svi: sviForCounty(county),
      archived: archivedRaw === "true" || archivedRaw === "1" || archivedRaw === "yes",
      ...(Number.isFinite(wqHours) && wqHours > 0 ? { observedWqHours: wqHours } : {}),
      ...(Number.isFinite(impliedCapacity) && impliedCapacity > 0 ? { impliedCapacity } : {}),
    })
  })

  return { facilities, errors, rowCount: dataLines.length }
}

function csvCell(v: string | number | boolean): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialize a roster to canonical CSV text (with header row). */
export function facilitiesToCsv(facilities: Facility[]): string {
  const header = [...CSV_COLUMNS, ...CSV_OPTIONAL_COLUMNS].join(",")
  const rows = facilities.map((f) =>
    [
      f.name,
      f.county,
      f.beds,
      f.lambda,
      f.physicians,
      f.archived,
      f.observedWqHours ?? "",
      f.impliedCapacity ?? "",
    ]
      .map(csvCell)
      .join(","),
  )
  return [header, ...rows].join("\n")
}

/** Trigger a client-side download of a text file. */
export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
