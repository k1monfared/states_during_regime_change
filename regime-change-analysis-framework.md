# Framework for Measuring Post-Regime-Change Trajectories in the Middle East

## Overview

This document outlines a methodology for analyzing countries that have undergone major political transitions since 2000. The goal is to create quantifiable metrics across four dimensions that can be tracked over time and visualized to compare trajectories.

**Time Range:** 10-15 years before regime change through present

**Countries of Interest:**

*Middle East & North Africa (Original Set):*
- Iraq (2003), Libya (2011), Egypt (2011/2013), Syria (2024), Yemen (2011-2015), Tunisia (2011), Afghanistan (2001/2021), Algeria (2019)

*Africa — Violent/Unstable Transitions:*
- DRC / Congo (1997), Sierra Leone (2002), Liberia (2003), Côte d'Ivoire (2011), Central African Republic (2013), Mali (2012/2020/2021), Sudan (2019/2023), Burkina Faso (2014/2022), Ethiopia (2018), South Sudan (2011)

*Africa — Peaceful Transitions:*
- South Africa (1994), Ghana (2000), Senegal (2000), Kenya (2002), The Gambia (2017), Malawi (2020)

*Former Soviet / Eastern Europe:*
- Serbia (2000), Georgia (2003), Kyrgyzstan (2005/2010), Ukraine (2014), Armenia (2018), Croatia (2000), Slovakia (1998)

*Asia:*
- Indonesia (1998), Nepal (2006-2008), Myanmar (2021), East Timor (1999/2002), Malaysia (2018)

*Latin America:*
- Venezuela (1999+), Peru (2000), Mexico (2000)

---

## The Four Dimensions

1. **Political Stability & Governance**
2. **Economic Performance**
3. **International Standing**
4. **Transparency**

Each dimension consists of 5 sub-indicators, normalized to a common scale, then aggregated into a single dimension score.

---

## Scoring System

### Scale
All sub-indicators should be normalized to **0-100** where:
- 0 = worst possible (failed state, complete collapse, total opacity)
- 50 = regional baseline or "mediocre authoritarian" norm
- 100 = best possible (ideal functioning democracy/economy)

### Aggregation
For each dimension:
```
Dimension Score = (Sub1 + Sub2 + Sub3 + Sub4 + Sub5) / 5
```

Alternative aggregation methods:
- **Weighted average** — if some sub-indicators matter more
- **Geometric mean** — penalizes having any component at zero
- **Minimum** — score equals weakest link (most stringent)

### Baseline Indexing
For trajectory analysis, you may want to also compute:
```
Change from Baseline = Current Score - Score in Year Before Regime Change
```
This allows comparison of how much countries deviated from their pre-transition state.

---

## Dimension 1: Political Stability & Governance

### Sub-Indicators

#### 1.1 Territorial Control
*What it measures:* Percentage of country under effective central government control

| Score | Description |
|-------|-------------|
| 90-100 | Full control, no significant challenges |
| 70-89 | Minor insurgencies or disputed areas (<10% territory) |
| 50-69 | Significant areas outside control (10-30%) |
| 30-49 | Large portions contested or autonomous (30-50%) |
| 10-29 | Majority of territory outside government control |
| 0-9 | Failed state, no effective central authority |

*Sources:* Qualitative assessment from ICG reports, news analysis, academic literature

#### 1.2 Political Violence Intensity
*What it measures:* Level of conflict-related deaths, terrorism, state repression

| Score | Description |
|-------|-------------|
| 90-100 | Minimal violence (<100 conflict deaths/year) |
| 70-89 | Low-level violence (100-500 deaths/year) |
| 50-69 | Moderate violence (500-2,000 deaths/year) |
| 30-49 | High violence (2,000-10,000 deaths/year) |
| 10-29 | Severe conflict (10,000-50,000 deaths/year) |
| 0-9 | Catastrophic (>50,000 deaths/year, active civil war) |

*Sources:* UCDP/PRIO Armed Conflict Dataset, Uppsala Conflict Data Program, ACLED

#### 1.3 Institutional Functioning
*What it measures:* Do state institutions (courts, legislature, bureaucracy, elections) operate?

| Score | Description |
|-------|-------------|
| 90-100 | Fully functional democratic institutions |
| 70-89 | Functional but flawed (some manipulation, inefficiency) |
| 50-69 | Partially functional (rubber-stamp legislature, politicized courts) |
| 30-49 | Severely degraded (institutions exist but barely function) |
| 10-29 | Collapsed or purely nominal |
| 0-9 | No functioning state institutions |

*Sources:* V-Dem indices, Freedom House, qualitative assessment

#### 1.4 Civil Liberties
*What it measures:* Freedom of expression, assembly, religion, movement

*Sources:* Freedom House "Civil Liberties" score (1-7, invert and rescale to 0-100)

```
Score = (8 - Freedom House CL Score) / 7 * 100
```

#### 1.5 Elite/Factional Cohesion
*What it measures:* Is the ruling coalition stable or fragmenting? Risk of coups?

| Score | Description |
|-------|-------------|
| 90-100 | Stable, unified governance |
| 70-89 | Minor tensions but functional coalition |
| 50-69 | Significant elite competition, but managed |
| 30-49 | Open factional conflict, risk of breakdown |
| 10-29 | Active power struggles, coups, or civil conflict among elites |
| 0-9 | Complete fragmentation, multiple competing authorities |

*Sources:* Qualitative assessment, ICG reports, news analysis

---

## Dimension 2: Economic Performance

### Sub-Indicators

#### 2.1 GDP Per Capita (Indexed)
*What it measures:* Living standards relative to baseline

*Source:* World Bank, IMF

```
Score = (Current GDP per capita / Peak GDP per capita in series) * 100
```

Or use regional percentile ranking.

#### 2.2 Inflation Rate
*What it measures:* Price stability

| Score | Description |
|-------|-------------|
| 90-100 | <3% inflation |
| 70-89 | 3-10% inflation |
| 50-69 | 10-25% inflation |
| 30-49 | 25-50% inflation |
| 10-29 | 50-100% inflation |
| 0-9 | >100% inflation (hyperinflation) |

*Sources:* World Bank, IMF, central bank data

#### 2.3 Unemployment Rate
*What it measures:* Labor market health

| Score | Description |
|-------|-------------|
| 90-100 | <5% unemployment |
| 70-89 | 5-10% unemployment |
| 50-69 | 10-15% unemployment |
| 30-49 | 15-25% unemployment |
| 10-29 | 25-40% unemployment |
| 0-9 | >40% unemployment or no functioning labor market |

*Sources:* World Bank, ILO (note: data quality varies significantly)

#### 2.4 Trade Openness
*What it measures:* Economic integration with world

```
Trade Openness = (Exports + Imports) / GDP * 100
```

Then normalize to 0-100 scale based on regional norms (MENA average ~80% of GDP).

*Sources:* World Bank

#### 2.5 Fiscal Health
*What it measures:* Government debt sustainability, budget balance

| Score | Description |
|-------|-------------|
| 90-100 | Budget surplus, low debt (<30% GDP) |
| 70-89 | Small deficit, manageable debt (30-60% GDP) |
| 50-69 | Moderate deficit, elevated debt (60-90% GDP) |
| 30-49 | Large deficit, high debt (90-120% GDP) |
| 10-29 | Unsustainable fiscal position, debt crisis |
| 0-9 | Fiscal collapse, unable to pay salaries/services |

*Sources:* IMF, World Bank, Ministry of Finance reports

---

## Dimension 3: International Standing

### Sub-Indicators

#### 3.1 Sanctions Severity
*What it measures:* Degree of international economic restrictions

| Score | Description |
|-------|-------------|
| 90-100 | No sanctions |
| 70-89 | Targeted sanctions on individuals only |
| 50-69 | Sectoral sanctions (arms, specific industries) |
| 30-49 | Broad economic sanctions with humanitarian exceptions |
| 10-29 | Comprehensive sanctions (banking, oil, trade) |
| 0-9 | Total isolation (Cuba/North Korea level) |

*Sources:* US Treasury OFAC, EU sanctions lists, UN Security Council resolutions

#### 3.2 Diplomatic Integration
*What it measures:* Recognition, embassy presence, membership in international bodies

| Score | Description |
|-------|-------------|
| 90-100 | Full diplomatic relations, active in international organizations |
| 70-89 | Normal relations with minor disputes |
| 50-69 | Partial isolation, some embassy closures |
| 30-49 | Significant diplomatic isolation |
| 10-29 | Pariah status, most embassies closed |
| 0-9 | No international recognition |

*Sources:* News analysis, foreign ministry announcements

#### 3.3 Foreign Military Presence
*What it measures:* External military involvement (negative if hostile/imposed, neutral if none, complex if invited)

| Score | Description |
|-------|-------------|
| 90-100 | No foreign military presence, full sovereignty |
| 70-89 | Limited invited presence (advisors, training) |
| 50-69 | Significant invited foreign forces |
| 30-49 | Contested presence, mixture of invited and uninvited |
| 10-29 | Occupied or major uninvited intervention |
| 0-9 | Active foreign military combat operations against/within country |

*Sources:* News analysis, IISS Military Balance

#### 3.4 Foreign Direct Investment
*What it measures:* International business confidence

*Source:* UNCTAD, World Bank

Normalize FDI inflows as % of GDP, then scale:
| Score | Description |
|-------|-------------|
| 90-100 | FDI >5% of GDP |
| 70-89 | FDI 2-5% of GDP |
| 50-69 | FDI 1-2% of GDP |
| 30-49 | FDI 0.5-1% of GDP |
| 10-29 | FDI <0.5% of GDP |
| 0-9 | Net FDI outflows or zero |

#### 3.5 Refugee Flows
*What it measures:* Population displacement as indicator of crisis severity

| Score | Description |
|-------|-------------|
| 90-100 | Net refugee returns, minimal displacement |
| 70-89 | Stable, minimal new displacement |
| 50-69 | Moderate outflows (<1% population/year) |
| 30-49 | Significant outflows (1-3% population/year) |
| 10-29 | Mass displacement (3-10% population/year) |
| 0-9 | Catastrophic displacement (>10% population displaced) |

*Sources:* UNHCR

---

## Dimension 4: Transparency

### Sub-Indicators

#### 4.1 Fiscal/Budget Transparency
*What it measures:* Can citizens see how public money is raised and spent?

*Source:* Open Budget Index (International Budget Partnership)

Already scaled 0-100. Use directly.

**Data availability:**
- Iraq: ✓
- Libya: Partial
- Egypt: ✓
- Syria: Limited (no data during war, may have data post-2024)
- Yemen: Limited
- Tunisia: ✓

#### 4.2 Press Freedom / Media Environment
*What it measures:* Can journalists investigate government and publish findings?

*Source:* Reporters Without Borders Press Freedom Index

The RSF index runs 0-100 where **lower is better**. Invert:
```
Score = 100 - RSF_Score
```

Alternative: Freedom House "Freedom of the Press" (discontinued 2017) or "Freedom on the Net"

#### 4.3 Statistical Transparency / Data Reliability
*What it measures:* Does the government produce credible, timely socioeconomic data?

*Source:* World Bank Statistical Capacity Indicator (0-100)

Use directly. Captures:
- Methodology quality
- Source data availability
- Periodicity and timeliness

#### 4.4 Legal/Regulatory Transparency
*What it measures:* Are laws, regulations, and court decisions accessible and predictable?

*Sources:*
- World Justice Project Rule of Law Index — "Open Government" factor (0-1, multiply by 100)
- World Bank Doing Business "Transparency" sub-index (historical, discontinued 2020)

| Score | Description |
|-------|-------------|
| 90-100 | Laws published online, searchable, timely; FOI law implemented |
| 70-89 | Most laws accessible, some delays or gaps |
| 50-69 | Partial accessibility, significant gaps |
| 30-49 | Laws difficult to access, arbitrary enforcement |
| 10-29 | Minimal publication, rule by decree |
| 0-9 | No accessible legal framework |

For countries not covered by WJP (Libya, Yemen, Syria), use qualitative coding.

#### 4.5 Extractive Industries / Resource Revenue Transparency
*What it measures:* For oil/gas states, are revenues from natural resources disclosed?

*Source:* EITI (Extractive Industries Transparency Initiative) compliance status

| Score | Description |
|-------|-------------|
| 90-100 | EITI compliant, satisfactory progress, full disclosure |
| 70-89 | EITI compliant, meaningful progress |
| 50-69 | EITI compliant with corrective actions required |
| 30-49 | EITI candidate or suspended |
| 10-29 | No EITI membership, minimal voluntary disclosure |
| 0-9 | No disclosure, opaque resource management |

**Country status:**
- Iraq: EITI compliant ✓
- Libya: Suspended
- Egypt: Not applicable (limited extractives)
- Syria: Never joined
- Yemen: Suspended
- Tunisia: Not applicable

For non-extractive economies (Tunisia, Egypt), either:
- Score as N/A and use 4-indicator average
- Substitute with "State-Owned Enterprise Transparency" or similar

---

## Data Sources Summary

| Source | URL | Indicators Covered |
|--------|-----|-------------------|
| World Bank | data.worldbank.org | GDP, trade, FDI, statistical capacity, governance indicators |
| IMF | imf.org/data | GDP, inflation, fiscal data |
| Freedom House | freedomhouse.org | Civil liberties, political rights, (historical) press freedom |
| UCDP | ucdp.uu.se | Conflict deaths, armed conflict data |
| ACLED | acleddata.com | Political violence events |
| Fragile States Index | fragilestatesindex.org | Composite fragility scores |
| Open Budget Index | internationalbudget.org | Budget transparency |
| Reporters Without Borders | rsf.org | Press freedom index |
| World Justice Project | worldjusticeproject.org | Rule of law, open government |
| EITI | eiti.org | Resource revenue transparency |
| UNHCR | unhcr.org | Refugee statistics |
| V-Dem | v-dem.net | Democracy indices, institutional quality |

---

## Handling Missing Data

### Strategies

1. **Floor scores for failed states:** During active civil war or state collapse, assign minimum scores (5-10) for governance, transparency, and economic indicators where data doesn't exist.

2. **Interpolation:** For single missing years in otherwise complete series, interpolate linearly.

3. **Proxy indicators:** When primary source unavailable, use correlated alternative (e.g., use Freedom House instead of RSF for press freedom).

4. **Qualitative coding:** For completely uncovered indicators, make expert judgment based on reports from ICG, Chatham House, Carnegie, Brookings.

5. **Mark as missing:** In visualizations, show gaps rather than fake data. Use dashed lines or different colors.

### Documentation
Always document:
- Which value is observed vs. imputed
- Source for each data point
- Confidence level (high/medium/low)

---

## Visualization Recommendations

### Primary Views

1. **Multi-line time series (per country)**
   - X-axis: Year
   - Y-axis: Score (0-100)
   - Four lines: Political, Economic, International, Transparency
   - Vertical line marking regime change year
   - Shaded confidence intervals if using imputed data

2. **Small multiples (cross-country comparison)**
   - Same chart structure repeated for each country
   - Allows visual comparison of trajectories
   - Align x-axis to "years since regime change" for direct comparison

3. **Heatmap**
   - Rows: Countries
   - Columns: Years
   - Color intensity: Composite score or single dimension
   - Good for seeing regional patterns

4. **Trajectory overlay**
   - X-axis: Years relative to regime change (-15 to +10)
   - Y-axis: Score
   - Multiple countries on same plot
   - Shows who recovers faster, who collapses further

### Secondary Views

5. **Stacked area / composition chart**
   - Shows which sub-indicators drive the dimension score
   - Useful for decomposing "transparency improved because X but Y got worse"

6. **Radar/spider chart**
   - One chart per country-year
   - Four axes for four dimensions
   - Good for snapshot comparisons

7. **Scatter plot**
   - Compare two dimensions against each other
   - E.g., Political stability vs. Economic performance
   - Track trajectory over time with connected points

---

## Implementation Notes

### Data Structure

Recommended schema:
```
country | year | dimension | sub_indicator | value | source | imputed | confidence
--------|------|-----------|---------------|-------|--------|---------|----------
Iraq    | 2005 | political | territorial   | 35    | ICG    | no      | high
Iraq    | 2005 | political | violence      | 15    | UCDP   | no      | high
...
```

Or wide format:
```
country | year | pol_territorial | pol_violence | pol_institutions | ... | trans_budget | trans_press | ...
```

### Workflow

1. **Data collection:** Pull quantitative data from APIs/downloads first
2. **Gap identification:** Note where data is missing
3. **Qualitative coding:** Fill gaps with expert judgment
4. **Normalization:** Convert all indicators to 0-100 scale
5. **Aggregation:** Compute dimension scores
6. **Validation:** Sanity check — do the scores match your intuition?
7. **Visualization:** Generate charts
8. **Iteration:** Adjust scoring rubrics based on results

### Quality Checks

- Do scores move in expected direction around known events? (e.g., ISIS takeover should tank Iraq's political score in 2014)
- Are cross-country comparisons sensible? (Tunisia should score higher than Yemen)
- Is there sufficient variance to be analytically useful?
- Are any indicators always at floor/ceiling? (If so, consider rescaling or replacing)

---

## Country-Specific Notes

### Middle East & North Africa

#### Iraq (Regime Change: 2003)
- Time range: 1988-2025
- Key events: Gulf War sanctions, 2003 invasion, 2006-2008 civil war, 2014-2017 ISIS, post-2017 stabilization
- Data challenges: Pre-2003 data sparse; 2006-2008 data unreliable

#### Libya (Regime Change: 2011)
- Time range: 1996-2025
- Key events: 2011 NATO intervention, 2014 split into rival governments, 2020 ceasefire
- Data challenges: Two parallel governments 2014-2020; most indices don't cover Libya well

#### Egypt (Regime Change: 2011, 2013)
- Time range: 1996-2025
- Key events: 2011 Mubarak ousted, 2012 Morsi elected, 2013 Sisi coup
- Data challenges: Best data availability of the set; two transitions to track

#### Syria (Regime Change: 2024)
- Time range: 2009-2025
- Key events: 2011 uprising, civil war, 2014 ISIS, 2024 Assad fall
- Data challenges: Almost no reliable data 2012-2024; treat as failed state

#### Yemen (Regime Change: 2011-2015)
- Time range: 1996-2025
- Key events: 2011 Saleh ousted, 2014 Houthi takeover, 2015 Saudi intervention
- Data challenges: Ongoing war; minimal data; treat as failed state post-2015

#### Tunisia (Regime Change: 2011)
- Time range: 1996-2025
- Key events: 2011 revolution, democratic transition, 2021 Saied power grab
- Data challenges: Best case for comparison; good data availability; shows both improvement and backsliding

#### Afghanistan (Regime Change: 2001, 2021)
- Time range: 1996-2025
- Key events: 2001 US invasion/Taliban ousted, 2001-2021 NATO-backed government, 2021 Taliban return
- Data challenges: Two opposite transitions; pre-2001 data almost nonexistent; post-2021 data rapidly deteriorating; unique case of transition reversal
- Category: Violent/unstable

#### Algeria (Regime Change: 2019)
- Time range: 2004-2025
- Key events: 2019 Hirak protests, Bouteflika ousted, military-managed transition, Tebboune elected
- Data challenges: Relatively good data; transition was managed by existing power structures (military); less dramatic rupture than others
- Category: Managed/partial transition

### Africa — Violent/Unstable Transitions

#### DRC / Congo (Regime Change: 1997)
- Time range: 1990-2025
- Key events: 1997 Mobutu overthrown by Kabila, 1998-2003 Second Congo War, 2001 Kabila assassinated, 2006 elections, ongoing eastern conflict
- Data challenges: Enormous country with regional variation; eastern provinces essentially separate conflict zone; data quality very low
- Category: Violent, prolonged instability

#### Sierra Leone (Regime Change: 2002)
- Time range: 1990-2025
- Key events: 1991-2002 civil war, 1999 Lomé Accord, 2002 war declared over, UN peacekeeping, 2007 peaceful election transfer
- Data challenges: War-era data unreliable; post-war data improves significantly; relatively successful post-conflict case
- Category: Violent, then successful recovery

#### Liberia (Regime Change: 2003)
- Time range: 1990-2025
- Key events: 1989-2003 civil wars, 2003 Taylor exiled, 2005 Ellen Johnson Sirleaf elected, UN peacekeeping until 2018
- Data challenges: Similar to Sierra Leone; war-era gaps; post-2005 data reasonably available
- Category: Violent, then recovery

#### Côte d'Ivoire (Regime Change: 2011)
- Time range: 1996-2025
- Key events: 2002 civil war, 2007 Ouagadougou accord, 2010 disputed election, 2011 Gbagbo forcibly removed, Ouattara takes power
- Data challenges: Moderate data availability; French-language sources needed; relatively quick stabilization post-2011
- Category: Violent, then stabilization

#### Central African Republic (Regime Change: 2013)
- Time range: 2000-2025
- Key events: 2013 Séléka rebels overthrow Bozizé, anti-Balaka militias form, 2014 transitional government, ongoing instability, Russian Wagner/Africa Corps presence
- Data challenges: Very poor data availability; one of the world's least-covered countries; ongoing fragmentation
- Category: Violent, prolonged instability

#### Mali (Regime Change: 2012, 2020, 2021)
- Time range: 2000-2025
- Key events: 2012 Tuareg rebellion + military coup, 2013 French intervention, 2020 coup (Keïta ousted), 2021 second coup, junta rule, Wagner presence, French withdrawal
- Data challenges: Multiple transitions complicate analysis; northern territory largely ungoverned; jihadi insurgency ongoing
- Category: Violent, recurring instability

#### Sudan (Regime Change: 2019, 2023)
- Time range: 2004-2025
- Key events: Darfur conflict, 2019 revolution (Bashir ousted), 2019-2021 transitional government, 2021 military coup, 2023 RSF vs SAF civil war
- Data challenges: Current civil war makes data collection impossible; pre-2019 data moderate; Darfur complicates earlier period
- Category: Violent, ongoing collapse

#### Burkina Faso (Regime Change: 2014, 2022)
- Time range: 2000-2025
- Key events: 2014 popular uprising (Compaoré ousted after 27 years), 2015 elections, 2022 two military coups, junta rule, jihadi insurgency
- Data challenges: Pre-2014 data moderate; post-2022 data scarce; insurgency displacing millions
- Category: Initially peaceful transition, then violent relapse

#### Ethiopia (Regime Change: 2018)
- Time range: 2005-2025
- Key events: 2018 Abiy Ahmed takes power, reforms, 2019 Nobel Peace Prize, 2020-2022 Tigray War, Pretoria ceasefire 2022
- Data challenges: Good data pre-2020; Tigray war era data unreliable for affected regions; large country with regional variation
- Category: Peaceful transition, then violent conflict

#### South Sudan (Independence/Regime Change: 2011)
- Time range: 2005-2025
- Key events: 2005 CPA, 2011 independence, 2013 civil war, 2018 peace agreement, ongoing fragility
- Data challenges: Country barely existed before 2011; pre-independence data as part of Sudan; very limited statistical capacity
- Category: New state, immediate collapse into conflict

### Africa — Peaceful Transitions

#### South Africa (Regime Change: 1994)
- Time range: 1990-2025
- Key events: 1990 Mandela released, 1994 first democratic elections, ANC rule, gradual institutional decay, 2024 coalition government
- Data challenges: Excellent data availability; long time series; well-studied case
- Category: Peaceful, successful (with later stagnation)

#### Ghana (Regime Change: 2000)
- Time range: 1990-2025
- Key events: 1992 return to democracy, 2000 first peaceful transfer (Rawlings to Kufuor), subsequent peaceful transfers
- Data challenges: Good data availability; model African democracy case
- Category: Peaceful, successful

#### Senegal (Regime Change: 2000)
- Time range: 1990-2025
- Key events: 2000 Diouf loses to Wade (first transfer since independence), 2012 Wade loses to Sall, ongoing democratic tradition
- Data challenges: Good data availability; francophone sources helpful
- Category: Peaceful, successful

#### Kenya (Regime Change: 2002)
- Time range: 1995-2025
- Key events: 2002 KANU loses (Moi era ends), 2007-2008 post-election violence, 2010 new constitution, subsequent peaceful transfers
- Data challenges: Good data; 2007-2008 violence is a significant dip in an otherwise peaceful trajectory
- Category: Mostly peaceful (with 2007-2008 exception)

#### The Gambia (Regime Change: 2017)
- Time range: 2005-2025
- Key events: Jammeh's 22-year rule ends, 2016 election loss, 2017 ECOWAS intervention forces Jammeh out, Barrow takes power
- Data challenges: Small country, limited data; Jammeh era statistics unreliable
- Category: Peaceful (with external pressure)

#### Malawi (Regime Change: 2020)
- Time range: 2005-2025
- Key events: 2019 disputed election, 2020 court-ordered rerun, opposition wins
- Data challenges: Moderate data availability; relatively straightforward case
- Category: Peaceful, institutional

### Former Soviet / Eastern Europe

#### Serbia (Regime Change: 2000)
- Time range: 1995-2025
- Key events: 1990s wars, 1999 NATO bombing, 2000 Milošević overthrown (Bulldozer Revolution), EU accession process, 2012+ Vučić era (democratic backsliding)
- Data challenges: Good data availability; Kosovo issue complicates territorial indicators
- Category: Peaceful revolution, then gradual backsliding

#### Georgia (Regime Change: 2003)
- Time range: 1995-2025
- Key events: 2003 Rose Revolution, Saakashvili reforms, 2008 Russia-Georgia war, 2012 peaceful transfer to Georgian Dream, recent authoritarian turn
- Data challenges: Good data; 2008 war is a significant event; Abkhazia/South Ossetia frozen conflicts
- Category: Peaceful revolution, reforms, then backsliding

#### Kyrgyzstan (Regime Change: 2005, 2010)
- Time range: 1995-2025
- Key events: 2005 Tulip Revolution (Akayev ousted), 2010 revolution (Bakiyev ousted), ethnic violence in south, 2020 third upheaval
- Data challenges: Moderate data; multiple transitions make analysis complex; small economy
- Category: Recurring revolutions, partial instability

#### Ukraine (Regime Change: 2014)
- Time range: 2000-2025
- Key events: 2004 Orange Revolution, 2014 Euromaidan (Yanukovych ousted), Crimea annexation, Donbas war, 2022 full Russian invasion
- Data challenges: Good data pre-2022; post-2022 wartime data complicated; territorial control issues
- Category: Peaceful revolution, then external aggression

#### Armenia (Regime Change: 2018)
- Time range: 2005-2025
- Key events: 2018 Velvet Revolution (Pashinyan), 2020 Nagorno-Karabakh war (loss to Azerbaijan), 2023 ethnic cleansing of Karabakh Armenians
- Data challenges: Good data; 2020 war is major event; small economy
- Category: Peaceful revolution, then external military defeat

#### Croatia (Regime Change: 2000)
- Time range: 1995-2025
- Key events: 1995 end of war, 1999 Tuđman dies, 2000 democratic transition, EU accession 2013
- Data challenges: Good data; successful transition case; EU integration provides benchmark
- Category: Peaceful, successful (EU integration)

#### Slovakia (Regime Change: 1998)
- Time range: 1993-2025
- Key events: 1993 independence, 1994-1998 Mečiar's semi-authoritarian rule, 1998 democratic coalition wins, EU accession 2004
- Data challenges: Excellent data; EU integration provides benchmark; Mečiar-era backsliding was mild by global standards
- Category: Peaceful, successful (EU integration)

### Asia

#### Indonesia (Regime Change: 1998)
- Time range: 1990-2025
- Key events: 1997 Asian financial crisis, 1998 Suharto falls, reformasi era, 1999 East Timor independence, decentralization, democratic consolidation
- Data challenges: Good data; large diverse country; regional variation; Aceh/Papua conflicts
- Category: Peaceful (with some violence), largely successful

#### Nepal (Regime Change: 2006-2008)
- Time range: 1996-2025
- Key events: 1996-2006 Maoist insurgency, 2006 People's Movement, 2008 monarchy abolished, federal democratic republic, political instability but no return to war
- Data challenges: Moderate data; insurgency period complicated; frequent government changes
- Category: Violent insurgency leading to peaceful transition

#### Myanmar (Regime Change: 2021)
- Time range: 2005-2025
- Key events: 2010 partial opening, 2015 NLD wins election, 2021 military coup, ongoing civil war/resistance
- Data challenges: Pre-2010 data very limited; post-coup data nearly impossible; resistance controls significant territory
- Category: Violent regression (coup reversing democratic transition)

#### East Timor / Timor-Leste (Independence: 1999/2002)
- Time range: 1999-2025
- Key events: 1999 independence referendum, Indonesian militia violence, UN administration, 2002 full independence, 2006 internal crisis, stabilization
- Data challenges: No pre-independence data as separate entity; small country; moderate data post-2002
- Category: New state with some initial violence, then stabilization

#### Malaysia (Regime Change: 2018)
- Time range: 2005-2025
- Key events: 2018 Pakatan Harapan wins (first opposition victory since independence 1957), Mahathir returns as PM, 2020 Sheraton Move (coalition collapse), political instability
- Data challenges: Excellent data; transition was electoral; relatively mild by global standards
- Category: Peaceful, electoral

### Latin America

#### Venezuela (Regime Change: 1999+)
- Time range: 1995-2025
- Key events: 1998 Chávez elected, Bolivarian revolution, 2002 failed coup, 2013 Maduro succeeds Chávez, economic collapse, 2019 political crisis, mass emigration
- Data challenges: Government statistics increasingly unreliable post-2013; hyperinflation makes economic data difficult; regime claims legitimacy throughout
- Category: Electoral revolution, then gradual authoritarian collapse

#### Peru (Regime Change: 2000)
- Time range: 1995-2025
- Key events: 1990-2000 Fujimori's authoritarian rule, 2000 Fujimori flees, democratic restoration, chronic political instability (multiple presidents impeached/resigned)
- Data challenges: Good data; democracy restored but extremely unstable politics
- Category: Peaceful (authoritarian fled), persistent political instability

#### Mexico (Regime Change: 2000)
- Time range: 1995-2025
- Key events: 2000 PRI loses after 71 years (Fox/PAN wins), democratic alternation, drug war intensifies post-2006, 2018 AMLO/Morena wins
- Data challenges: Excellent data; transition was purely electoral; drug violence complicates political stability scores despite democratic functioning
- Category: Peaceful, electoral, successful democracy (with separate security crisis)

---

## Next Steps

1. [ ] Finalize country list
2. [ ] Download quantitative data from primary sources
3. [ ] Create data collection spreadsheet
4. [ ] Code qualitative indicators for gap-filling
5. [ ] Build aggregation pipeline
6. [ ] Generate initial visualizations
7. [ ] Validate and iterate on scoring rubrics
8. [ ] Write narrative analysis accompanying visualizations
