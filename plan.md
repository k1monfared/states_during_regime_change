Data Architecture Plan: Regime Change Analysis                                                     
                                                                                                    
 Goals                                                                                              
                                                                                                    
 1. Store raw data per country/dimension/subdomain/year — never lose original data                  
 2. Explicitly mark missing data (never fill silently)                                              
 3. Track provenance: sources, confidence, reliability for every data point                         
 4. Preserve qualitative assessments separately from derived scores                                 
 5. Define clear, configurable mappings: raw data → scores                                          
 6. Configurable aggregation: accept arbitrary combination functions, start with equal-weight       
 average                                                                                            
 7. Support incremental collection: append new year-data without touching existing data             
 8. Support parallel collection: each file is independent                                           
                                                                                                    
 Directory Structure                                                                                
                                                                                                    
 data/                                                                                              
 ├── raw/                          # All collected data lives here                                  
 │   ├── iraq/                                                                                      
 │   │   ├── political/                                                                             
 │   │   │   ├── territorial_control.yaml                                                           
 │   │   │   ├── political_violence.yaml                                                            
 │   │   │   ├── institutional_functioning.yaml                                                     
 │   │   │   ├── civil_liberties.yaml                                                               
 │   │   │   └── elite_cohesion.yaml                                                                
 │   │   ├── economic/                                                                              
 │   │   │   ├── gdp_per_capita.yaml                                                                
 │   │   │   ├── inflation.yaml                                                                     
 │   │   │   ├── unemployment.yaml                                                                  
 │   │   │   ├── trade_openness.yaml                                                                
 │   │   │   └── fiscal_health.yaml                                                                 
 │   │   ├── international/                                                                         
 │   │   │   ├── sanctions.yaml                                                                     
 │   │   │   ├── diplomatic_integration.yaml                                                        
 │   │   │   ├── foreign_military.yaml                                                              
 │   │   │   ├── fdi.yaml                                                                           
 │   │   │   └── refugee_flows.yaml                                                                 
 │   │   └── transparency/                                                                          
 │   │       ├── budget_transparency.yaml                                                           
 │   │       ├── press_freedom.yaml                                                                 
 │   │       ├── statistical_transparency.yaml                                                      
 │   │       ├── legal_transparency.yaml                                                            
 │   │       └── extractive_transparency.yaml                                                       
 │   ├── libya/                                                                                     
 │   │   └── ... (same structure)                                                                   
 │   ├── ... (35 countries total)                                                                   
 │                                                                                                  
 ├── config/                                                                                        
 │   ├── countries.yaml            # Country metadata (regime change years, time ranges,            
 categories)                                                                                        
 │   ├── indicators.yaml           # Indicator definitions, units, valid features                   
 │   ├── scoring_rubrics.yaml      # Qualitative features → score mappings                          
 │   └── aggregation.yaml          # Weights, combination functions, missing data rules             
 │                                                                                                  
 ├── derived/                      # Generated output (never hand-edited)                           
 │   ├── scores/                                                                                    
 │   │   ├── iraq.csv                                                                               
 │   │   └── ...                                                                                    
 │   └── combined.csv              # All countries in one file                                      
 │                                                                                                  
 └── scripts/                                                                                       
     ├── generate_scores.py        # raw + config → scores                                          
     ├── scaffold.py               # Creates empty template files for all countries                 
     └── validate.py               # Checks completeness, consistency, schema compliance            
                                                                                                    
 35 countries × 4 dimensions × 5 subdomains = 700 data files                                        
                                                                                                    
 Raw Data File Format                                                                               
                                                                                                    
 Each file (e.g., data/raw/iraq/political/territorial_control.yaml):                                
                                                                                                    
 indicator: territorial_control                                                                     
 country: iraq                                                                                      
 dimension: political                                                                               
                                                                                                    
 years:                                                                                             
   2003:                                                                                            
     data_status: partial        # complete | partial | missing | unavailable                       
                                                                                                    
     quantitative:                                                                                  
       value: null               # numeric value or null if unavailable                             
       unit: percent_territory_controlled                                                           
       source:                                                                                      
         citation: "World Bank Governance Indicators 2003"                                          
         url: "https://..."                                                                         
         access_date: "2025-01-20"                                                                  
       reliability: medium       # high | medium | low                                              
                                                                                                    
     qualitative:                                                                                   
       assessment: |                                                                                
         Following the 2003 invasion, central government controlled                                 
         Baghdad and major cities but large portions of the Sunni                                   
         triangle were contested by insurgent groups. Coalition forces                              
         provided security in some areas but did not constitute                                     
         effective central government control.                                                      
       features:                 # List of predefined feature tags from indicators.yaml             
         - large_portions_contested_30_50pct                                                        
         - foreign_occupation                                                                       
       sources:                                                                                     
         - citation: "ICG Report: Iraq's Transition, June 2003"                                     
           url: "https://www.crisisgroup.org/..."                                                   
           type: think_tank_report   # academic | think_tank_report | government | news | dataset | 
  ngo                                                                                               
           reliability: high                                                                        
         - citation: "Brookings Iraq Index, 2003"                                                   
           url: "https://..."                                                                       
           type: think_tank_report                                                                  
           reliability: high                                                                        
       confidence: medium        # high | medium | low                                              
       notes: "Immediate post-invasion period; situation fluid"                                     
                                                                                                    
   2004:                                                                                            
     data_status: partial                                                                           
     quantitative:                                                                                  
       value: null                                                                                  
       ...                                                                                          
     qualitative:                                                                                   
       ...                                                                                          
                                                                                                    
   # Years with no data collected yet are simply absent from the file.                              
   # The scaffold creates them with data_status: missing and null values.                           
                                                                                                    
 Key Design Decisions                                                                               
                                                                                                    
 - data_status: Always explicit. missing = we looked and it doesn't exist. unavailable = we haven't 
  looked yet. partial = some info but incomplete. complete = full data available.                   
 - quantitative.value: Always a number or null. Never imputed. The raw observed value only.         
 - qualitative.features: Tags from a controlled vocabulary defined in indicators.yaml. These are    
 what the scoring rubric maps from.                                                                 
 - qualitative.assessment: Free-text preservation of the original analysis. Never discarded.        
 - Sources per data point: Each year-entry has its own sources. Never assumed from neighboring      
 years.                                                                                             
 - Appending: To add year 2006 to a file, just add a 2006: section. Existing years untouched.       
                                                                                                    
 Config Files                                                                                       
                                                                                                    
 config/countries.yaml                                                                              
                                                                                                    
 iraq:                                                                                              
   display_name: "Iraq"                                                                             
   region: mena                                                                                     
   category: violent_unstable                                                                       
   regime_change_years: [2003]                                                                      
   time_range: [1988, 2025]                                                                         
   notes: "US invasion; multiple subsequent crises"                                                 
                                                                                                    
 tunisia:                                                                                           
   display_name: "Tunisia"                                                                          
   region: mena                                                                                     
   category: peaceful_then_backsliding                                                              
   regime_change_years: [2011]                                                                      
   time_range: [1996, 2025]                                                                         
   notes: "Arab Spring; democratic transition; 2021 Saied power grab"                               
                                                                                                    
 ghana:                                                                                             
   display_name: "Ghana"                                                                            
   region: africa_peaceful                                                                          
   category: peaceful_successful                                                                    
   regime_change_years: [2000]                                                                      
   time_range: [1990, 2025]                                                                         
   notes: "First peaceful transfer of power"                                                        
                                                                                                    
 # ... all 35 countries                                                                             
                                                                                                    
 config/indicators.yaml                                                                             
                                                                                                    
 Defines valid features, units, and metadata for each subdomain:                                    
                                                                                                    
 political:                                                                                         
   territorial_control:                                                                             
     description: "Percentage of country under effective central government control"                
     unit: percent_territory_controlled                                                             
     valid_features:                                                                                
       - full_control_no_challenges                                                                 
       - minor_insurgencies_lt_10pct                                                                
       - significant_areas_outside_10_30pct                                                         
       - large_portions_contested_30_50pct                                                          
       - majority_outside_control                                                                   
       - failed_state_no_authority                                                                  
       - foreign_occupation            # modifier                                                   
       - multiple_competing_authorities # modifier                                                  
     primary_sources:                                                                               
       - "ICG reports"                                                                              
       - "News analysis"                                                                            
       - "Academic literature"                                                                      
                                                                                                    
   political_violence:                                                                              
     description: "Level of conflict-related deaths, terrorism, state repression"                   
     unit: conflict_deaths_per_year                                                                 
     valid_features:                                                                                
       - minimal_lt_100                                                                             
       - low_100_500                                                                                
       - moderate_500_2000                                                                          
       - high_2000_10000                                                                            
       - severe_10000_50000                                                                         
       - catastrophic_gt_50000                                                                      
     primary_sources:                                                                               
       - "UCDP/PRIO Armed Conflict Dataset"                                                         
       - "ACLED"                                                                                    
       - "Uppsala Conflict Data Program"                                                            
                                                                                                    
   # ... all 20 indicators                                                                          
                                                                                                    
 config/scoring_rubrics.yaml                                                                        
                                                                                                    
 The mapping from raw data to scores:                                                               
                                                                                                    
 political:                                                                                         
   territorial_control:                                                                             
     # How to convert quantitative values to scores                                                 
     quantitative_scoring:                                                                          
       type: threshold          # threshold | linear | logarithmic                                  
       thresholds:                                                                                  
         - score_range: [90, 100]                                                                   
           condition: ">= 95"                                                                       
         - score_range: [70, 89]                                                                    
           condition: ">= 90"                                                                       
         - score_range: [50, 69]                                                                    
           condition: ">= 70"                                                                       
         - score_range: [30, 49]                                                                    
           condition: ">= 50"                                                                       
         - score_range: [10, 29]                                                                    
           condition: ">= 20"                                                                       
         - score_range: [0, 9]                                                                      
           condition: "< 20"                                                                        
                                                                                                    
     # How to convert qualitative features to scores                                                
     qualitative_scoring:                                                                           
       features:                                                                                    
         full_control_no_challenges:                                                                
           score_range: [90, 100]                                                                   
           default_score: 95                                                                        
         minor_insurgencies_lt_10pct:                                                               
           score_range: [70, 89]                                                                    
           default_score: 80                                                                        
         significant_areas_outside_10_30pct:                                                        
           score_range: [50, 69]                                                                    
           default_score: 60                                                                        
         large_portions_contested_30_50pct:                                                         
           score_range: [30, 49]                                                                    
           default_score: 40                                                                        
         majority_outside_control:                                                                  
           score_range: [10, 29]                                                                    
           default_score: 20                                                                        
         failed_state_no_authority:                                                                 
           score_range: [0, 9]                                                                      
           default_score: 5                                                                         
       # When multiple features present, how to combine                                             
       multi_feature_rule: minimum   # minimum | average | first                                    
                                                                                                    
     # How to combine quantitative and qualitative scores                                           
     combination_rule: quantitative_preferred                                                       
     # Options:                                                                                     
     #   quantitative_preferred  — use quant if available, else qual                                
     #   qualitative_preferred   — use qual if available, else quant                                
     #   average                 — average both when both exist                                     
     #   weighted                — e.g., 0.7 quant + 0.3 qual                                       
     #   quantitative_only       — ignore qualitative entirely                                      
     #   qualitative_only        — ignore quantitative entirely                                     
                                                                                                    
   political_violence:                                                                              
     quantitative_scoring:                                                                          
       type: threshold                                                                              
       input_transform: null    # null | log | inverse                                              
       thresholds:                                                                                  
         - score_range: [90, 100]                                                                   
           condition: "< 100"                                                                       
         - score_range: [70, 89]                                                                    
           condition: "< 500"                                                                       
         - score_range: [50, 69]                                                                    
           condition: "< 2000"                                                                      
         - score_range: [30, 49]                                                                    
           condition: "< 10000"                                                                     
         - score_range: [10, 29]                                                                    
           condition: "< 50000"                                                                     
         - score_range: [0, 9]                                                                      
           condition: ">= 50000"                                                                    
     qualitative_scoring:                                                                           
       features:                                                                                    
         minimal_lt_100:                                                                            
           score_range: [90, 100]                                                                   
           default_score: 95                                                                        
         # ...                                                                                      
     combination_rule: quantitative_preferred                                                       
                                                                                                    
   # ... all 20 indicators                                                                          
                                                                                                    
 config/aggregation.yaml                                                                            
                                                                                                    
 # Dimension-level aggregation (sub-indicators → dimension score)                                   
 dimensions:                                                                                        
   political:                                                                                       
     sub_indicators:                                                                                
       - territorial_control                                                                        
       - political_violence                                                                         
       - institutional_functioning                                                                  
       - civil_liberties                                                                            
       - elite_cohesion                                                                             
     function: weighted_average    # weighted_average | geometric_mean | minimum | harmonic_mean |  
 custom                                                                                             
     weights:                                                                                       
       territorial_control: 1.0                                                                     
       political_violence: 1.0                                                                      
       institutional_functioning: 1.0                                                               
       civil_liberties: 1.0                                                                         
       elite_cohesion: 1.0                                                                          
     missing_data_handling: skip_and_renormalize                                                    
     # Options:                                                                                     
     #   skip_and_renormalize  — average only available indicators, adjust weights                  
     #   use_zero              — treat missing as 0                                                 
     #   use_floor             — treat missing as specified floor value                             
     #   use_value: 5          — treat missing as this specific value                               
     #   exclude_year          — don't produce a score for this country-year                        
                                                                                                    
   economic:                                                                                        
     sub_indicators:                                                                                
       - gdp_per_capita                                                                             
       - inflation                                                                                  
       - unemployment                                                                               
       - trade_openness                                                                             
       - fiscal_health                                                                              
     function: weighted_average                                                                     
     weights:                                                                                       
       gdp_per_capita: 1.0                                                                          
       inflation: 1.0                                                                               
       unemployment: 1.0                                                                            
       trade_openness: 1.0                                                                          
       fiscal_health: 1.0                                                                           
     missing_data_handling: skip_and_renormalize                                                    
                                                                                                    
   international:                                                                                   
     sub_indicators:                                                                                
       - sanctions                                                                                  
       - diplomatic_integration                                                                     
       - foreign_military                                                                           
       - fdi                                                                                        
       - refugee_flows                                                                              
     function: weighted_average                                                                     
     weights:                                                                                       
       sanctions: 1.0                                                                               
       diplomatic_integration: 1.0                                                                  
       foreign_military: 1.0                                                                        
       fdi: 1.0                                                                                     
       refugee_flows: 1.0                                                                           
     missing_data_handling: skip_and_renormalize                                                    
                                                                                                    
   transparency:                                                                                    
     sub_indicators:                                                                                
       - budget_transparency                                                                        
       - press_freedom                                                                              
       - statistical_transparency                                                                   
       - legal_transparency                                                                         
       - extractive_transparency                                                                    
     function: weighted_average                                                                     
     weights:                                                                                       
       budget_transparency: 1.0                                                                     
       press_freedom: 1.0                                                                           
       statistical_transparency: 1.0                                                                
       legal_transparency: 1.0                                                                      
       extractive_transparency: 1.0                                                                 
     missing_data_handling: skip_and_renormalize                                                    
     not_applicable_indicators:                                                                     
       # Some countries don't have extractive industries                                            
       extractive_transparency:                                                                     
         countries: [tunisia, egypt, senegal, ghana, kenya, malawi, croatia, slovakia, nepal,       
 east_timor, mexico, peru, armenia]                                                                 
         handling: exclude  # exclude from average for these countries                              
                                                                                                    
 # Composite score (dimensions → single number)                                                     
 composite:                                                                                         
   function: weighted_average                                                                       
   weights:                                                                                         
     political: 1.0                                                                                 
     economic: 1.0                                                                                  
     international: 1.0                                                                             
     transparency: 1.0                                                                              
   missing_data_handling: skip_and_renormalize                                                      
                                                                                                    
 Scripts                                                                                            
                                                                                                    
 scripts/scaffold.py                                                                                
                                                                                                    
 - Reads config/countries.yaml and config/indicators.yaml                                           
 - Creates the full directory tree (35 × 4 × 5 = 700 files)                                         
 - Each file is pre-populated with the header (indicator, country, dimension) and year sections     
 with data_status: missing and null values for the country's time range                             
                                                                                                    
 scripts/generate_scores.py                                                                         
                                                                                                    
 - Reads all raw YAML files                                                                         
 - Applies scoring rubrics from config/scoring_rubrics.yaml                                         
 - Applies aggregation from config/aggregation.yaml                                                 
 - Outputs per-country CSVs and a combined CSV                                                      
 - Marks which scores are derived from quantitative vs qualitative vs missing                       
 - The aggregation function is pluggable — reads the function name from config and dispatches       
                                                                                                    
 scripts/validate.py                                                                                
                                                                                                    
 - Checks all raw files against schema                                                              
 - Reports: which country-years have data, which are missing                                        
 - Verifies qualitative features are from the valid vocabulary                                      
 - Reports confidence distribution                                                                  
 - Flags inconsistencies (e.g., quantitative says 95% control but qualitative says "failed state")  
                                                                                                    
 Implementation Steps                                                                               
                                                                                                    
 1. Create config/countries.yaml with all 35 countries and their metadata                           
 2. Create config/indicators.yaml with all 20 indicator definitions                                 
 3. Create config/scoring_rubrics.yaml with all mappings (from existing framework doc)              
 4. Create config/aggregation.yaml with default equal weights                                       
 5. Write scripts/scaffold.py and run it to generate 700 template files                             
 6. Write scripts/generate_scores.py — the scoring pipeline                                         
 7. Write scripts/validate.py — the data completeness checker                                       
 8. Create one fully worked example (Iraq 2003, territorial control) to validate the pipeline       
 end-to-end                                                                                         
                                                                                                    
 Verification                                                                                       
                                                                                                    
 - Run scaffold → confirm 700 files created with correct structure                                  
 - Manually fill one example file (Iraq/political/territorial_control, year 2003)                   
 - Run generate_scores → confirm it produces a score for Iraq 2003 political.territorial_control    
 - Change the scoring rubric → regenerate → confirm score changes                                   
 - Change aggregation weights → regenerate → confirm dimension score changes                        
 - Run validate → confirm it reports completeness correctly   