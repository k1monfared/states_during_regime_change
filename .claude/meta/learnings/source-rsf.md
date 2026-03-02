# Learnings: source-rsf

Observations from real data collection sessions. Used by `/improve-skill source-rsf`.

## 2026-02-28 (hypothesised — not yet confirmed by session experience)

- [hypothesis] The "double-check" paragraph in the Scale section ("Wait — double-check:...") reads as uncertainty in the skill itself, even though the content is correct. Agents may lose confidence in the scale guidance. Should be rewritten as a clean authoritative statement.
- [hypothesis] RSF coverage begins 2002. For project countries with regime changes in the 1990s or early 2000s, agents need data from before RSF existed. The skill says to use Freedom House Press Freedom (discontinued 2017) as fallback, but FH press freedom is also not available for all countries pre-2002. The real fallback for pre-2002 is qualitative assessment only.
- [hypothesis] The 2013 and 2022 methodology breaks mean trend analysis across these breaks is unreliable, but the skill doesn't say what to do when a country's time range spans these breaks (which most do). Agents may enter all values without noting the incomparability. A standard note template for methodology-break years would help.
- [hypothesis] Some project countries (Syria, Libya, Yemen) consistently score at the floor (3–7 out of 100). Agents may question whether their data entry is wrong. The skill should note that floor-effect scores are expected for active-conflict countries.
- [hypothesis] The RSF CSV download covers all countries and all years since 2002 in one file — much faster than looking up year-by-year. The Quick Lookup should recommend this for multi-year collection.
