# Learnings: source-wjp

Observations from real data collection sessions. Used by `/improve-skill source-wjp`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The gap years 2011-2012 require interpolation, but the skill shows no YAML example. Agents will either leave these years missing or interpolate without knowing how to document it. The source-openbudget interpolation YAML is the model to follow — replicate that pattern here.
- [hypothesis] The 0-to-1 scale conversion to 0-100 is easy to forget. Agents who skip the ×100 multiplication will enter values like 0.34 instead of 34, which will fail validation. A "sanity check: score should be between 0 and 100" line would catch this.
- [hypothesis] Factor 3 (Open Government) is in the WJP Excel file alongside 8 other factors and many sub-factors. Agents may accidentally read Factor 1 (Constraints on Government Powers) or the overall index score, which appear in adjacent columns. A column-name reminder in the Quick Lookup would help.
- [hypothesis] WJP coverage gaps (Libya, Yemen, Syria) require switching to source-qualitative for the full entry. The skill lists absent countries but doesn't explain what the qualitative fallback looks like for legal_transparency specifically.
- [hypothesis] The WJP Excel download column headers change between versions (the variable names are consistent but column positions shift). Agents should check the header row before reading Factor 3 values — do not assume a fixed column position.
