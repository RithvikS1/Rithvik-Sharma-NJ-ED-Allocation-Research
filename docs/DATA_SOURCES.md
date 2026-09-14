# Data sources

Every dataset in `data/raw/` is a public release. Nothing in this repository contains patient-level data.

| File | Source | Used for |
| --- | --- | --- |
| `Timely_and_Effective_Care-Hospital_NJ.csv` | CMS Hospital Compare — *Timely and Effective Care - Hospital* | Observed median ED wait times, measure `OP_18b`, filtered to `State == 'NJ'`. |
| `njshad_county_ed_visits.xlsx` | New Jersey State Health Assessment Data (NJSHAD) | County-level ED visit counts by year; 2024 is the year used. |
| `Hospital_Provider_Cost_Report_2023.csv` | HCRIS — Hospital Provider Cost Report, 2023 | Per-facility bed counts, which form the bed-share key that disaggregates county visit volume to individual hospitals. |
| `NEWJERSEY_COUNTY.csv` | CDC/ATSDR Social Vulnerability Index, New Jersey county file | `RPL_THEMES`, the overall SVI percentile used as the equity weight input. |

## One note on the CMS file

The CMS *Timely and Effective Care - Hospital* export is a national file of roughly 138,000 rows. The copy committed here, `Timely_and_Effective_Care-Hospital_NJ.csv`, is that export filtered to `State == 'NJ'` — 1,876 rows — so the repository stays a reasonable size to clone.

This does not change any result. The first step of `notebooks/01_implied_capacity.ipynb` filters the raw export to NJ anyway:

```python
wq_data = raw_df[(raw_df['State'] == 'NJ') & (raw_df['Measure ID'] == 'OP_18b')].copy()
```

To run against the full national export instead, download it from CMS, place it in `data/raw/`, and point the first cell of notebook 01 at that filename.

## Derived files

| File | Written by | Read by |
| --- | --- | --- |
| `data/processed/nj_hospital_implied_capacity_results.csv` | `notebooks/01_implied_capacity.ipynb` | `notebooks/02_equity_weighted_allocation.ipynb` |
| `data/processed/nj_ed_final_allocation.csv` | `notebooks/02_equity_weighted_allocation.ipynb` | — |
| `data/processed/nj_ed_allocation_log.csv` | `notebooks/02_equity_weighted_allocation.ipynb` | — |

The implied-capacity table is committed so notebook 02 runs without notebook 01 having to be re-executed first.
