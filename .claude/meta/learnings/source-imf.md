# Learnings: source-imf

Observations from real data collection sessions. Used by `/improve-skill source-imf`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The WEO database is updated twice a year (April and October); values for the same country-year differ between editions. For historical years (>2 years old), editions converge, but for recent years the choice of edition matters. The April edition is more widely cited for cross-country comparisons — prefer it when both are available.
- [hypothesis] For fiscal_health, agents may confuse GGXCNL_NGDP (net lending/borrowing = fiscal balance) with GGXWDG_NGDP (gross debt). The skill explains both but agents may enter the debt figure as the primary quantitative.value when the balance is what's wanted.
- [hypothesis] Hyperinflation cases (Venezuela, Zimbabwe, South Sudan) generate very large numbers (2000%+) that may look like data entry errors. The skill handles this but agents may hesitate to enter them without reassurance that large numbers are correct.
- [hypothesis] IMF Article IV reports often contain multiple years of data in one report — an agent might cite only the year the report was published rather than the specific data year. The citation should specify the data year, not just the report publication year.
- [hypothesis] For Libya 2014–2018 (dual government), there are competing IMF data sources. The internationally recognized government (Tobruk/Bayda-based) had the IMF relationship; use that series and note the dual-government context in qualitative.notes.
