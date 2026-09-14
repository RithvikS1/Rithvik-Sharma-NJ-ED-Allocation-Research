/**
 * lib/server/validation.ts
 *
 * Input validation shared by the API routes. Invalid records are flagged
 * with per-field error messages rather than throwing, so a batch request can
 * process every valid record and report exactly which rows were skipped and
 * why (mirroring the CSV importer's error-reporting pattern).
 */

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function fieldErrors(checks: Array<[boolean, string]>): string[] {
  return checks.filter(([bad]) => bad).map(([, message]) => message)
}

// ---------------------------------------------------------------------------
// Field-level checks
// ---------------------------------------------------------------------------

export function lambdaErrors(lambda: unknown): string[] {
  return fieldErrors([
    [!isFiniteNumber(lambda), "lambda is missing or not a number."],
    [isFiniteNumber(lambda) && lambda <= 0, "lambda must be a positive number."],
  ])
}

export function sviErrors(svi: unknown): string[] {
  return fieldErrors([
    [!isFiniteNumber(svi), "svi is missing or not a number."],
    [isFiniteNumber(svi) && (svi < 0 || svi > 1), "svi must be within [0, 1]."],
  ])
}

export function idErrors(id: unknown): string[] {
  return fieldErrors([[typeof id !== "string" || id.trim().length === 0, "id is missing or empty."]])
}

// ---------------------------------------------------------------------------
// Record-level validators (used by the API routes)
// ---------------------------------------------------------------------------

export interface CapacityRecordInput {
  id?: unknown
  lambda?: unknown
  observedWqHours?: unknown
  mu?: unknown
}

export function validateCapacityRecord(rec: CapacityRecordInput): { valid: boolean; errors: string[] } {
  const errors = [
    ...idErrors(rec.id),
    ...lambdaErrors(rec.lambda),
    ...fieldErrors([
      [!isFiniteNumber(rec.observedWqHours), "observedWqHours is missing or not a number."],
      [
        isFiniteNumber(rec.observedWqHours) && rec.observedWqHours <= 0,
        "observedWqHours must be a positive number of hours.",
      ],
    ]),
    ...fieldErrors([[rec.mu !== undefined && !isFiniteNumber(rec.mu), "mu must be a number when provided."]]),
  ]
  return { valid: errors.length === 0, errors }
}

export interface AllocationRecordInput {
  id?: unknown
  name?: unknown
  lambda?: unknown
  svi?: unknown
  baselineC?: unknown
}

export function validateAllocationRecord(rec: AllocationRecordInput): { valid: boolean; errors: string[] } {
  const errors = [
    ...idErrors(rec.id),
    ...fieldErrors([[typeof rec.name !== "string" || rec.name.trim().length === 0, "name is missing or empty."]]),
    ...lambdaErrors(rec.lambda),
    ...sviErrors(rec.svi),
    ...fieldErrors([
      [!isFiniteNumber(rec.baselineC), "baselineC is missing or not a number."],
      [isFiniteNumber(rec.baselineC) && rec.baselineC <= 0, "baselineC must be a positive number."],
    ]),
  ]
  return { valid: errors.length === 0, errors }
}

export interface AllocationParamsInput {
  budget?: unknown
  alpha?: unknown
  mu?: unknown
  cW?: unknown
}

export function validateAllocationParams(params: AllocationParamsInput): string[] {
  return fieldErrors([
    [!isFiniteNumber(params.budget) || (params.budget as number) < 0, "budget must be a non-negative number."],
    [!isFiniteNumber(params.alpha), "alpha must be a number."],
    [params.mu !== undefined && (!isFiniteNumber(params.mu) || (params.mu as number) <= 0), "mu must be a positive number when provided."],
    [params.cW !== undefined && (!isFiniteNumber(params.cW) || (params.cW as number) < 0), "cW must be a non-negative number when provided."],
  ])
}

/** Split a batch into valid records and rejected records (with their errors), without throwing. */
export function partitionValid<T>(
  records: T[],
  validate: (r: T) => { valid: boolean; errors: string[] },
): { valid: T[]; rejected: { record: T; errors: string[] }[] } {
  const valid: T[] = []
  const rejected: { record: T; errors: string[] }[] = []
  for (const record of records) {
    const result = validate(record)
    if (result.valid) valid.push(record)
    else rejected.push({ record, errors: result.errors })
  }
  return { valid, rejected }
}
