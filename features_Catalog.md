┌─────────────────────────────────────────────────────────────────┐
│                    LAP ANALYSIS (10+ features)                  │
├─────────────────────────────────────────────────────────────────┤
│  • Lap time (formatted + seconds)                               │
│  • Sector times (S1, S2, S3)                                    │
│  • Lap quality score (0-100)                                    │
│  • Valid lap flag                                               │
│  • Deleted lap flag                                             │
│  • Deletion reason                                              │
│  • Track status during lap                                      │
│  • Personal best lap                                            │
│  • Session best lap                                            │
│  • Lap delta to leader                                          │
│  • Tyre compound on lap                                         │
│  • Tyre age on lap                                              │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  DRIVER PERFORMANCE (15+ features)              │
├─────────────────────────────────────────────────────────────────┤
│  • Fastest lap time (session)                                   │
│  • Average lap time                                             │
│  • Lap time standard deviation                                  │
│  • Position progression                                         │
│  • Laps led                                                    
│  • Overtakes made                                               │
│  • Defensive actions                                            │
│  • Head-to-head pace delta                                      │
│  • Tyre management score                                        │
│  • Consistency score                                            │
│  • Peak performance lap                                         │
│  • Longest stint                                                │
│  • Pit stop efficiency                                          │
│  • Start position vs finish position                            │
│  • Points contributed                                           │
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
│  • Tyre switch direction (supersoft→hard)                       │
│  • Tyre temperature estimate                                    │
│  • Grip level indicator                                         │
│  • Tyre strategy (1-stop, 2-stop, etc)                          │
│  • Predicted tyre performance                                   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  TELEMETRY ANALYSIS (15+ features)              │
├─────────────────────────────────────────────────────────────────┤
│  • Max speed                                                    │
│  • Average speed                                                │
│  • Speed at specific corners                                    │
│  • Throttle application %                                       │
│  • Throttle trace (time series)                                 │
│  • Brake application %                                          │
│  • Brake trace (time series)                                    │
│  • Gear shift points                                            │
│  • Gear distribution                                            │
│  • Cornering speed comparison                                   │
│  • DRS usage (if available)                                     │
│  • Throttle-brake correlation                                   │
│  • Speed trace (time series)                                    │
│  • Position trace (time series)                                 │
│  • Mini-sector times                                            │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  RACE CONTEXT (10+ features)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Track status (green/yellow/red/VSC/SC)                       │
│  • Number of yellow flag periods                                │
│  • Number of red flag periods                                   │
│  • Safety car deployments                                       │
│  • VSC deployments                                              │
│  • Virtual safety car periods                                   │
│  • Race control incidents count                                 │
│  • Weather conditions                                           │
│  • Air temperature                                              │
│  • Track temperature                                            │
│  • Wind speed/direction                                         │
│  • Humidity                                                     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                   STRATEGIC ANALYSIS (8+ features)              │
├─────────────────────────────────────────────────────────────────┤
│  • Race strategy simulation                                     │
│  • Predicted finish time                                        │
│  • Undercut probability                                         │
│  • Overcut probability                                          │
│  • Optimal tyre window                                          │
│  • Track position impact                                        │
│  • Traffic impact                                               │
│  • Tow effect (drag reduction)                                  │
│  • tyre offset delta                                            │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                   COMPARISON FEATURES (10+ features)            │
├─────────────────────────────────────────────────────────────────┤
│  • Head-to-head lap times                                       │
│  • Sector-by-sector comparison                                  │
│  • Pace delta                                                   │
│  • Tyre management comparison                                   │
│  • Speed trap comparison                                        │
│  • Qualifying pace comparison                                   │
│  • Race pace comparison                                         │
│  • Tire degradation comparison                                  │
│  • Max speed comparison                                         │
│  •一致性 comparison (who is more consistent)                    │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     TOTAL: ~80+ FEATURES                        │
└─────────────────────────────────────────────────────────────────┘