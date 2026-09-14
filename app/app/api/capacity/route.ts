/**
 * POST /api/capacity — MODULE 1
 *
 * Solve implied physician capacity for one or more hospitals from an
 * observed queue wait time (Wq_hours), via root-finding over the M/M/c model.
 *
 * Request body:
 *   {
 *     mu?: number,               // default 2.55, applies to all records unless overridden per-record
 *     hospitals: [{ id: string, lambda: number, observedWqHours: number, mu?: number }]
 *   }
 *
 * Response body:
 *   {
 *     results: CapacitySolveResult[],
 *     rejected: { record: unknown, errors: string[] }[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { solveImpliedCapacityBatch } from "@/lib/server/capacity-solver"
import { partitionValid, validateCapacityRecord, type CapacityRecordInput } from "@/lib/server/validation"

interface CapacityRequestBody {
  mu?: number
  hospitals: CapacityRecordInput[]
}

export async function POST(req: NextRequest) {
  let body: CapacityRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  if (!body || !Array.isArray(body.hospitals)) {
    return NextResponse.json({ error: "Expected a `hospitals` array." }, { status: 400 })
  }

  const { valid, rejected } = partitionValid(body.hospitals, validateCapacityRecord)

  const results = solveImpliedCapacityBatch(
    valid.map((h) => ({
      id: h.id as string,
      lambda: h.lambda as number,
      observedWqHours: h.observedWqHours as number,
      mu: (h.mu as number | undefined) ?? body.mu,
    })),
  )

  return NextResponse.json({ results, rejected })
}
