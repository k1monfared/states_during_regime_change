# Learnings: source-freedomhouse

Observations from real data collection sessions. Used by `/improve-skill source-freedomhouse`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The year-assignment issue is a major source of off-by-one errors: "Freedom in the World 2022" covers 2021 conditions, not 2022. This is documented in Reliability Notes but agents working quickly may miss it. It should be elevated to a prominent warning near the Scale section.
- [hypothesis] The aggregate 0-100 score (available 2013+) and the 1-7 CL score are both shown on country pages. Agents may enter the 0-100 aggregate score instead of the 1-7 CL score. The skill says to use the 1-7 score but the 0-100 score is more visually prominent on the portal.
- [hypothesis] For institutional_functioning, agents may confuse PR (Political Rights, supplementary) with CL (Civil Liberties, used for civil_liberties). Both are needed but for different indicators; when both are collected in one session, the mapping must be explicit.
- [hypothesis] Pre-1995 Freedom House coverage is spotty for newly independent states (post-Soviet, former Yugoslavia). The skill notes "Some countries not yet rated" but doesn't specify which project countries have gaps in which years.
- [hypothesis] The Excel download ("Country and Territory Ratings and Statuses" file) is the most efficient data source for multi-year collection. Agents who access the portal year-by-year waste significant time. The Quick Lookup should recommend the Excel download for any collection spanning more than 3 years.
