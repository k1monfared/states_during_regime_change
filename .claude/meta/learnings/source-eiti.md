# Learnings: source-eiti

Observations from real data collection sessions. Used by `/improve-skill source-eiti`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] EITI status changes mid-year occasionally. The skill says to use year-end status, which gives the right answer — but agents need to check whether the status was granted before or after December 31 for mid-year changes.
- [hypothesis] The skill says "Do not convert to 0-100 yourself — enter the status string as a feature tag." But agents may try to enter a score number (e.g., 80 for Compliant) rather than the feature tag string. The scoring_rubrics.yaml handles the conversion — clarifying this would prevent the error.
- [hypothesis] EITI reports often lag by 2 years. A country's most recent EITI report available in 2024 might only cover 2022 data. Agents may not realize the lag and assume a country with no recent EITI report has left EITI, when the report is just delayed.
- [hypothesis] For countries that have never joined EITI and have no significant extractive sector (extractive_sector_na), the determination of "no significant extractive sector" requires judgment. "Check aggregation.yaml" is not actionable if that file has no entries for the country.
- [hypothesis] The EITI website at https://eiti.org/countries/<country-name> uses English common names, not the project's country_id. Agents may struggle with name matching (e.g., cote_divoire → "Côte d'Ivoire" → EITI URL is "/cote-divoire"). A note on URL slug formatting would help.
