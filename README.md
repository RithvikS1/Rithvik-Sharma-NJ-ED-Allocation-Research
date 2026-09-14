# Equity-Weighted Physician Allocation Across New Jersey Emergency Departments

**Rithvik Sharma**
ASPIRE Mathematical Research and Innovations Program · Research internship through JustCQ · Research under Prof. Padhu Seshaiyer, George Mason University

An M/M/c queueing model of New Jersey emergency departments, an inverse solver that recovers each hospital's implied physician capacity from observed CMS wait times, and an equity-weighted greedy allocation algorithm that distributes additional physician capacity across the network while accounting for county-level social vulnerability.

This repository contains the full body of work: the two analysis notebooks, the source data, the conference poster and presentation, and a web application that implements the model as an interactive console.

---

## Abstract

> New Jersey emergency departments face persistent problems with patient wait times, jeopardizing both patient health and the operational efficiency of medical centers. Many existing allocation models aim to solve this problem by reducing wait times; however, most assume that all hospitals are equally deserving, failing to account for the fact that understaffing burdens vulnerable populations disproportionately. This leads to algorithms allocating more physicians to medical centers with greater resources, since those resources yield higher returns on allocation when compared to their understaffed counterparts, while hospitals with fewer resources receive less physician allocation and face increased understaffing and overcrowding. We model each ED as an M/M/c queue and use root-finding (brentq) to back-calculate each hospital's implied physician capacity from observed CMS wait times. Arrival rates are estimated via a bed-share allocation of county-level ED visit volumes (NJSHAD) to individual facilities (HCRIS). We then formulate an equity weighted greedy allocation algorithm, provably within (1-1/e) of optimal by submodularity, that distributes additional physician capacity across hospitals in a network, critically accounting for counties with higher CDC Social Vulnerability Index scores within our distribution algorithm. Applying this methodology, we achieved an average wait time reduction of 41.30 minutes across 22 NJ hospitals in our study upon distributing 40 doctors across the network, while only sacrificing 0.1 minutes of mean wait time reduction for 5 points of redirected allocation towards more vulnerable counties. This approach enables a more equitable and effective distribution of physicians across NJ emergency departments, leading to improved wait times and better patient care.

---

## Repository layout

```
.
├── notebooks/       Analysis pipeline (run in order)
├── data/            Source datasets and model outputs
├── presentation/    Conference poster and presentation
├── app/             ED Physician Allocation Console (Next.js)
└── docs/            Method notes and data provenance
```

| Path | Contents |
| --- | --- |
| `notebooks/01_implied_capacity.ipynb` | Builds the unified NJ hospital dataset and inverts the M/M/c wait-time formula with `scipy.optimize.brentq` to back-calculate each hospital's implied physician capacity. |
| `notebooks/02_equity_weighted_allocation.ipynb` | Joins CDC SVI scores, runs the equity-weighted greedy allocation, and produces the before/after wait-time, α-sweep, and budget-sweep figures. |
| `data/raw/` | Source datasets: CMS Timely and Effective Care (NJ), NJSHAD county ED visit counts, HCRIS provider cost report, CDC SVI for New Jersey. |
| `data/processed/` | Model outputs, including the implied-capacity table that carries results from notebook 01 into notebook 02. |
| `presentation/` | The research poster and the presentation deck. |
| `app/` | A Next.js console that implements the same two modules — the capacity solver and the allocation engine — behind an interactive UI and a JSON API. |
| `docs/METHOD.md` | Pipeline walkthrough: what each stage computes and which files it reads and writes. |
| `docs/DATA_SOURCES.md` | Provenance for every dataset, and the one file that is shipped as a New Jersey subset. |

---

## Pipeline

```
CMS OP_18b wait times ─┐
                       ├─► unified NJ hospital dataset ─► brentq inversion ─► implied capacity c*
NJSHAD county volumes ─┤                                                            │
HCRIS bed counts ──────┘                                                            ▼
                                                            CDC SVI ─► equity weight w = 1 + α·SVI
                                                                                    │
                                                                                    ▼
                                                    equity-weighted greedy allocation of budget B
                                                                                    │
                                                                                    ▼
                                                        per-hospital before/after expected wait
```

---

## Running the notebooks

```bash
pip install pandas numpy scipy matplotlib seaborn openpyxl
jupyter lab notebooks/
```

Run `01_implied_capacity.ipynb` first. It writes `data/processed/nj_hospital_implied_capacity_results.csv`, which `02_equity_weighted_allocation.ipynb` reads as its input. That file is committed, so notebook 02 can also be run on its own.

Notebook paths are relative to the `notebooks/` directory.

## Running the console

```bash
cd app
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest suite for the queueing, capacity-solver and allocation engines
```

The app exposes the model over three routes:

| Route | Purpose |
| --- | --- |
| `POST /api/capacity` | Back-calculate implied physician capacity from an observed wait time. |
| `POST /api/allocate` | Run the equity-weighted greedy allocation of a physician budget across a registry. |
| `POST /api/allocate/sweep` | Sweep the equity dial α and return the efficiency/equity trade-off curve. |

---

## Model parameters

| Symbol | Meaning | Value used |
| --- | --- | --- |
| `μ` | Service rate per physician, patients/hour (EDBA benchmark) | 2.55 |
| `λ` | Per-hospital hourly arrival rate | Bed-share disaggregation of county ED visits |
| `c` | Physician capacity, treated as continuous by the solver | Recovered per hospital by inversion |
| `α` | Equity weighting dial, `w = 1 + α · SVI` | 2.0 |
| `C_w` | Penalty per patient-hour of waiting | $120 |
| `B` | Additional physicians to distribute | Swept; headline result at B = 40 |

---

## License

Code in this repository is released under the MIT License — see [LICENSE](LICENSE).

The poster and presentation in `presentation/` are the author's own work. Source datasets in `data/` are published by CMS, the New Jersey State Health Assessment Data system, and the CDC/ATSDR; see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
