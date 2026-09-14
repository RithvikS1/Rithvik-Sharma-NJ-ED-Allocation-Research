"use client"

import { useMemo, useState } from "react"
import { Plus, Download, Pencil, Archive, ArchiveRestore, Trash2, Building2 } from "lucide-react"
import { ScreenContainer } from "./screen-container"
import { FacilityEditor, type EditorTarget } from "./facility-editor"
import { CsvImportModal } from "./csv-import-modal"
import { Btn, Select, TextInput, StatusBadge, ConfirmDialog, ThInfo } from "@/components/dense"
import { useAppStore, useActiveNetwork } from "@/lib/store"
import { COLUMN_HELP } from "@/lib/glossary"
import { deriveAll } from "@/lib/derive"
import { facilitiesToCsv, downloadText } from "@/lib/csv"
import { fixed, int, pct } from "@/lib/format"
import type { Facility } from "@/lib/types"

export function ManagementScreen() {
  const networks = useAppStore((s) => s.networks)
  const activeNetworkId = useAppStore((s) => s.activeNetworkId)
  const setActiveNetwork = useAppStore((s) => s.setActiveNetwork)
  const addFacility = useAppStore((s) => s.addFacility)
  const updateFacility = useAppStore((s) => s.updateFacility)
  const deleteFacility = useAppStore((s) => s.deleteFacility)
  const deleteFacilities = useAppStore((s) => s.deleteFacilities)
  const toggleArchive = useAppStore((s) => s.toggleArchive)
  const mergeRoster = useAppStore((s) => s.mergeRoster)
  const replaceRoster = useAppStore((s) => s.replaceRoster)
  const mu = useAppStore((s) => s.draftParams.mu)
  const alpha = useAppStore((s) => s.draftParams.alpha)
  const net = useActiveNetwork()
  // Derive over the FULL roster (archived included) so management can show and
  // manage archived facilities; the registry/console use the archived-filtered hook.
  const derived = useMemo(
    () => deriveAll(net?.facilities ?? [], mu, alpha),
    [net?.facilities, mu, alpha],
  )

  const [query, setQuery] = useState("")
  const [showArchived, setShowArchived] = useState(true)
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onOk: () => void }>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return derived.filter((f) => {
      if (!showArchived && f.archived) return false
      if (!q) return true
      return f.name.toLowerCase().includes(q) || f.county.toLowerCase().includes(q)
    })
  }, [derived, query, showArchived])

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onExport() {
    if (!net) return
    downloadText(
      `${net.name.replace(/\s+/g, "-").toLowerCase()}-roster.csv`,
      facilitiesToCsv(net.facilities),
    )
  }

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

  function bulkDelete() {
    const ids = [...selected]
    setConfirm({
      title: `Delete ${ids.length} facilities?`,
      body: "This permanently removes the selected facilities from this network. This cannot be undone.",
      onOk: () => {
        deleteFacilities(ids)
        setSelected(new Set())
        setConfirm(null)
      },
    })
  }

  return (
    <ScreenContainer
      title="Facility Management"
      description="Add, edit, archive, and bulk-import facilities in the roster."
      actions={
        <div className="flex items-center gap-2">
          <Btn onClick={() => setImportOpen(true)}>Import CSV</Btn>
          <Btn onClick={onExport}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Btn>
          <Btn variant="primary" onClick={() => setEditorTarget({ mode: "add" })}>
            <Plus className="h-3.5 w-3.5" /> Add facility
          </Btn>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          Network
          <Select
            value={activeNetworkId}
            onChange={(e) => {
              setActiveNetwork(e.target.value)
              setSelected(new Set())
            }}
            className="w-56"
          >
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
        </label>

        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or county…"
          className="w-64"
        />

        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-3 w-3 accent-[var(--primary)]"
          />
          Show archived
        </label>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="num">{int(rows.length)}</span> shown
          {selected.size > 0 && (
            <Btn variant="danger" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}
            </Btn>
          )}
        </div>
      </div>

      {/* Roster table */}
      <div className="overflow-x-auto rounded-[3px] border border-border dense-scroll">
        <table className="w-full min-w-[820px] border-collapse text-[11px]">
          <thead className="bg-muted text-muted-foreground">
            <tr className="[&>th]:border-b [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3 w-3 accent-[var(--primary)]"
                />
              </th>
              <th>Facility</th>
              <ThInfo label="County" help={COLUMN_HELP.county}>County</ThInfo>
              <ThInfo right label="Beds" help={COLUMN_HELP.beds}>Beds</ThInfo>
              <ThInfo right label="λ (/h)" help={COLUMN_HELP.lambda}>λ (/h)</ThInfo>
              <ThInfo right label="Physicians" help={COLUMN_HELP.physicians}>Physicians</ThInfo>
              <ThInfo right label="ρ" help={COLUMN_HELP.rho}>ρ</ThInfo>
              <ThInfo right label="Modeled Wq" help={COLUMN_HELP.wq}>Modeled Wq</ThInfo>
              <ThInfo label="Status" help={COLUMN_HELP.status}>Status</ThInfo>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f.id}
                className={`border-b border-border last:border-0 transition-colors hover:bg-accent ${
                  f.archived ? "opacity-55" : ""
                }`}
              >
                <td className="px-2 py-1">
                  <input
                    type="checkbox"
                    aria-label={`Select ${f.name}`}
                    checked={selected.has(f.id)}
                    onChange={() => toggleOne(f.id)}
                    className="h-3 w-3 accent-[var(--primary)]"
                  />
                </td>
                <td className="px-2 py-1 font-medium text-foreground">{f.name}</td>
                <td className="px-2 py-1 text-muted-foreground">{f.county}</td>
                <td className="px-2 py-1 text-right num">{int(f.beds)}</td>
                <td className="px-2 py-1 text-right num">{fixed(f.lambda, 2)}</td>
                <td className="px-2 py-1 text-right num font-medium text-foreground">{int(f.physicians)}</td>
                <td
                  className="px-2 py-1 text-right num"
                  style={{ color: f.rho >= 1 ? "var(--bad)" : f.rho > 0.9 ? "var(--warn)" : undefined }}
                >
                  {pct(f.rho, 1)}
                </td>
                <td className="px-2 py-1 text-right num">
                  {f.modeledWqMin === null ? "—" : `${fixed(f.modeledWqMin, 1)}m`}
                </td>
                <td className="px-2 py-1">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn label="Edit" onClick={() => setEditorTarget({ mode: "edit", facility: f })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      label={f.archived ? "Restore" : "Archive"}
                      onClick={() => toggleArchive(f.id)}
                    >
                      {f.archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </IconBtn>
                    <IconBtn
                      label="Delete"
                      danger
                      onClick={() =>
                        setConfirm({
                          title: `Delete ${f.name}?`,
                          body: "This permanently removes the facility from this network.",
                          onOk: () => {
                            deleteFacility(f.id)
                            setConfirm(null)
                          },
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-8 text-center text-muted-foreground">
                  No facilities match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onOk()}
      />
    </ScreenContainer>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-card ${
        danger ? "hover:text-[var(--bad)]" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
