# Learnings: source-worldbank

Observations from real data collection sessions. Used by `/improve-skill source-worldbank`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The WDI portal sometimes shows different values depending on whether you use the API vs. the web interface, particularly for recently revised years. When values differ, use the API value (more precisely dated) and note the access date carefully.
- [hypothesis] FDI can be negative (divestment) — entering negative values may trigger validation warnings if the validator isn't calibrated for this. Note in qualitative.notes: "Negative FDI indicates net divestment."
- [hypothesis] Statistical transparency (IQ.SCI.OVRL) was discontinued after 2020; agents may not notice this and assume it covers recent years. The coverage gap section documents this, but the Quick Lookup Steps don't warn at the lookup stage.
- [hypothesis] For conflict states (Syria 2013+, Yemen 2015+), the WDI API returns null or estimated values without flagging them as estimates. Agents may enter these without the appropriate reliability downgrade to medium.
- [hypothesis] The WDI URL for indicators changes format occasionally; the landing page URL (https://data.worldbank.org/indicator/<Series Code>) is stable but the direct data link is not — use the landing page URL in citations.
