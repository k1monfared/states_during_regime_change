# Learnings: source-conflict

Observations from real data collection sessions. Used by `/improve-skill source-conflict`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] UCDP uses minimum death estimates (conservative). For the same country-year, ACLED often reports higher figures. When both sources are available and disagree, enter the UCDP figure as quantitative.value (it is the academic standard for conflict research) and note the ACLED figure in qualitative.notes.
- [hypothesis] The death-count crosswalk boundaries are approximate — a country with 98 deaths sits at the boundary of sporadic_low_level_violence and minimal_lt_100. Rule: round to the nearest category; if genuinely borderline, use the lower category and note in qualitative.notes.
- [hypothesis] ACLED registration is required for data download. If an agent cannot register, UCDP data is sufficient for most use cases; ACLED is supplementary except for sub-war-threshold violence.
- [hypothesis] For countries with multiple simultaneous conflict types (state vs. rebel AND non-state communal violence), agents may add only one feature tag. Both types can be present — check indicators.yaml for whether multiple tags are valid for political_violence.
- [hypothesis] UCDP data lags by roughly 1 year — the 2024 dataset release covers through 2023. For very recent years (current-1 or current), rely on ACLED or qualitative sources and note the data currency limitation.
