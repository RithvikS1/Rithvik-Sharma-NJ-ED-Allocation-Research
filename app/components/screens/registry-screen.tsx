"use client"

import { useMemo, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { ScreenContainer } from "./screen-container"
import { FacilityDrawer } from "./facility-drawer"
import { FacilityEditor, type EditorTarget } from "./facility-editor"
import { CsvImportModal } from "./csv-import-modal"
import { Btn, StatusBadge, TextInput, Chip, Metric, Provenance, InfoTip } from "@/components/dense"
import { useDerived } from "@/lib/use-derived"
import { useAppStore } from "@/lib/store"
import { COLUMN_HELP } from "@/lib/glossary"
import { fixed, int, pct } from "@/lib/format"
import { sviLabel, sviColor } from "@/lib/svi"
import type { DerivedFacility, Facility, FacilityStatus } from "@/lib/types"
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Upload, Database } from "lucide-react"

const col = createColumnHelper<DerivedFacility>()

const STATUS_FILTERS: { id: FacilityStatus | "ALL"; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "OK", label: "OK" },
  { id: "AT_RISK", label: "At risk" },
  { id: "OVERLOADED", label: "Overloaded" },
]

export function RegistryScreen() {
  const { derived, summary } = useDerived()
  const addFacility = useAppStore((s) => s.addFacility)
  const updateFacility = useAppStore((s) => s.updateFacility)
  const mergeRoster = useAppStore((s) => s.mergeRoster)
  const replaceRoster = useAppStore((s) => s.replaceRoster)
  const loadSample = useAppStore((s) => s.loadSample)

  const [sorting, setSorting] = useState<SortingState>([{ id: "rho", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<FacilityStatus | "ALL">("ALL")
  const [selected, setSelected] = useState<DerivedFacility | null>(null)
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const empty = derived.length === 0

  function onEditorSubmit(
    mode: "add" | "edit",
    id: string | undefined,
    patch: Omit<Facility, "id" | "svi">,
  ) {
    if (mode === "add") {
      const { archived, ...rest } = patch
      addFacility(rest)
    } else if (id) {
      updateFacility(id, patch)
    }
    setEditorTarget(null)
  }

  const rows = useMemo(
    () => (statusFilter === "ALL" ? derived : derived.filter((d) => d.status === statusFilter)),
    [derived, statusFilter],
  )

  const columns = useMemo(
    () => [
      col.accessor("name", {
        header: "Facility",
        cell: (c) => (
          <div className="flex flex-col">
            <span className="truncate font-medium text-foreground">{c.getValue()}</span>
            <span className="text-[10px] text-muted-foreground">
              {c.row.original.county} · {int(c.row.original.beds)} beds
            </span>
          </div>
        ),
      }),
      col.accessor("lambda", {
        header: "λ (/h)",
        cell: (c) => <span className="num">{fixed(c.getValue(), 2)}</span>,
        meta: { right: true, help: COLUMN_HELP.lambda },
      }),
      col.accessor("physicians", {
        header: "Phys c",
        cell: (c) => <span className="num font-medium">{int(c.getValue())}</span>,
        meta: { right: true, help: COLUMN_HELP.physicians },
      }),
      col.accessor("rho", {
        header: "ρ",
        cell: (c) => {
          const v = c.getValue()
          const r = c.row.original
          const tone = v >= 1 ? "text-bad" : v >= 0.9 ? "text-warn" : "text-foreground"
          return (
            <Provenance
              formula="ρ = λ / (c · μ)"
              inputs={[
                { k: "λ", v: fixed(r.lambda, 2) },
                { k: "c", v: int(r.physicians) },
                { k: "A = λ/μ", v: `${fixed(r.offeredLoad, 2)} Erl` },
              ]}
            >
              <span className={`num font-medium ${tone}`}>{pct(v, 0)}</span>
            </Provenance>
          )
        },
        meta: { right: true, help: COLUMN_HELP.rho },
      }),
      col.accessor("modeledWqMin", {
        header: "Wq",
        cell: (c) => {
          const v = c.getValue()
          if (v === null) return <span className="num text-bad">unstable</span>
          return <span className="num">{fixed(v, 1)}m</span>
        },
        sortUndefined: "last",
        meta: { right: true, help: COLUMN_HELP.wq },
      }),
      col.accessor("prWait", {
        header: "P(wait)",
        cell: (c) => <span className="num text-muted-foreground">{pct(c.getValue(), 0)}</span>,
        meta: { right: true, help: COLUMN_HELP.prWait },
      }),
      col.accessor("svi", {
        header: "SVI",
        cell: (c) => (
          <span className="inline-flex items-center justify-end gap-1.5 num">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-[1px]"
              style={{ background: sviColor(c.getValue()) }}
            />
            {fixed(c.getValue(), 3)}
            <span className="text-[9px] text-muted-foreground">{sviLabel(c.getValue())}</span>
          </span>
        ),
        meta: { right: true, help: COLUMN_HELP.svi },
      }),
      col.accessor("weight", {
        header: "Weight",
        cell: (c) => <span className="num">{fixed(c.getValue(), 3)}</span>,
        meta: { right: true, help: COLUMN_HELP.weight },
      }),
      col.accessor("status", {
        header: "Status",
        cell: (c) => <StatusBadge status={c.getValue()} />,
        sortingFn: (a, b) => a.original.status.localeCompare(b.original.status),
        meta: { help: COLUMN_HELP.status },
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) => {
      const v = String(value).toLowerCase()
      return (
        row.original.name.toLowerCase().includes(v) ||
        row.original.county.toLowerCase().includes(v)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <ScreenContainer
      title="Facility Registry"
      description="Network roster with known physician staffing; utilization and wait are computed from the M/M/c model."
      actions={
        <>
          <Btn onClick={() => setImportOpen(true)}>
            <Upload className="h-3 w-3" /> Import CSV
          </Btn>
          <Btn variant="primary" onClick={() => setEditorTarget({ mode: "add" })}>
            <Plus className="h-3 w-3" /> Add facility
          </Btn>
        </>
      }
      noPad
    >
      {empty ? (
        <div className="flex h-full items-center justify-center p-6">
          <div className="w-full max-w-md border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-[3px] bg-muted text-muted-foreground">
              <Database className="h-4 w-4" />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground">Build your facility registry</h2>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
              Your registry is empty. Load a diverse mock dataset to explore, upload a CSV roster,
              or add facilities one at a time.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Btn variant="primary" onClick={loadSample}>
                <Database className="h-3 w-3" /> Add mock data
              </Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={() => setImportOpen(true)}>
                  <Upload className="h-3 w-3" /> Upload CSV
                </Btn>
                <Btn onClick={() => setEditorTarget({ mode: "add" })}>
                  <Plus className="h-3 w-3" /> Add manually
                </Btn>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex h-full flex-col">
        {/* Summary strip */}
        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-6">
          <Metric label="Facilities" value={int(summary.count)} />
          <Metric label="OK" value={int(summary.ok)} tone="ok" />
          <Metric
            label="At risk"
            value={int(summary.atRisk)}
            tone={summary.atRisk > 0 ? "warn" : "default"}
          />
          <Metric
            label="Overloaded"
            value={int(summary.overloaded)}
            tone={summary.overloaded > 0 ? "bad" : "default"}
          />
          <Metric label="Total physicians" value={int(summary.totalPhysicians)} />
          <Metric label="Median SVI" value={fixed(summary.medianSvi, 3)} />
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
          <TextInput
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter by facility or county…"
            className="w-full sm:w-64"
          />
          <div className="flex items-center gap-1 sm:ml-2">
            {STATUS_FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </Chip>
            ))}
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {int(table.getRowModel().rows.length)} shown
          </span>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto dense-scroll">
          <table className="w-full min-w-[760px] border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const meta = h.column.columnDef.meta as
                      | { right?: boolean; help?: string }
                      | undefined
                    const right = meta?.right
                    const help = meta?.help
                    const label = String(h.column.columnDef.header)
                    const sorted = h.column.getIsSorted()
                    return (
                      <th
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        className={`cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground ${
                          right ? "text-right" : "text-left"
                        }`}
                      >
                        <span
                          className={`flex items-center gap-1 whitespace-nowrap ${
                            right ? "justify-end" : ""
                          }`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {help ? <InfoTip label={label}>{help}</InfoTip> : null}
                          </span>
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3 shrink-0" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-30" />
                          )}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.original)}
                  className="cursor-pointer border-b border-border/60 odd:bg-card even:bg-background hover:bg-accent/40"
                >
                  {row.getVisibleCells().map((cell) => {
                    const right = (cell.column.columnDef.meta as { right?: boolean })?.right
                    return (
                      <td
                        key={cell.id}
                        className={`px-3 py-1.5 align-middle ${right ? "text-right" : "text-left"}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                    No facilities match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <FacilityEditor
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
        onSubmit={onEditorSubmit}
      />
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCommit={(facilities, mode) => {
          if (mode === "replace") replaceRoster(facilities)
          else mergeRoster(facilities)
          setImportOpen(false)
        }}
      />
      <FacilityDrawer facility={selected} onClose={() => setSelected(null)} />
    </ScreenContainer>
  )
}
