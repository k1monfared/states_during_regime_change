# Learnings: source-qualitative

Observations from real qualitative data collection sessions. Used by `/improve-skill source-qualitative`.

## 2026-02-28

- ICG reports are the single most useful source for territorial_control and elite_cohesion, but ICG's website search is inconsistent. Better approach: search Google for `site:crisisgroup.org <country> <year>` rather than using the ICG portal search directly.
- For sanctions, the UN Security Council Sanctions Committee pages are definitive but can be confusing to navigate. The clearest path: go to https://www.un.org/securitycouncil/sanctions/information → select the country's sanctions regime → check the "measures" tab for what types of sanctions were active in a given year.
- diplomatic_integration is tricky for countries that have formal UN membership but are effectively isolated (e.g., North Korea, Syria post-2011). The distinction between "formal membership" and "functional diplomatic engagement" needs to be made explicit in the features. If a country has UN seats but no bilateral relations with neighbors, that's different from full isolation.
- For foreign_military, always distinguish between: (1) UN-mandated peacekeeping, (2) regional organization forces (AU, NATO, ECOWAS), (3) bilateral security agreements (invited), (4) occupying forces (uninvited). These map to very different feature tags and policy implications.
- When using news_report sources for qualitative assessment, Reuters and AP are more reliable than local outlets because they're less likely to have government access issues. For local context, use Al-Monitor (MENA), Africa Confidential (Africa), or regional think tanks.
- The "confidence: low" + notes combination is underused. When evidence is genuinely sparse (pre-1995 for African countries, active conflict zones, authoritarian states with information control), it's better to be explicit about why confidence is low than to leave notes empty.
- For elite_cohesion in the year immediately after a regime change, the situation is almost always in flux. Default to "confidence: medium" for that year even with good sources, and note that assessments of elite cohesion in transition years are inherently uncertain.
