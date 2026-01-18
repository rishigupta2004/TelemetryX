┌─────────────────────────────────────────────────────────────────┐
│                    LAP ANALYSIS (10+ features)                  │
├─────────────────────────────────────────────────────────────────┤
│  • Lap time (formatted + seconds)                               │
│  • Sector times (S1, S2, S3)                                    │
│  • Lap quality score (0-100)                                    │
│  • Valid lap flag                                               │
│  • Deleted lap flag                                             │
│  • Track status during lap                                      │
│  • Lap delta to leader                                          │
│  • Tyre compound on lap                                         │
│  • Tyre age on lap                                              │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                 DRIVER PERFORMANCE (20+ features)               │
├─────────────────────────────────────────────────────────────────┤
│  QUALIFYING (Per driver all-time):                              │
│  • Average qualifying position                                  │
│  • Best qualifying position                                     │
│  • Qualifying standard deviation                               │
│  • Qualifying variance (consistency)                           │
│  • Q1 appearances (P1-P10)                                     │
│  • Q2 appearances (P11-P15)                                    │
│  • Q3 appearances (P16-P20)                                    │
│  • Pole positions                                               │
│  • Front row starts (P1-P2)                                    │
│                                                                  │
│  RACE PERFORMANCE (Per driver all-time):                        │
│  • Average finish position                                      │
│  • Best finish position                                         │
│  • Finish standard deviation                                    │
│  • Win count / win rate                                         │
│  • Podium count / podium rate                                   │
│  • Points finishes count / rate                                 │
│  • DNF count / DNF rate                                         │
│  • Position change average (start vs finish)                    │
│                                                                  │
│  CLUSTER LABELS:                                                │
│  • The Elite (win rate > 20%)                                   │
│  • The Winner (win rate 5-20%)                                  │
│  • Podium Hunter (podium rate > 15%)                            │
│  • Sunday Specialist (good race pace, lower quali)              │
│  • The Qualifier (strong quali, average race)                   │
│  • Mr. Consistent (low variance, top 10)                        │
│  • Midfield Runner                                              │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                    TYRE ANALYSIS (12+ features)                 │
├─────────────────────────────────────────────────────────────────┤
│  • Current tyre compound                                        │
│  • Tyre age (laps on tyre)                                      │
│  • Stint number                                                 │
│  • Tyre degradation rate                                        │
│  • Tyre life remaining                                          │
│  • Optimal pit window                                           │
│  • Tyre change history                                          │
│  • Tyre temperature estimate                                    │
│  • Grip level indicator                                         │
│  • Tyre strategy sequence (e.g., SOFT→MEDIUM→HARD)              │
│  • Traffic density                                              │
│  • Position during stint                                        │
│  • Overtake laps count                                          │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  TELEMETRY ANALYSIS (10+ features)              │
├─────────────────────────────────────────────────────────────────┤
│  • Max speed                                                    │
│  • Average speed                                                │
│  • Throttle application %                                       │
│  • Brake application %                                          │
│  • Brake frequency                                              │
│  • DRS activations                                              │
│  • Max RPM                                                      │
│  • Throttle-brake correlation                                   │
│  • Gear shifts                                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  RACE CONTEXT (10+ features)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Track status (green/yellow/red/VSC/SC)                       │
│  • Yellow flag periods                                          │
│  • Red flag periods                                             │
│  • Safety car deployments                                       │
│  • VSC deployments                                              │
│  • Weather conditions (RAIN/HOT/WINDY/DRY)                      │
│  • Air temperature                                              │
│  • Track temperature                                            │
│  • Humidity                                                     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                   STRATEGIC ANALYSIS (8+ features)              │
├─────────────────────────────────────────────────────────────────┤
│  UNDERCUT PREDICTION MODEL:                                     │
│  • Undercut success probability                                 │
│  • Key factors: position, tyre age, stint length, compound      │
│  • Track stress factor                                          │
│  • Pit lap timing                                               │
│  • Recommendations based on conditions                          │
│                                                                  │
│  RACE STRATEGY ANALYSIS:                                        │
│  • Common compound sequences                                    │
│  • Average stint lengths                                        │
│  • Pit stop patterns                                            │
│  • Winning strategies                                           │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                   COMPARISON FEATURES (10+ features)            │
├─────────────────────────────────────────────────────────────────┤
│  • Head-to-head lap times                                       │
│  • Pace delta between drivers                                   │
│  • Team comparisons                                             │
│  • Qualifying vs race pace comparison                           │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     TOTAL: ~80+ FEATURES                        │
├─────────────────────────────────────────────────────────────────┤
│  MODELS:                                                        │
│  • Driver Clustering (Performance-based)                        │
│  • Undercut Prediction (XGBoost/RF)                             │
│  • Race Strategy Analysis (Descriptive)                         │
└─────────────────────────────────────────────────────────────────┘
