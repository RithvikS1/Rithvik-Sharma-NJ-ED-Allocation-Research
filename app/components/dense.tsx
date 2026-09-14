"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* InfoTip — hover/focus definition popover with an "i" affordance    */
/* ------------------------------------------------------------------ */

export function InfoTip({
  label,
  children,
  className,
}: {
  /** Accessible name, e.g. the term being defined. */
  label: string
  /** Definition body shown in the popover. */
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{
    top: number
    left: number
    placement: "below" | "above"
  } | null>(null)
  const btnRef = React.useRef<HTMLButtonElement>(null)

  const WIDTH = 232 // px, matches w-58 below

  // Position in viewport coordinates (fixed) so the popover escapes any
  // ancestor overflow:auto/hidden (scrolling table header), and clamp it to
  // the viewport so long definitions never run off-screen or overlap the grid.
  const place = React.useCallback(() => {
    const el = btnRef.current
    if (typeof window === "undefined" || !el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const half = WIDTH / 2
    let left = r.left + r.width / 2
    left = Math.min(Math.max(left, margin + half), window.innerWidth - margin - half)
    // Flip above the trigger when there isn't room below.
    const placement = r.bottom + 140 > window.innerHeight ? "above" : "below"
    const top = placement === "below" ? r.bottom + 6 : r.top - 6
    setPos({ top, left, placement })
  }, [])

  const show = React.useCallback(() => {
    place()
    setOpen(true)
  }, [place])
  const hide = React.useCallback(() => setOpen(false), [])

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={`About ${label}`}
        onFocus={show}
        onBlur={hide}
        // Prevent an enclosing sortable header from toggling sort when the
        // affordance is activated; hover and keyboard focus drive visibility.
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        className="flex h-3 w-3 items-center justify-center rounded-full border border-current/40 text-[7px] font-semibold leading-none opacity-50 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        i
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{
                top: pos.top,
                left: pos.left,
                width: WIDTH,
                transform: `translateX(-50%) translateY(${
                  pos.placement === "above" ? "-100%" : "0"
                })`,
              }}
              className="pointer-events-none fixed z-[9999] rounded-md border border-border bg-popover px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl"
            >
              <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

/**
 * Table header cell with an optional InfoTip. `label` names the term for
 * screen readers / the popover heading; `help` is the definition body.
 */
export function ThInfo({
  children,
  label,
  help,
  right,
  className,
}: {
  children: React.ReactNode
  label: string
  help?: string
  right?: boolean
  className?: string
}) {
  return (
    <th className={cn("whitespace-nowrap", right && "!text-right", className)}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap align-middle">
        {children}
        {help ? <InfoTip label={label}>{help}</InfoTip> : null}
      </span>
    </th>
  )
}

/**
 * Inline label + InfoTip for use inside an existing header cell (keeps the
 * host `<th>`'s own padding/alignment classes intact). Right-aligned by
 * default so the "i" trails the label toward the column edge.
 */
export function HeaderLabel({
  children,
  label,
  help,
}: {
  children: React.ReactNode
  label: string
  help?: string
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap align-middle">
      {children}
      {help ? <InfoTip label={label}>{help}</InfoTip> : null}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

type BtnVariant = "default" | "primary" | "ghost" | "danger"

export function Btn({
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const variants: Record<BtnVariant, string> = {
    default:
      "bg-card text-foreground border-border hover:bg-accent disabled:opacity-40",
    primary:
      "bg-primary text-primary-foreground border-primary hover:brightness-110 disabled:opacity-40",
    ghost:
      "bg-transparent text-foreground border-transparent hover:bg-accent disabled:opacity-40",
    danger:
      "bg-card text-[var(--bad)] border-border hover:bg-[var(--bad)] hover:text-[var(--destructive-foreground)] disabled:opacity-40",
  }
  return (
    <button
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-[2px] border px-2 text-[11px] font-medium leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Fields                                                             */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="text-[10px] text-[var(--bad)]">{error}</span>
      ) : hint ? (
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

export const inputCls =
  "h-6 w-full rounded-[2px] border border-input bg-card px-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />
}

export function NumInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn(inputCls, "num text-right tabular-nums", className)}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(inputCls, "cursor-pointer appearance-none pr-6", className)}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[2px] border border-input bg-card px-1.5 py-1 text-[12px] leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-ring dense-scroll",
        className,
      )}
      {...props}
    />
  )
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-3.5 shrink-0 cursor-pointer appearance-none rounded-[1px] border border-input bg-card checked:border-primary checked:bg-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "checked:bg-[length:12px] bg-center bg-no-repeat",
        className,
      )}
      style={{
        backgroundImage: props.checked
          ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f4f7fa' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")"
          : undefined,
      }}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Slider (native range)                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  min,
  max,
  step,
  onValueChange,
  className,
}: {
  value: number
  min: number
  max: number
  step: number
  onValueChange: (v: number) => void
  className?: string
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        "h-1 w-full cursor-pointer appearance-none rounded-none bg-border accent-[var(--primary)]",
        className,
      )}
    />
  )
}

export function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-medium text-foreground">{label}</label>
        <span className="num text-[11px] tabular-nums text-foreground">{format(value)}</span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function NumberStepper({
  label,
  hint,
  value,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  onChange,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-foreground">{label}</label>
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-7 w-7 items-center justify-center border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-7 w-full border-y border-border bg-input px-2 text-center text-[12px] num text-foreground outline-none focus:border-ring"
        />
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-7 w-7 items-center justify-center border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          +
        </button>
      </div>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panels                                                             */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("flex min-h-0 flex-col border border-border bg-card", className)}>
      {title ? (
        <header className="flex h-7 shrink-0 items-center justify-between border-b border-border bg-muted px-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {right}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Status glyph                                                       */
/* ------------------------------------------------------------------ */

export type StatusKind = "OK" | "AT_RISK" | "OVERLOADED"

const STATUS_META: Record<StatusKind, { label: string; color: string; glyph: string }> = {
  OK: { label: "OK", color: "var(--ok)", glyph: "■" },
  AT_RISK: { label: "AT RISK", color: "var(--warn)", glyph: "◆" },
  OVERLOADED: { label: "OVERLOADED", color: "var(--bad)", glyph: "▲" },
}

const DOT_TONE: Record<string, string> = {
  ok: "#4ea36f",
  warn: "#d8a52a",
  crit: "#d15a4a",
  info: "#5a9bd1",
  teal: "#2fa39b",
  violet: "#8b7bd8",
  idle: "#8896a4",
}

export function StatusDot({
  tone = "idle",
  pulse = false,
}: {
  tone?: "ok" | "warn" | "crit" | "info" | "teal" | "violet" | "idle"
  pulse?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 rounded-full", pulse && "animate-pulse")}
      style={{ backgroundColor: DOT_TONE[tone] }}
    />
  )
}

export function StatusBadge({ status }: { status: StatusKind }) {
  const m = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px]">
      <span aria-hidden style={{ color: m.color }} className="text-[9px] leading-none">
        {m.glyph}
      </span>
      <span className="text-foreground">{m.label}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Provenance hover                                                   */
/* ------------------------------------------------------------------ */

export function Provenance({
  children,
  formula,
  inputs,
}: {
  children: React.ReactNode
  formula: string
  inputs: Array<{ k: string; v: string }>
}) {
  return (
    <span className="group/prov relative cursor-help border-b border-dotted border-muted-foreground/50">
      {children}
      <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-64 flex-col gap-1 border border-border bg-popover p-2 text-left shadow-none group-hover/prov:flex">
        <span className="num text-[11px] font-medium text-foreground">{formula}</span>
        <span className="flex flex-col gap-0.5">
          {inputs.map((i) => (
            <span key={i.k} className="flex justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">{i.k}</span>
              <span className="num text-foreground">{i.v}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-8"
      onMouseDown={onClose}
    >
      <div
        className={cn("mt-4 w-full border border-border bg-card sm:mt-8", width)}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex h-8 items-center justify-between border-b border-border bg-muted px-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <span className="text-[13px] leading-none">×</span>
          </button>
        </header>
        <div className="max-h-[75vh] overflow-auto p-3 dense-scroll">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      {body ? (
        <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Btn onClick={onCancel}>{cancelLabel}</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Right-side drawer                                                  */
/* ------------------------------------------------------------------ */

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  padded = true,
  width = "w-[420px]",
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  padded?: boolean
  width?: string
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full max-w-full flex-col border-l border-border bg-card max-sm:!w-full",
          width,
        )}
      >
        <header className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-muted px-3">
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close (Esc)"
          >
            <span className="text-[13px] leading-none">×</span>
          </button>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-auto dense-scroll", padded && "p-3")}>
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-border bg-muted px-3 py-2">{footer}</footer>
        ) : null}
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Metric strip                                                       */
/* ------------------------------------------------------------------ */

export function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: "ok" | "bad" | "warn" | "default"
}) {
  const toneColor =
    tone === "ok"
      ? "var(--ok)"
      : tone === "bad"
        ? "var(--bad)"
        : tone === "warn"
          ? "var(--warn)"
          : undefined
  return (
    <div className="flex min-w-0 flex-col justify-center border-r border-border px-3 py-1 last:border-r-0">
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="num text-[13px] font-medium leading-tight" style={{ color: toneColor }}>
        {value}
      </span>
      {sub ? <span className="text-[9px] text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-5 rounded-[2px] border px-1.5 text-[10px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}

const CALLOUT_TONE: Record<string, { border: string; bar: string }> = {
  info: { border: "border-[color-mix(in_srgb,var(--info)_40%,var(--border))]", bar: "var(--info)" },
  ok: { border: "border-[color-mix(in_srgb,var(--ok)_40%,var(--border))]", bar: "var(--ok)" },
  warn: { border: "border-[color-mix(in_srgb,var(--warn)_45%,var(--border))]", bar: "var(--warn)" },
  bad: { border: "border-[color-mix(in_srgb,var(--bad)_45%,var(--border))]", bar: "var(--bad)" },
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "ok" | "warn" | "bad"
  title?: React.ReactNode
  children: React.ReactNode
}) {
  const t = CALLOUT_TONE[tone]
  return (
    <div
      className={cn("rounded-[2px] border bg-muted/40 px-2.5 py-2", t.border)}
      style={{ borderLeft: `2px solid ${t.bar}` }}
    >
      {title ? (
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          {title}
        </div>
      ) : null}
      <div className="text-[11px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}
