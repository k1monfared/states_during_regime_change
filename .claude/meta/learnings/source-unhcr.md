# Learnings: source-unhcr

Observations from real data collection sessions. Used by `/improve-skill source-unhcr`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The population denominator (from World Bank SP.POP.TOTL) must be fetched separately, requiring two data sources per entry. Agents may compute displacement figures without the denominator and enter raw counts rather than per-1000 rates. The skill mentions the denominator at the end but should remind agents at the point of computing the metric.
- [hypothesis] IDMC and UNHCR sometimes give very different IDP figures for the same country-year because they use different definitions of "new displacement" (IDMC is more inclusive). For consistency, prefer IDMC for IDPs and UNHCR for refugees, and cite both when using both.
- [hypothesis] UNHCR tracks both stock (total refugees from country X currently registered) and flow (new refugees in year Y). The skill correctly says to use new displacement (flow), but the UNHCR Data Finder defaults to showing the stock figure, which can be 10-100x larger. Agents may use the stock figure by mistake.
- [hypothesis] Active conflict years produce displacement figures that are revised substantially in subsequent UNHCR reports. For Syria 2013-2015 and Yemen 2015-2017, figures from the time were revised significantly. Use the most recent UNHCR estimates and note "preliminary" only for the most recent year.
- [hypothesis] Near-zero displacement (peaceful countries) is correct data — minimal_displacement is the right tag. Agents may leave these entries blank thinking zero-displacement is not interesting data. For peaceful countries, filling this correctly is important for calibration.
