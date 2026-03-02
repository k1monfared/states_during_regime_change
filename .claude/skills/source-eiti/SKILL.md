---
name: source-eiti
layer: 1-source
purpose: How to source EITI status data for extractive_transparency
indicators: [extractive_transparency]
used_by: [collect-data]
---

# Source: EITI — Extractive Industries Transparency Initiative

## What It Measures

EITI is an international standard for transparency in oil, gas, and mining revenues. Countries voluntarily join EITI and are assessed as Compliant, Candidate, or Suspended. The EITI status for each year maps to a score range for `extractive_transparency`.

## Access

- **Portal**: https://eiti.org/countries
- **Country status history**: https://eiti.org/countries/<country-name> (shows full status history with dates)
- **Annual reports**: Each EITI member publishes annual reconciliation reports on the country page
- **Coverage**: Only for EITI member/candidate countries; many 39-project countries are non-members

> **URL note**: The EITI website uses English display names, not project country_ids. Examples: `cote_divoire` → "/cote-divoire", `car` → "/central-african-republic", `east_timor` → "/timor-leste". Find the correct URL slug from the EITI countries listing.

## Status Categories and Score Mapping

| EITI Status | Description | Score Range |
|-------------|-------------|-------------|
| `Compliant` | Fully validated and compliant with the standard | 75–100 |
| `Candidate` | Joined but not yet validated; implementing the standard | 40–74 |
| `Suspended` | Membership suspended due to non-compliance | 10–39 |
| `Never joined` | Not an EITI member | 0–9 |
| `Exited` | Was a member; voluntarily withdrew or was delisted | 0–20 |

The `scoring_rubrics.yaml` contains the exact mappings. Do not convert to 0–100 yourself — enter the status string as a feature tag in the qualitative section.

## Feature Vocabulary for extractive_transparency

From `data/config/indicators.yaml` (verify current tags there):
```yaml
features:
  - eiti_compliant         # Compliant member
  - eiti_candidate         # Candidate status
  - eiti_suspended         # Suspended
  - no_eiti_membership     # Never joined or not relevant
  - extractive_sector_na   # Country has no significant extractive sector
```

## N/A Countries

Some project countries have no significant extractive sector — EITI is not applicable. These are listed in `data/config/aggregation.yaml` under `extractive_transparency.exclude` (or similar field). For these countries, set `data_status: not_applicable`.

To determine N/A status: if the country has no significant oil, gas, or mining sector AND is not listed on https://eiti.org/countries, set `data_status: not_applicable` with feature tag `extractive_sector_na`. Examples: Serbia (no major extractive sector → not_applicable); Ghana (oil and gold → EITI applies). When in doubt, check the EITI website — if the country has no page at all, that confirms non-membership.

## Status History Lookup

To find a country's EITI status in a specific year:
1. Go to https://eiti.org/countries/<country>
2. Look at the timeline of status changes
3. Identify which status was active in the year of interest

Example (Iraq): Became EITI Candidate in 2010, achieved Compliant status in 2012.

## Citation Format

```yaml
citation: "EITI Country Status, <country>, as of <year>"
url: "https://eiti.org/countries/<country>"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: high
```

## Reliability Notes

- EITI status: **high** reliability — externally validated by independent EITI Secretariat
- For years when status changed mid-year, use the status at year-end
- EITI reports may lag by 1–2 years (e.g., the 2022 EITI report may not be published until 2024)

## Project Country EITI Status Overview (as of 2026)

| Region | EITI Members |
|--------|-------------|
| MENA | Iraq (compliant), Yemen (candidate, suspended), Afghanistan (candidate) |
| Africa | DRC, Sierra Leone, Liberia, Cote d'Ivoire, Mali, Burkina Faso, Senegal, Nigeria |
| Non-members | Syria, Egypt, Libya, Algeria, most Eastern Europe countries |

Always verify current status on the EITI website — statuses change.

$ARGUMENTS
