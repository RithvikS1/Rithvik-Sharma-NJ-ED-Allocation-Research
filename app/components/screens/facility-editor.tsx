"use client"

import { useEffect, useState } from "react"
import type { Facility } from "@/lib/types"
import { NJ_COUNTIES, sviForCounty, sviLabel } from "@/lib/svi"
import { Drawer, Btn, Field, TextInput, Select, Callout } from "@/components/dense"
import { fixed } from "@/lib/format"

export interface EditorTarget {
  mode: "add" | "edit"
  facility?: Facility
}

interface Draft {
  name: string
  county: string
  beds: string
  lambda: string
  physicians: string
  archived: boolean
  observedWqHours: string
  impliedCapacity: string
}

function toDraft(f?: Facility): Draft {
  return {
    name: f?.name ?? "",
    county: f?.county ?? NJ_COUNTIES[0].county,
    beds: f ? String(f.beds) : "",
    lambda: f ? String(f.lambda) : "",
    physicians: f ? String(f.physicians) : "",
    archived: f?.archived ?? false,
    observedWqHours: f?.observedWqHours !== undefined ? String(f.observedWqHours) : "",
    impliedCapacity: f?.impliedCapacity !== undefined ? String(f.impliedCapacity) : "",
  }
}

export function FacilityEditor({
  target,
  onClose,
  onSubmit,
}: {
  target: EditorTarget | null
  onClose: () => void
  onSubmit: (mode: "add" | "edit", id: string | undefined, patch: Omit<Facility, "id" | "svi">) => void
}) {
  const [draft, setDraft] = useState<Draft>(toDraft())
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (target) {
      setDraft(toDraft(target.facility))
      setTouched(false)
    }
  }, [target])

  if (!target) return null

  const lambda = Number(draft.lambda)
  const physicians = Number(draft.physicians)
  const observedWqHours = draft.observedWqHours.trim() ? Number(draft.observedWqHours) : undefined
  const impliedCapacity = draft.impliedCapacity.trim() ? Number(draft.impliedCapacity) : undefined
  const errors: Record<string, string> = {}
  if (!draft.name.trim()) errors.name = "Name is required."
  if (!Number.isFinite(lambda) || lambda <= 0) errors.lambda = "λ must be a positive number."
  if (!Number.isFinite(physicians) || physicians < 1 || !Number.isInteger(physicians))
    errors.physicians = "Physicians must be a positive integer."
  if (observedWqHours !== undefined && (!Number.isFinite(observedWqHours) || observedWqHours <= 0))
    errors.observedWqHours = "Observed Wq must be a positive number of hours."
  if (impliedCapacity !== undefined && (!Number.isFinite(impliedCapacity) || impliedCapacity <= 0))
    errors.impliedCapacity = "Implied capacity must be a positive number."

  const valid = Object.keys(errors).length === 0
  const svi = sviForCounty(draft.county)

  function submit() {
    setTouched(true)
    if (!valid || !target) return
    onSubmit(target.mode, target.facility?.id, {
      name: draft.name.trim(),
      county: draft.county,
      beds: Math.max(0, Math.round(Number(draft.beds) || 0)),
      lambda,
      physicians,
      archived: draft.archived,
      ...(observedWqHours !== undefined ? { observedWqHours } : {}),
      ...(impliedCapacity !== undefined ? { impliedCapacity } : {}),
    })
    onClose()
  }

  return (
    <Drawer
      open={!!target}
      onClose={onClose}
      title={target.mode === "add" ? "Add facility" : `Edit — ${target.facility?.name}`}
      width="w-[440px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={submit} disabled={!valid}>
            {target.mode === "add" ? "Add facility" : "Save changes"}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-3">
        <Field label="Facility name" error={touched ? errors.name : undefined}>
          <TextInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Riverside Medical Center"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="County">
            <Select
              value={draft.county}
              onChange={(e) => setDraft({ ...draft, county: e.target.value })}
            >
              {NJ_COUNTIES.map((c) => (
                <option key={c.county} value={c.county}>
                  {c.county}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Staffed beds">
            <TextInput
              inputMode="numeric"
              value={draft.beds}
              onChange={(e) => setDraft({ ...draft, beds: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrival rate λ (patients/hr)" error={touched ? errors.lambda : undefined}>
            <TextInput
              inputMode="decimal"
              value={draft.lambda}
              onChange={(e) => setDraft({ ...draft, lambda: e.target.value })}
              placeholder="6.0"
            />
          </Field>
          <Field
            label="Physicians on duty (c)"
            error={touched ? errors.physicians : undefined}
          >
            <TextInput
              inputMode="numeric"
              value={draft.physicians}
              onChange={(e) => setDraft({ ...draft, physicians: e.target.value })}
              placeholder="4"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Observed wait Wq (hours)"
            error={touched ? errors.observedWqHours : undefined}
          >
            <TextInput
              inputMode="decimal"
              value={draft.observedWqHours}
              onChange={(e) => setDraft({ ...draft, observedWqHours: e.target.value })}
              placeholder="optional"
            />
          </Field>
          <Field
            label="Known implied capacity"
            error={touched ? errors.impliedCapacity : undefined}
          >
            <TextInput
              inputMode="decimal"
              value={draft.impliedCapacity}
              onChange={(e) => setDraft({ ...draft, impliedCapacity: e.target.value })}
              placeholder="optional"
            />
          </Field>
        </div>

        <Callout tone="info" title="Implied capacity (optional)">
          Backend-only inputs used by the implied-capacity solver, independent of the "Physicians
          on duty" field above. Supply an observed queue wait to have the backend back-solve an
          implied capacity, or an already-known implied capacity to skip solving entirely.
        </Callout>

        <Callout tone="info" title="County SVI (auto-derived)">
          {draft.county} maps to a Social Vulnerability Index of{" "}
          <span className="num">{fixed(svi, 3)}</span> ({sviLabel(svi)} vulnerability). This drives the
          equity weight applied during allocation and cannot be edited directly.
        </Callout>

        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={draft.archived}
            onChange={(e) => setDraft({ ...draft, archived: e.target.checked })}
            className="h-3.5 w-3.5 accent-primary"
          />
          Archived (excluded from allocation runs)
        </label>
      </div>
    </Drawer>
  )
}
