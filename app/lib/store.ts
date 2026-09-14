"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  AllocationParamsState,
  Facility,
  Network,
  ScenarioSnapshot,
} from "./types"
import { DEFAULT_PARAMS } from "./types"
import { buildSeedNetwork, buildBlankNetwork } from "./seed"
import { allocate, type AllocationResult } from "./queueing"
import { sviForCounty } from "./svi"

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export type ScreenId =
  | "registry"
  | "management"
  | "console"
  | "trace"

export const SCREENS: Record<ScreenId, { label: string; hotkey: string }> = {
  registry: { label: "Facility Registry", hotkey: "g r" },
  management: { label: "Facility Management", hotkey: "g m" },
  console: { label: "Allocation Console", hotkey: "g c" },
  trace: { label: "Allocation Trace", hotkey: "g t" },
}

interface StoreState {
  screen: ScreenId
  setScreen: (s: ScreenId) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  networks: Network[]
  activeNetworkId: string
  params: AllocationParamsState
  /** Draft params being edited in the console (may differ from committed run). */
  draftParams: AllocationParamsState
  results: AllocationResult | null
  /** true when draftParams differ from the params used for the last run. */
  stale: boolean
  lastComputedAt: number | null
  scenarios: ScenarioSnapshot[]
  selectedIds: string[]

  // network ops
  setActiveNetwork: (id: string) => void
  createNetwork: (name: string) => void
  renameNetwork: (id: string, name: string) => void
  duplicateNetwork: (id: string) => void
  deleteNetwork: (id: string) => void

  // facility ops
  addFacility: (f: Omit<Facility, "id" | "svi" | "archived">) => void
  updateFacility: (id: string, patch: Partial<Facility>) => void
  deleteFacility: (id: string) => void
  deleteFacilities: (ids: string[]) => void
  toggleArchive: (id: string) => void
  replaceRoster: (facilities: Facility[]) => void
  mergeRoster: (facilities: Facility[]) => void
  /** Replace the active network's roster with the built-in sample dataset. */
  loadSample: () => void

  // selection
  setSelected: (ids: string[]) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void

  // params + run
  setDraftParams: (patch: Partial<AllocationParamsState>) => void
  resetDraftParams: () => void
  runAllocation: () => void

  // scenarios
  saveScenario: (name: string) => void
  loadScenario: (id: string) => void
  duplicateScenario: (id: string) => void
  deleteScenario: (id: string) => void
}

function makeFacility(input: Omit<Facility, "id" | "svi" | "archived">): Facility {
  return {
    ...input,
    id: uid("njf"),
    svi: sviForCounty(input.county),
    archived: false,
  }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      screen: "registry",
      setScreen: (screen) => set({ screen }),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      networks: [buildBlankNetwork()],
      activeNetworkId: "net-nj-primary",
      params: { ...DEFAULT_PARAMS },
      draftParams: { ...DEFAULT_PARAMS },
      results: null,
      stale: true,
      lastComputedAt: null,
      scenarios: [],
      selectedIds: [],

      setActiveNetwork: (id) => set({ activeNetworkId: id, results: null, stale: true, selectedIds: [] }),

      createNetwork: (name) => {
        const net: Network = { id: uid("net"), name, facilities: [] }
        set((s) => ({ networks: [...s.networks, net], activeNetworkId: net.id }))
      },

      renameNetwork: (id, name) =>
        set((s) => ({ networks: s.networks.map((n) => (n.id === id ? { ...n, name } : n)) })),

      duplicateNetwork: (id) => {
        const src = get().networks.find((n) => n.id === id)
        if (!src) return
        const copy: Network = {
          id: uid("net"),
          name: `${src.name} (copy)`,
          facilities: src.facilities.map((f) => ({ ...f, id: uid("njf") })),
        }
        set((s) => ({ networks: [...s.networks, copy], activeNetworkId: copy.id }))
      },

      deleteNetwork: (id) =>
        set((s) => {
          if (s.networks.length <= 1) return s
          const remaining = s.networks.filter((n) => n.id !== id)
          const active = s.activeNetworkId === id ? remaining[0].id : s.activeNetworkId
          return { networks: remaining, activeNetworkId: active, results: null, stale: true }
        }),

      addFacility: (f) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? { ...n, facilities: [...n.facilities, makeFacility(f)] }
              : n,
          ),
          stale: true,
        })),

      updateFacility: (id, patch) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? {
                  ...n,
                  facilities: n.facilities.map((f) =>
                    f.id === id
                      ? {
                          ...f,
                          ...patch,
                          svi: patch.county ? sviForCounty(patch.county) : f.svi,
                        }
                      : f,
                  ),
                }
              : n,
          ),
          stale: true,
        })),

      deleteFacility: (id) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? { ...n, facilities: n.facilities.filter((f) => f.id !== id) }
              : n,
          ),
          selectedIds: s.selectedIds.filter((x) => x !== id),
          stale: true,
        })),

      deleteFacilities: (ids) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? { ...n, facilities: n.facilities.filter((f) => !ids.includes(f.id)) }
              : n,
          ),
          selectedIds: [],
          stale: true,
        })),

      toggleArchive: (id) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? {
                  ...n,
                  facilities: n.facilities.map((f) =>
                    f.id === id ? { ...f, archived: !f.archived } : f,
                  ),
                }
              : n,
          ),
          stale: true,
        })),

      replaceRoster: (facilities) =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId ? { ...n, facilities } : n,
          ),
          stale: true,
          selectedIds: [],
        })),

      loadSample: () =>
        set((s) => ({
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? { ...n, facilities: buildSeedNetwork().facilities }
              : n,
          ),
          stale: true,
          selectedIds: [],
          results: null,
        })),

      mergeRoster: (facilities) =>
        set((s) => ({
          networks: s.networks.map((n) => {
            if (n.id !== s.activeNetworkId) return n
            const byName = new Map(n.facilities.map((f) => [f.name.toLowerCase(), f]))
            for (const nf of facilities) {
              byName.set(nf.name.toLowerCase(), { ...byName.get(nf.name.toLowerCase()), ...nf })
            }
            return { ...n, facilities: Array.from(byName.values()) }
          }),
          stale: true,
        })),

      setSelected: (ids) => set({ selectedIds: ids }),
      toggleSelected: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        })),
      clearSelected: () => set({ selectedIds: [] }),

      setDraftParams: (patch) =>
        set((s) => ({ draftParams: { ...s.draftParams, ...patch }, stale: true })),

      resetDraftParams: () => set({ draftParams: { ...DEFAULT_PARAMS }, stale: true }),

      runAllocation: () => {
        const s = get()
        const net = s.networks.find((n) => n.id === s.activeNetworkId)
        if (!net) return
        const active = net.facilities.filter((f) => !f.archived)
        // Physician staffing is a KNOWN input — feed it straight into the
        // allocator as each facility's baseline server count.
        const inputs = active.map((f) => ({
          id: f.id,
          name: f.name,
          lambda: f.lambda,
          svi: f.svi,
          baselineC: f.physicians,
        }))
        const results = allocate(inputs, s.draftParams)
        set({
          results,
          params: { ...s.draftParams },
          stale: false,
          lastComputedAt: Date.now(),
        })
      },

      saveScenario: (name) => {
        const s = get()
        const net = s.networks.find((n) => n.id === s.activeNetworkId)
        if (!net) return
        const roster = net.facilities.filter((f) => !f.archived)
        const snap: ScenarioSnapshot = {
          id: uid("scn"),
          name,
          createdAt: Date.now(),
          networkName: net.name,
          facilityCount: roster.length,
          params: { ...s.draftParams },
          roster: roster.map((f) => ({ ...f })),
        }
        set((st) => ({ scenarios: [...st.scenarios, snap] }))
      },

      loadScenario: (id) => {
        const snap = get().scenarios.find((sc) => sc.id === id)
        if (!snap) return
        set((s) => ({
          draftParams: { ...snap.params },
          networks: s.networks.map((n) =>
            n.id === s.activeNetworkId
              ? { ...n, facilities: snap.roster.map((f) => ({ ...f })) }
              : n,
          ),
          stale: true,
          results: null,
        }))
      },

      duplicateScenario: (id) => {
        const snap = get().scenarios.find((sc) => sc.id === id)
        if (!snap) return
        const copy: ScenarioSnapshot = {
          ...snap,
          id: uid("scn"),
          name: `${snap.name} (copy)`,
          createdAt: Date.now(),
        }
        set((s) => ({ scenarios: [...s.scenarios, copy] }))
      },

      deleteScenario: (id) =>
        set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== id) })),
    }),
    {
      name: "ed-allocation-console",
      // v2: registry now starts blank instead of pre-seeded. Bumping the
      // version discards any previously persisted seed roster so returning
      // users also start from an empty registry.
      version: 2,
      partialize: (s) => ({
        networks: s.networks,
        activeNetworkId: s.activeNetworkId,
        params: s.params,
        draftParams: s.draftParams,
        scenarios: s.scenarios,
      }),
    },
  ),
)

// Alias used across the UI layer.
export const useAppStore = useStore

// Convenience selectors
export function useActiveNetwork(): Network | undefined {
  return useStore((s) => s.networks.find((n) => n.id === s.activeNetworkId))
}
