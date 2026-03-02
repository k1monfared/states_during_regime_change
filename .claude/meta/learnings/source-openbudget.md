# Learnings: source-openbudget

Observations from real data collection sessions. Used by `/improve-skill source-openbudget`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The interpolation YAML example places `notes` inside the `quantitative` block, but `notes` belongs in the `qualitative` section per the data-schema. This is a structural error in the skill that would cause validation warnings. The example needs to be corrected.
- [hypothesis] The biennial survey creates a systematic gap: for 39 countries × 30+ years, roughly half the entries require interpolation. Agents may not realize the scale of interpolation needed and may leave non-survey years as data_status: missing rather than interpolating.
- [hypothesis] Some project countries are consistently absent (Yemen post-2011, Myanmar post-2021, conflict states). Agents may spend time searching for data that doesn't exist. The coverage gaps section would benefit from a more explicit list of which project countries are absent in which years.
- [hypothesis] The survey covers the prior fiscal year's budget practices — there is a 1-year lag. A survey published in 2021 describes 2020's budget. For countries with fiscal years not matching calendar years, this lag is compounded. Agents may assign the survey year rather than the fiscal year assessed.
- [hypothesis] IBP country pages sometimes show different scores from the downloadable dataset due to updates or corrections. Always cite from the downloadable dataset with the dataset version, not from the country page directly.
