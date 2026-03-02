# Learnings: collect-data

Observations from real data collection sessions. Used by `/improve-skill collect-data`.

## 2026-02-28

- The command says "If years are unspecified, use the country's full time range" but does not tell Claude how to look that up — it requires reading countries.yaml first. Worth making this explicit: "Read data/config/countries.yaml for the country's time_range before starting."
- The "Handling Special Cases / New country not yet scaffolded" section correctly points to scaffold.py but doesn't mention the new `/scaffold-country` command. The command is faster than doing it manually.
- When filling political_violence for conflict states, the feature vocabulary crosswalk from death counts to tags is not in this command — it's in source-conflict. A routing hint here would help: "For political_violence, see source-conflict skill for the death count → feature tag crosswalk."
- The command lists 20 indicators but doesn't show which source skill to use for each — a routing table would prevent Claude from guessing or using the wrong source.
- The "After Collection" section runs validate.py and generate_scores.py but doesn't run plot_data.py. For a quick sanity check, adding a plot step would help confirm the data looks reasonable.
- No mention of what to do if a year is genuinely unknowable (e.g., Syria 2013 during peak conflict): set data_status: missing, note in qualitative.notes why it's unknowable, set confidence: null. This guidance is missing.

## 2026-03-01 (Cote d'Ivoire session)

- Feature vocabulary errors are common across all indicators. Always check indicators.yaml for exact valid_features before writing. Key corrections needed: territorial_control uses `full_control_no_challenges` (not `full_effective_control`); political_violence uses `low_100_500` (not `low_50_500`); inflation uses `low_lt_3pct` (not `stable_lt_3pct`); trade_openness uses `open_70_100pct` (not `open_gt_80pct`) and `moderate_40_70pct` (not `moderate_40_80pct`); fdi uses `negative_net_outflows` (not `negative_outflow`).
- Cote d'Ivoire 2011 is a civil war/regime change year where: GDP is NOT necessarily the lowest (currency-denominated values can be distorted), FDI turns negative (net disinvestment), refugee_flows peak, political_violence peaks, and diplomatic_integration ironically improves post-Gbagbo capture as Ouattara receives international recognition.
- Cote d'Ivoire (and many WAEMU CFA franc countries) have very low inflation throughout — CFA anchor to EUR keeps prices stable. The inflation values are genuinely 0.4-4.9% through the whole period. Don't assume high crisis-year inflation for CFA countries.
- EITI compliance timeline for Cote d'Ivoire: joined 2008 (candidate), achieved compliant June 2012, maintained compliance. Critical to distinguish candidate vs compliant status in features.
- The OBS (Open Budget Survey) is only published in odd years (2008, 2010, 2012, 2015, 2017, 2019, 2021). Non-survey years require interpolation and should get reliability: low.
- WB Statistical Capacity Index (SCI) was DISCONTINUED after 2020. For years 2021+, set value: null but still provide qualitative assessment with estimated feature; get confidence: low.
- WJP Rule of Law Index Factor 3 (Open Government): many African countries were only added to the index starting around 2015-2016. Pre-coverage years need qualitative assessment with value: null.
- RSF inverted scores for Cote d'Ivoire in the 2009-2021 period range approximately 35-50 (problematic to difficult range). The civil war year 2011 and election crisis year 2020 show dips to ~35-40.
- validate.py errors must all be fixed before proceeding to generate_scores.py. Warnings (source type unknown, score inconsistency) are non-blocking.
- The quantitative transform for gdp_per_capita is "(value / peak_value) * 100" so the pipeline computes the ratio automatically. The feature (e.g., significant_decline_50_70pct) reflects the ratio range, not the absolute value. A value of 1153 USD with feature significant_decline means the ratio to peak was 50-70% — this should be reviewed for Cote d'Ivoire since 1153 in 2011 vs ~1235 in 2010 is only ~6% decline, not 50-70%.
