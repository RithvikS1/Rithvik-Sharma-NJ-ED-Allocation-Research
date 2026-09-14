/**
 * lib/server/resolve-hospitals.ts
 *
 * Chains MODULE 1 into MODULE 2 at the API boundary: turns a raw hospital
 * record (which may carry an already-known baseline capacity, an
 * already-known implied capacity, or raw wait-time data to derive one from)
 * into the resolved { baselineC } shape the allocation engine expects.
 *
 * Resolution order per hospital: baselineC > impliedCapacity > observedWqHours
 * (solved via the Module 1 root-finder). A hospital with none of the three,
 * or whose wait time fails to solve, is rejected rather than guessed at.
 */

import { solveImpliedCapacity } from "./capacity-solver"
import type { AllocationHospitalInput } from "./allocation-engine"
import { idErrors, isFiniteNumber, lambdaErrors, sviErrors } from "./validation"

export interface RawHospitalInput {
  id?: unknown
  name?: unknown
  lambda?: unknown
  svi?: unknown
  baselineC?: unknown
  impliedCapacity?: unknown
  observedWqHours?: unknown
  mu?: unknown
}

export type CapacitySource = "baselineC" | "impliedCapacity" | "solved"

export interface ResolvedHospital extends AllocationHospitalInput {
  capacitySource: CapacitySource
}

export function resolveHospitals(
  hospitals: RawHospitalInput[],
  defaultMu: number | undefined,
): { resolved: ResolvedHospital[]; rejected: { record: RawHospitalInput; errors: string[] }[] } {
  const resolved: ResolvedHospital[] = []
  const rejected: { record: RawHospitalInput; errors: string[] }[] = []

  for (const h of hospitals) {
    const errors = [
      ...idErrors(h.id),
      ...(typeof h.name !== "string" || h.name.trim().length === 0 ? ["name is missing or empty."] : []),
      ...lambdaErrors(h.lambda),
      ...sviErrors(h.svi),
    ]
    if (errors.length > 0) {
      rejected.push({ record: h, errors })
      continue
    }

    const id = h.id as string
    const name = h.name as string
    const lambda = h.lambda as number
    const svi = h.svi as number
    const mu = isFiniteNumber(h.mu) ? h.mu : defaultMu

    if (isFiniteNumber(h.baselineC) && h.baselineC > 0) {
      resolved.push({ id, name, lambda, svi, baselineC: h.baselineC, capacitySource: "baselineC" })
      continue
    }
    if (isFiniteNumber(h.impliedCapacity) && h.impliedCapacity > 0) {
      resolved.push({ id, name, lambda, svi, baselineC: h.impliedCapacity, capacitySource: "impliedCapacity" })
      continue
    }
    if (isFiniteNumber(h.observedWqHours) && h.observedWqHours > 0) {
      const solved = solveImpliedCapacity({ id, lambda, observedWqHours: h.observedWqHours, mu })
      if (!solved.converged || solved.impliedCRounded === null) {
        rejected.push({
          record: h,
          errors: [solved.message ?? "Implied-capacity solve did not converge for this hospital."],
        })
        continue
      }
      resolved.push({ id, name, lambda, svi, baselineC: solved.impliedCRounded, capacitySource: "solved" })
      continue
    }

    rejected.push({
      record: h,
      errors: ["Must supply one of baselineC, impliedCapacity, or observedWqHours."],
    })
  }

  return { resolved, rejected }
}
