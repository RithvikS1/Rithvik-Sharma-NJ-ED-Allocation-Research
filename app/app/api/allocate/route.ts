/**
 * POST /api/allocate — MODULE 2
 *
 * Run the equity-weighted greedy allocation of an additional-physician
 * budget across a hospital registry. Chains MODULE 1: a hospital may supply
 * baselineC directly, an already-known impliedCapacity, or observedWqHours
 * (solved via the Module 1 root-finder) — see lib/server/resolve-hospitals.ts.
 *
 * Request body:
 *   {
 *     hospitals: [{
 *       id, name, lambda, svi,
 *       baselineC?: number, impliedCapacity?: number, observedWqHours?: number,
 *       mu?: number
 *     }],
 *     budget: number, alpha: number, mu?: number, cW?: number
 *   }
 *
 * Response body:
 *   { result: AllocationResult, rejected: { record, errors }[] }
 *
 * Note: wqBeforeMinutes/wqAfterMinutes serialize to `null` (via JSON.stringify)
 * when the facility is unstable/unbounded at that capacity.
 */

import { NextRequest, NextResponse } from "next/server"
import { allocate } from "@/lib/server/allocation-engine"
import { resolveHospitals, type RawHospitalInput } from "@/lib/server/resolve-hospitals"
import { validateAllocationParams } from "@/lib/server/validation"

interface AllocateRequestBody {
  hospitals: RawHospitalInput[]
  budget: number
  alpha: number
  mu?: number
  cW?: number
}

export async function POST(req: NextRequest) {
  let body: AllocateRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  if (!body || !Array.isArray(body.hospitals)) {
    return NextResponse.json({ error: "Expected a `hospitals` array." }, { status: 400 })
  }

  const paramErrors = validateAllocationParams(body)
  if (paramErrors.length > 0) {
    return NextResponse.json({ error: "Invalid allocation parameters.", details: paramErrors }, { status: 400 })
  }

  const { resolved, rejected } = resolveHospitals(body.hospitals, body.mu)

  const result = allocate(resolved, {
    budget: body.budget,
    alpha: body.alpha,
    mu: body.mu,
    cW: body.cW,
  })

  return NextResponse.json({ result, rejected })
}
