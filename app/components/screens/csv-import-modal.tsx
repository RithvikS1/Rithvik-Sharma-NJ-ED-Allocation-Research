"use client"

import { useRef, useState } from "react"
import { Modal, Btn, Callout, Chip } from "@/components/dense"
import { parseFacilityCsv, type CsvParseResult } from "@/lib/csv"
import type { Facility } from "@/lib/types"
import { fixed, int } from "@/lib/format"

type Mode = "replace" | "merge"

export function CsvImportModal({
  open,
  onClose,
  onCommit,
}: {
  open: boolean
  onClose: () => void
  onCommit: (facilities: Facility[], mode: Mode) => void
}) {
  const [result, setResult] = useState<CsvParseResult | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [mode, setMode] = useState<Mode>("merge")
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setResult(null)
    setFileName("")
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    setResult(parseFacilityCsv(text))
  }

  function commit() {
    if (!result || result.facilities.length === 0) return
    // Attach ids so the imported rows become full Facility records.
    const facilities: Facility[] = result.facilities.map((f, i) => ({
      ...f,
      id: `imp-${Date.now().toString(36)}-${i}`,
    }))
    onCommit(facilities, mode)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Import facilities from CSV"
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-3">
        <Callout tone="info" title="Expected columns">
          <span className="num">name, county, beds, lambda, physicians, archived</span>. A header
          row is auto-detected and columns may appear in any order. County SVI is derived
          automatically; unknown counties fall back to the network median. Two optional columns,{" "}
          <span className="num">wq_hours</span> and <span className="num">implied_capacity</span>,
          are recognized when a header row is present — supply one to let the backend derive
          implied physician capacity for facilities without a known headcount.
        </Callout>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
            className="hidden"
            id="csv-file-input"
          />
          <Btn variant="default" onClick={() => inputRef.current?.click()}>
            Choose CSV file…
          </Btn>
          {fileName ? (
            <span className="font-mono text-[11px] text-muted-foreground">{fileName}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No file selected</span>
          )}
        </div>

        {result ? (
          <>
            <div className="flex items-center gap-4 border-y border-border py-2 text-[11px]">
              <span>
                <span className="num text-foreground">{int(result.facilities.length)}</span>{" "}
                <span className="text-muted-foreground">valid rows</span>
              </span>
              <span>
                <span
                  className={
                    result.errors.length ? "num text-[var(--bad)]" : "num text-muted-foreground"
                  }
                >
                  {int(result.errors.length)}
                </span>{" "}
                <span className="text-muted-foreground">rows skipped</span>
              </span>
              <span className="ml-auto flex items-center gap-1">
                <span className="text-muted-foreground">Import mode:</span>
                <Chip active={mode === "merge"} onClick={() => setMode("merge")}>
                  Merge by name
                </Chip>
                <Chip active={mode === "replace"} onClick={() => setMode("replace")}>
                  Replace roster
                </Chip>
              </span>
            </div>

            {result.errors.length > 0 ? (
              <Callout tone="warn" title={`${result.errors.length} row(s) skipped`}>
                <ul className="max-h-28 list-inside list-disc overflow-auto">
                  {result.errors.slice(0, 30).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            {result.facilities.length > 0 ? (
              <div className="max-h-64 overflow-auto border border-border dense-scroll">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1 font-medium">Name</th>
                      <th className="px-2 py-1 font-medium">County</th>
                      <th className="px-2 py-1 text-right font-medium">Beds</th>
                      <th className="px-2 py-1 text-right font-medium">λ</th>
                      <th className="px-2 py-1 text-right font-medium">Phys</th>
                      <th className="px-2 py-1 text-right font-medium">SVI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.facilities.slice(0, 100).map((f, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="px-2 py-1 text-foreground">{f.name}</td>
                        <td className="px-2 py-1 text-muted-foreground">{f.county}</td>
                        <td className="px-2 py-1 text-right num">{int(f.beds)}</td>
                        <td className="px-2 py-1 text-right num">{fixed(f.lambda, 2)}</td>
                        <td className="px-2 py-1 text-right num">{int(f.physicians)}</td>
                        <td className="px-2 py-1 text-right num">{fixed(f.svi, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
          <Btn
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={commit}
            disabled={!result || result.facilities.length === 0}
          >
            {mode === "replace" ? "Replace roster" : "Merge"} ({int(result?.facilities.length ?? 0)})
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
