---
name: country-config
layer: 1-general
purpose: Read and interpret data/config/countries.yaml; know how to add new country entries
used_by: [scaffold-country, analyze-country, compare]
---

# Country Config — `data/config/countries.yaml`

## File Purpose

`data/config/countries.yaml` is the single source of truth for:
- Which countries are in the project
- Their regime change years (can be multiple)
- Their region and transition category
- Their time range for data collection

All scripts and commands derive country metadata from this file.

## Schema

```yaml
<country_id>:                       # snake_case, unique key
  name: <display name>
  region: <region>                  # see Regions below
  category: <transition_type>       # see Categories below
  regime_change_years:
    - <YYYY>                        # one or more years
    - <YYYY>
  time_range:                       # optional; auto-calculated if absent
    start: <YYYY>
    end: <YYYY>
  notes: <string | null>            # optional free text
```

## time_range Calculation

If `time_range` is not explicitly set, it is auto-calculated as:
- **start**: `min(regime_change_years) - 15`
- **end**: current year

To override (e.g., for newly independent states where pre-independence data is sparse), set `time_range.start` and `time_range.end` explicitly.

Example override:
```yaml
south_sudan:
  regime_change_years:
    - 2011
  time_range:
    start: 2005      # override; 1996 has no usable data
    end: 2026
```

## Regions

| Key | Countries |
|-----|-----------|
| `mena` | iraq, libya, egypt, syria, yemen, tunisia, afghanistan, algeria |
| `africa_violent` | drc, sierra_leone, liberia, cote_divoire, car, mali, sudan, burkina_faso, ethiopia, south_sudan |
| `africa_peaceful` | south_africa, ghana, senegal, kenya, gambia, malawi |
| `eastern_europe` | serbia, georgia, kyrgyzstan, ukraine, armenia, croatia, slovakia |
| `asia` | indonesia, nepal, myanmar, east_timor, malaysia |
| `latin_america` | venezuela, peru, mexico |

## Transition Categories

| Category | Description |
|----------|-------------|
| `violent_unstable` | Violent transition; ongoing instability |
| `violent_then_recovery` | Violent transition; gradual stabilization |
| `violent_then_stabilization` | Violent transition; partial stabilization |
| `violent_recurring` | Repeated violent transitions |
| `peaceful_successful` | Peaceful transition; democratization succeeded |
| `peaceful_then_backsliding` | Peaceful transition; subsequent democratic erosion |
| `peaceful_then_violent` | Peaceful transition; descended into violence |
| `peaceful_external_pressure` | Peaceful transition driven by external actors |
| `peaceful_institutional` | Institutional/legal mechanism enabled transition |
| `peaceful_electoral` | Electoral victory enabled transition |
| `peaceful_persistent_instability` | Nominally peaceful but persistent instability |
| `electoral_then_authoritarian` | Electoral win became authoritarian consolidation |
| `recurring_revolutions` | Multiple rounds of popular uprisings |
| `managed_partial` | Managed partial transition; limited reform |
| `new_state_stabilized` | New state formation and subsequent stabilization |
| `peaceful_then_external_aggression` | Peaceful transition; later attacked externally |
| `peaceful_then_external_defeat` | Peaceful transition; later external military defeat |

## Adding a New Country

1. Choose a `country_id`: lowercase, underscores only, ≤20 chars (e.g., `new_country`)
2. Determine regime_change_years (required)
3. Select the matching region and category from the tables above
4. Decide whether to use auto-calculated time_range or override
5. Add the entry to `data/config/countries.yaml`
6. Run `/scaffold-country <country_id>` to create the 20 YAML files

### Minimal New Entry Example

```yaml
gambia_test:
  name: Gambia (Test)
  region: africa_peaceful
  category: peaceful_external_pressure
  regime_change_years:
    - 2017
  notes: "Test entry — delete after verification"
```

### Full Entry Example

```yaml
zambia:
  name: Zambia
  region: africa_peaceful
  category: peaceful_electoral
  regime_change_years:
    - 1991
    - 2011
    - 2021
  time_range:
    start: 1988
    end: 2026
  notes: "Multiple peaceful electoral alternations"
```

## Reading the Config in Practice

When any command needs the country's time_range or regime_change_years, read them from this file rather than hardcoding.

```python
# Pattern used in scripts:
import yaml
with open("data/config/countries.yaml") as f:
    countries = yaml.safe_load(f)

country = countries[country_id]
earliest = min(country["regime_change_years"])
start = country.get("time_range", {}).get("start", earliest - 15)
end   = country.get("time_range", {}).get("end", current_year)
```

## Current Country Count

39 countries across 6 regions (as of 2026-02-28).
