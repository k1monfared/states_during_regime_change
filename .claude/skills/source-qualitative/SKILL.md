---
name: source-qualitative
layer: 1-source
purpose: Process for indicators where quantitative data is unavailable; covers territorial_control, elite_cohesion, diplomatic_integration, foreign_military, sanctions
indicators: [territorial_control, elite_cohesion, diplomatic_integration, foreign_military, sanctions]
used_by: [collect-data]
---

# Source: Qualitative Assessment Process

## When to Use This Skill

Use qualitative-only sourcing when:
1. No quantitative dataset covers the indicator (e.g., `territorial_control`, `foreign_military`, `sanctions`)
2. The country-year has no quantitative coverage (conflict states, missing years)
3. Quantitative data exists but the qualitative context is needed to determine the correct feature tags

This is the **primary method** for: `territorial_control`, `elite_cohesion`, `diplomatic_integration`, `foreign_military`, `sanctions`

## Recommended Sources by Quality Tier

### Tier 1 — High Reliability
| Source | URL | Covers |
|--------|-----|--------|
| International Crisis Group (ICG) | https://crisisgroup.org | Conflict, governance, transitions |
| Chatham House | https://chathamhouse.org | Regional politics, economics |
| Carnegie Endowment | https://carnegieendowment.org | Democracy, security |
| Brookings Institution | https://brookings.edu | Wide policy coverage |
| SIPRI (Stockholm Int'l Peace Research) | https://sipri.org | Arms, military, peacekeeping |
| UN Security Council Reports | https://securitycouncilreport.org | Sanctions, peacekeeping, crises |

### Tier 2 — Medium Reliability
| Source | URL | Covers |
|--------|-----|--------|
| Reuters | https://reuters.com | News wire; factual events |
| BBC News | https://bbc.com/news | Wide coverage |
| Human Rights Watch | https://hrw.org | Rights violations, conflict |
| Amnesty International | https://amnesty.org | Human rights |
| ACLED analysis | https://acleddata.com/analysis | Conflict summaries |
| Al-Monitor (MENA), Africa Confidential (Africa), regional think tanks | More reliable for local context than national outlets |

### Tier 3 — Low Reliability (use only when nothing else available)
| Source | Notes |
|--------|-------|
| Local news outlets | May have access but also bias |
| Wikipedia | Useful for event dates/structure; never sole source |
| UN press releases | Good for specific mandates but official framing |

## Process: Qualitative Assessment Workflow

1. **Identify the indicator and year** — be precise about what you're assessing
2. **Search for relevant reports**:
   - ICG report for that country-year: `site:crisisgroup.org <country> <year>`
   - Carnegie/Chatham/Brookings for policy assessments
   - Reuters archive for factual events
3. **Extract the relevant assessment** — 2–4 sentences describing the actual situation
4. **Map to feature vocabulary** — check `data/config/indicators.yaml` for `valid_features` for this indicator
5. **Cite the source** — include full citation, URL, source type, reliability

## Indicator-Specific Guidance

### territorial_control
- Look for: ICG reports on armed groups, military situation reports, ACLED geographic analysis
- Key questions: Who controls the capital? Are major cities contested? Foreign forces present?
- Features: `full_government_control`, `large_portions_contested_30_50pct`, `foreign_occupation`, `ungoverned_spaces`

### elite_cohesion
- Look for: Political party splits, coup attempts, legislative boycotts, leadership purges
- Key questions: Are ruling elites united? Are there visible factional splits? Defections to opposition?
- Features: Check indicators.yaml for valid tags; typically: `elite_unity`, `factional_competition`, `elite_fragmentation`, `coup_attempt`
- Supplement with V-Dem variables (see `source-vdem`)

**Transition year default**: In the year immediately after a regime change, elite cohesion is almost always in flux. Default to `confidence: medium` for that year even with strong sources.

### sanctions
- Look for: UN Security Council resolutions, US OFAC designations, EU sanctions pages
- UN sanctions: https://www.un.org/securitycouncil/sanctions/information
- US OFAC: https://home.treasury.gov/policy-issues/office-of-foreign-assets-control-sanctions-programs-and-information
- EU sanctions: https://www.sanctionsmap.eu
- Features: Check indicators.yaml; typically: `no_sanctions`, `targeted_individual_sanctions`, `sector_sanctions`, `comprehensive_embargo`

> **Navigation tip**: Go to https://www.un.org/securitycouncil/sanctions/information → select the country's sanctions regime → check the "measures" tab to see which sanctions were active in a given year.

### diplomatic_integration
- Look for: Embassy openings/closings, multilateral membership changes, diplomatic recognition events
- Key questions: Is the country a member of AU/EU/NATO/ASEAN? Are ambassadors recalled? Diplomatic isolation?
- Features: Check indicators.yaml; typically: `full_diplomatic_integration`, `partial_isolation`, `significant_isolation`, `complete_pariah_state`

> **Key distinction**: Formal multilateral membership (holding a UN seat) is different from functional diplomatic engagement. A country with UN membership but no active bilateral relations with neighbors is "partially isolated", not "fully integrated". Document this distinction in qualitative.assessment.

### foreign_military
- Look for: SIPRI peacekeeping data, news reports on troop presence, UN mission mandates
- Key questions: Are foreign troops present? Under what mandate (UN, bilateral, occupying)?
- SIPRI military deployments: https://sipri.org/databases/pko
**Classify the type of foreign presence explicitly**: (1) UN-mandated peacekeeping → `un_peacekeepers`; (2) regional organization forces (AU, NATO, ECOWAS) → `bilateral_security_forces`; (3) bilateral security agreement (invited) → `bilateral_security_forces`; (4) occupying forces (uninvited) → `occupying_force`. These map to different feature tags with different policy implications.
- Features: Check indicators.yaml; typically: `no_foreign_forces`, `un_peacekeepers`, `bilateral_security_forces`, `occupying_force`, `multiple_foreign_actors`

## Handling Uncertainty

When evidence is limited or contradictory:
1. Use the **most conservative** feature tag (don't overstate severity)
2. Set `confidence: low`
3. Document in `notes`: "Assessment based on [source]; contradictory reports exist from [other source]"
4. Provide the range of assessments in the `qualitative.assessment` text

When evidence is sparse (pre-1995 for African countries, active conflict zones, authoritarian states), be explicit about *why* confidence is low in `notes`. Do not leave `notes` empty when `confidence: low`.

## Reliability Assignment

| Source type | Reliability |
|------------|-------------|
| think_tank_report (ICG, Carnegie) | high |
| international_organization | high |
| academic_paper | high |
| ngo_report (HRW, Amnesty) | medium |
| news_report (Reuters, BBC) | medium |
| inferred (no direct source) | low |

## Citation Format

```yaml
sources:
  - citation: "ICG Report: <Title>, <Month Year>"
    url: "<report URL>"
    type: think_tank_report
    reliability: high
  - citation: "Reuters, '<Headline>', <Date>"
    url: "<article URL>"
    type: news_report
    reliability: medium
```

> **URL is mandatory for every source.** `url: null` is never acceptable except for `type: inferred`.
> - For think tank / NGO reports: use the report permalink on the issuing organization's website.
> - For news articles: use the original article URL. If the page is no longer live, find the archived version at `https://web.archive.org/web/<timestamp>/<original-url>` or search Google News (`https://news.google.com/`) for the story.
> - If no URL can be found at all: change the source type to `inferred` and note the original citation.

## Learning Entry Seed

See `.claude/meta/learnings/source-qualitative.md` for documented edge cases and hard-won guidance from past collection sessions.

$ARGUMENTS