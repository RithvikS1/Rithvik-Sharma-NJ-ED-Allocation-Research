// Plain-English definitions for table column labels, surfaced via InfoTip "i"
// affordances in the headers. Intentionally prose, not formulas — these explain
// what a metric means operationally, not how it is derived.

export const COLUMN_HELP: Record<string, string> = {
  lambda:
    "Arrival rate — the average number of patients arriving at this facility per hour, measured from historical volume.",
  physicians:
    "Physician count (c) — the number of attending physicians currently staffed. This is a known input, not something the model solves for.",
  rho:
    "Utilization — the share of available physician capacity consumed by patient demand. At or above 100% demand outstrips capacity and the queue grows without bound.",
  wq:
    "Expected wait in queue — the average time a patient waits before seeing a physician, in minutes. Shows 'unstable' when the facility is overloaded and no steady-state wait exists.",
  prWait:
    "Probability of waiting — the chance that an arriving patient finds every physician busy and has to wait at all.",
  svi:
    "Social Vulnerability Index — a 0–1 measure of how vulnerable the surrounding community is (higher means more vulnerable). The parenthetical Q1–Q4 is the network quartile.",
  weight:
    "Equity weight — how strongly the optimizer prioritizes improving this facility. Facilities in more vulnerable communities carry a higher weight.",
  status:
    "Operating status — OK, At risk, or Overloaded, derived from utilization. Overloaded facilities are the primary targets for new physicians.",
  beds: "Licensed treatment beds at the facility.",
  county: "County the facility serves.",
  received:
    "Physicians received — the number of additional physicians this facility was assigned in the most recent allocation run.",
  cAfter:
    "Physician count after allocation — staffing once the newly allocated physicians are added.",
  wqBefore:
    "Expected wait before the allocation run, in minutes, at the facility's current staffing.",
  wqAfter:
    "Expected wait after the allocation run, in minutes, once received physicians are added.",
  minutesSaved:
    "Wait reduction — the drop in aggregate patient wait time per hour attributable to this facility's added physicians.",
  resultingC:
    "Resulting physician count — staffing at the chosen facility immediately after this step's physician is placed.",
  priorityDelta:
    "Priority score — the equity-weighted benefit of adding one more physician here. Each step the optimizer places a physician at the facility with the highest score.",
  budgetLeft:
    "Budget remaining — the number of physicians still available to place after this step.",
  savedStep:
    "Wait reduction from this single placement, in patient-minutes saved per hour.",
}
