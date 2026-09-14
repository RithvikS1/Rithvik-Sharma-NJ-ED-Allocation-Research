/**
 * POST /api/allocate/sweep — alpha-sensitivity sweep
 *
 * Re-runs the MODULE 2 greedy allocation once per alpha value so the
 * frontend can plot how the allocation shifts as the equity dial moves.
 * Hospital resolution (Module 1 chaining) happens once and is reused across
 * every alpha in the sweep.
 *
 * Request body:
 *   {
 *     hospitals: [...],   // same shape as POST /api/allocate
 *     alphas: number[],
 *     budget: number, mu?: number, cW?: number
 *   }
 *
 * Response body:
 *   { sweep: { alpha: number, result: AllocationResult }[], rejected: { record, errors }[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { allocateSweep } from "@/lib/server/allocation-engine"
import { resolveHospitals, type RawHospitalInput } from "@/lib/server/resolve-hospitals"
import { isFiniteNumber, validateAllocationParams } from "@/lib/server/validation"

interface SweepRequestBody {
  hospitals: RawHospitalInput[]
  alphas: number[]
  budget: number
  mu?: number
  cW?: number
}

export async function POST(req: NextRequest) {
  let body: SweepRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  if (!body || !Array.isArray(body.hospitals)) {
    return NextResponse.json({ error: "Expected a `hospitals` array." }, { status: 400 })
  }
  if (!Array.isArray(body.alphas) || body.alphas.length === 0 || !body.alphas.every(isFiniteNumber)) {
    return NextResponse.json({ error: "Expected a non-empty `alphas` array of numbers." }, { status: 400 })
  }

  const paramErrors = validateAllocationParams({ ...body, alpha: body.alphas[0] })
  if (paramErrors.length > 0) {
    return NextResponse.json({ error: "Invalid allocation parameters.", details: paramErrors }, { status: 400 })
  }

  const { resolved, rejected } = resolveHospitals(body.hospitals, body.mu)

  const sweep = allocateSweep(resolved, { budget: body.budget, mu: body.mu, cW: body.cW }, body.alphas)

  return NextResponse.json({ sweep, rejected })
}
