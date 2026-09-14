# ED Physician Allocation Console

A Next.js console that implements the model described in the [repository README](../README.md) as an interactive tool: load a hospital registry, back-calculate implied physician capacity from observed wait times, and run the equity-weighted greedy allocation of a physician budget across the network.

## Running it

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # vitest
pnpm build
```

## Screens

| Screen | What it does |
| --- | --- |
| Facility Registry | The hospital table — λ, SVI, baseline or implied capacity per facility, with CSV import. |
| Facility Management | Add, edit and remove facilities in the registry. |
| Allocation Console | Set the budget `B`, the equity dial `α`, `μ` and `C_w`, run the allocation, and read the before/after expected wait per hospital. |
| Allocation Trace | The step-by-step allocation log — which hospital received each physician, and the score that won it. |

## API

| Route | Purpose |
| --- | --- |
| `POST /api/capacity` | Back-calculate implied physician capacity from an observed wait time. |
| `POST /api/allocate` | Run the equity-weighted greedy allocation across a registry. A hospital may supply `baselineC`, `impliedCapacity`, or `observedWqHours` — the last chains through the capacity solver first. |
| `POST /api/allocate/sweep` | Sweep `α` and return the efficiency/equity trade-off curve. |

## Where the model lives

| Module | File |
| --- | --- |
| Erlang C and expected wait | `lib/server/queueing-engine.ts` |
| Capacity inversion | `lib/server/capacity-solver.ts` |
| Equity-weighted greedy allocation | `lib/server/allocation-engine.ts` |
| Input resolution and validation | `lib/server/resolve-hospitals.ts`, `lib/server/validation.ts` |

Each engine has a matching `*.test.ts` suite alongside it.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · Recharts · Vitest. Scaffolded with v0.
