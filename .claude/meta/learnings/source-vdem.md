# Learnings: source-vdem

Observations from real data collection sessions. Used by `/improve-skill source-vdem`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] V-Dem releases in spring of year N cover data through N-1. Agents accessing V-Dem v14 (released 2024) can get data through 2023, not 2024. Agents may attempt to find current-year data and fail, or may use a prior-year version without checking the coverage cutoff.
- [hypothesis] The conversion from 0-1 to 0-100 is easy to forget. Unlike source-freedomhouse (which has a lookup table), source-vdem only shows the formula. Agents who skip the ×100 multiplication will enter values like 0.34 instead of 34, which will fail validation.
- [hypothesis] The V-Dem full dataset is several hundred MB. Agents may try to download and parse the entire dataset when the online analysis tool would suffice. The skill mentions the online tool but buries it in "Accessing Specific Variables" — it should be the first suggestion in a Quick Lookup section.
- [hypothesis] V-Dem confidence intervals (HDI intervals) are documented but under-used. For fragile states (Afghanistan, CAR, DRC, South Sudan) the intervals are often very wide (>0.2). Agents may not check the HDI and may assign confidence: high when the V-Dem data itself has high uncertainty.
- [hypothesis] For elite_cohesion, the combination of v2xel_frefair + v2jucomp + v2lgbicam is described but there is no worked example showing how to triangulate these into a qualitative assessment. Agents may pick just one variable and treat it as definitive, missing the multidimensional nature of elite cohesion.
