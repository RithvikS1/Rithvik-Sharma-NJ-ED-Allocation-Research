# Method

A walkthrough of the pipeline, stage by stage, with the file each stage lives in.

---

## Stage 1 — Observed wait times

`notebooks/01_implied_capacity.ipynb`, cell 1.

CMS publishes measure `OP_18b`, the median time patients spend in the emergency department before being sent home. New Jersey rows are filtered out of the national export, `Score` is coerced to numeric, unavailable values are dropped, and minutes are converted to hours as `Wq_hours` so the units match the arrival and service rates used everywhere downstream.

## Stage 2 — Arrival rates

`notebooks/01_implied_capacity.ipynb`, cells 2–3.

Individual-hospital ED volume is not published, so the model disaggregates county-level volume down to facilities. NJSHAD gives 2024 ED visit counts per county of patient residence. HCRIS gives bed counts per facility. Each hospital receives a share of its county's visits proportional to its share of the county's beds:

```
Bed_share_i        = beds_i / Σ beds in county
Estimated_visits_i = county_ED_visits × Bed_share_i
λ_i                = Estimated_visits_i / 8760
```

This is the modeling assumption stated in the notebook itself.

## Stage 3 — Unified dataset

`notebooks/01_implied_capacity.ipynb`, cell 4.

CMS facility names and HCRIS hospital names do not match literally, so both sides are normalized — uppercased, punctuation stripped, `MEDICAL CENTER` → `MC`, `HOSPITAL` → `HOSP` — before an inner join on the cleaned name. Rows missing either λ or `Wq` are dropped, since neither the solver nor the allocator can act on them.

## Stage 4 — Inverting M/M/c for implied capacity

`notebooks/01_implied_capacity.ipynb`, cells 5–7.

Each ED is modeled as an M/M/c queue with service rate μ = 2.55 patients per hour per physician, the EDBA benchmark. The forward direction gives expected queue wait from capacity:

```
E[Wq](c) = P_wait(c) / (cμ − λ)
```

where `P_wait` is the Erlang C probability that an arriving patient has to wait. The model runs this backwards. Capacity `c` is unobserved, so it is recovered as the root of

```
E[Wq](c) − Wq_observed = 0
```

solved with `scipy.optimize.brentq` over `(λ/μ, c_max)`. `E[Wq]` is monotone decreasing in `c`, which is what makes a bracketed root-finder the right tool.

The naive Erlang C expression overflows for realistic λ, so the notebook uses a log-stable form: the Erlang term is evaluated as `exp(c·log(λ/μ) − lgamma(c+1) − log(1−ρ))`, and the partial sum is evaluated through the Poisson CDF identity, `exp(λ/μ) · pdtr(⌊c⌋−1, λ/μ)`. That identity is also what lets `c` stay continuous rather than integer.

Hospitals that fail to converge are diagnosed explicitly in cell 9 by computing the model's wait-time floor at very high capacity: an observed wait shorter than the model's floor points to an underestimated λ rather than a solver failure.

Output: `data/processed/nj_hospital_implied_capacity_results.csv`.

## Stage 5 — Equity weights

`notebooks/02_equity_weighted_allocation.ipynb`, cell 2.

The CDC/ATSDR Social Vulnerability Index file for New Jersey supplies `RPL_THEMES`, the overall vulnerability percentile in [0, 1], joined to hospitals on normalized county name. The join is asserted, not assumed — the notebook fails loudly on unmatched counties and on SVI values outside [0, 1], which is how the CDC's `-999` missing code is caught.

The equity weight is

```
w_i = 1 + α · SVI_i
```

with α = 2.0 as the dial. α = 0 recovers the pure efficiency baseline, `w = 1` for every hospital.

The baseline capacity `c_start` is kept continuous, exactly as the inversion returned it. Rounding it would move the system off the fitted point, and `implied_c` sits near the steep part of the Erlang C curve where that error is large.

## Stage 6 — Equity-weighted greedy allocation

`notebooks/02_equity_weighted_allocation.ipynb`, cells 5–6.

The marginal value of the next physician at a hospital is the dollar value of the wait it removes across that hospital's arrival stream:

```
MS_i(c) = C_w · λ_i · ( E[Wq](c) − E[Wq](c+1) )
```

with `C_w` = $120 per patient-hour of waiting. The allocator maintains a max-heap over hospitals keyed on

```
score_i = w_i · MS_i(c_i)
```

pops the highest-scoring hospital, gives it one physician, and repeats until the budget is spent. Doctors are added as integer increments on top of the fractional baseline. Because `E[Wq]` is decreasing and convex in `c`, the objective is submodular, which is what puts the greedy solution within (1 − 1/e) of optimal.

## Stage 7 — Validation and sweeps

`notebooks/02_equity_weighted_allocation.ipynb`, cells 4, 9–18.

- **Round-trip check.** Re-running the forward model at `c_start` must reproduce the observed CMS wait. The notebook asserts the ratio is 1.0 to within 1e-3 for every hospital.
- **α sweep.** Allocation is re-run across a range of α values, tracking mean minutes saved against the share of the budget directed to above-median-SVI hospitals. This is the efficiency/equity trade-off curve.
- **Budget sweep.** Budgets from 1 to 40 additional physicians are run at α = 0 and α = 2, reported alongside each budget's size as a percentage of total baseline capacity.
- **Annual impact.** Per-hospital minutes saved are scaled by λ and 8,760 hours to give patient-hours of waiting removed per year, split by SVI median.

Outputs: `data/processed/nj_ed_final_allocation.csv` and `data/processed/nj_ed_allocation_log.csv`.

---

## The same model in the console

`app/` implements these two stages as server modules with their own test suites:

| Module | File | Test |
| --- | --- | --- |
| Erlang C / expected wait | `app/lib/server/queueing-engine.ts` | `queueing-engine.test.ts` |
| Capacity inversion | `app/lib/server/capacity-solver.ts` | `capacity-solver.test.ts` |
| Equity-weighted greedy allocation | `app/lib/server/allocation-engine.ts` | `allocation-engine.test.ts` |

A hospital record may supply its baseline capacity directly, an already-known implied capacity, or an observed wait time — in the last case the allocation route chains through the capacity solver first (`app/lib/server/resolve-hospitals.ts`).
