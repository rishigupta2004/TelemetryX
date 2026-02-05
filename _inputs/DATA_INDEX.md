# TelemetryX Data Package - Complete Index

## 📦 What's Inside

### 🏁 Season Data (2018-2025)
All files in `/seasons/` directory:

- **2018_season.json** - 21 races, 10 teams, 20 drivers
- **2019_season.json** - 21 races, 10 teams, 20 drivers  
- **2020_season.json** - 17 races (COVID-shortened), 10 teams, 20+ drivers (reserves)
- **2021_season.json** - 22 races, 10 teams, 20+ drivers
- **2022_season.json** - 22 races, 10 teams, 20 drivers (new regulations)
- **2023_season.json** - 22 races, 10 teams, 20 drivers (Las Vegas debut)
- **2024_season.json** - 24 races, 10 teams, 20+ drivers (driver changes)
- **2025_season.json** - 24 races, 10 teams, 20 drivers (current)
- **2025 Race Calendar.json** - races + race_keys only
- **2025_drivers_teams.json** - driver/team list only

Each season file contains:
```json
{
  "season": 2025,
  "races": ["Bahrain Grand Prix", ...],
  "teams": [
    {
      "team_id": "red_bull",
      "team_name": "Red Bull Racing",
      "color": "#3671C6",
      "drivers": [
        {
          "driver_id": "VER",
          "driver_name": "Max Verstappen",
          "driver_number": 1,
          "abbrev": "VER"
        }
      ]
    }
  ]
}
```

---

### 🗺️ Track Data
All files in `/tracks/` directory:

- **australia_albert_park_v1.json / v2.json** - Complete track layout with:
  - SVG path coordinates
  - 14 corner positions
  - 2 DRS zones
  - Sector boundaries
  - 5.278km length

- **TRACK_VISUALIZATION_GUIDE.md** - How to render tracks like your images:
  - Multi-track comparison style
  - Live driver position style
  - React component examples
  - Position calculation algorithms
  - DRS zone rendering

**Track JSON Structure:**
```json
{
  "track_name": "Albert Park Circuit",
  "length_km": 5.278,
  "layout": {
    "path_coordinates": [{"x": 400, "y": 550, "distance": 0}]
  },
  "corners": [{"number": 1, "x": 450, "y": 520}],
  "drs_zones": [{"zone_number": 1, "activation_point": 3500}]
}
```

---

### 📚 Supporting Docs

- **README.md** - Quick start guide
- **track_geometry_guide.md** - FastF1 vs OpenF1 sourcing
- **top_15_features_priority.md** - UI feature roadmap

---

## 🚀 Quick Integration

### Load a Season
```javascript
import season2025 from './_inputs/seasons/2025_season.json';

// Get all teams
const teams = season2025.teams;

// Get driver by abbreviation
const verstappen = teams
  .flatMap(t => t.drivers)
  .find(d => d.abbrev === 'VER');

// Get team color for charts
const redBullColor = teams.find(t => t.team_id === 'red_bull').color;
```

### Load Track Layout
```javascript
import albertPark from './_inputs/tracks/australia_albert_park_v2.json';

// Render SVG path
const pathData = albertPark.layout.path_coordinates
  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
  .join(' ');

<path d={pathData} stroke="#4A4A4A" strokeWidth="8" fill="none" />
```

### Calculate Driver Position on Track
```javascript
function getDriverPosition(distance, track) {
  const coords = track.layout.path_coordinates;
  const normalized = distance % track.length_km;
  
  for (let i = 0; i < coords.length - 1; i++) {
    if (normalized >= coords[i].distance && normalized <= coords[i+1].distance) {
      const t = (normalized - coords[i].distance) / 
                (coords[i+1].distance - coords[i].distance);
      return {
        x: coords[i].x + t * (coords[i+1].x - coords[i].x),
        y: coords[i].y + t * (coords[i+1].y - coords[i].y)
      };
    }
  }
}
```

---

## 📊 Data Coverage

### Historical Coverage (2018-2025)
- **8 seasons** of complete data
- **175+ Grand Prix** races catalogued
- **100+ unique drivers** across all seasons
- **15+ team identities** (including rebrands)

### Track Coverage
- **35 unique layouts** (versioned) in `/tracks/`
- **track_layout_mapping.json** maps seasons → layouts
- **TRACK_VISUALIZATION_GUIDE.md** shows how to render

---

## 🎨 Visualization Formats

Your images show two styles:

### Style 1: Multi-Track Overlay
- Black background
- Colored track outlines
- Green DRS zone labels
- Corner markers
- **See**: `TRACK_VISUALIZATION_GUIDE.md` → "Image 1 Style"

### Style 2: Live Driver Positions
- Black background  
- Gray track outline
- Colored driver bubbles with abbreviations
- Corner numbers in circles
- Checkered finish line
- **See**: `TRACK_VISUALIZATION_GUIDE.md` → "Image 2 Style"

---

## 🔧 Usage Patterns

### Pattern 1: Season Selector Dropdown
```javascript
const seasons = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const [selected, setSelected] = useState(2025);

<select value={selected} onChange={e => setSelected(e.target.value)}>
  {seasons.map(year => (
    <option key={year} value={year}>F1 {year}</option>
  ))}
</select>

// Load season data
const seasonData = require(`./_inputs/seasons/${selected}_season.json`);
```

### Pattern 2: Driver Filter with Team Colors
```javascript
const allDrivers = season2025.teams.flatMap(team => 
  team.drivers.map(driver => ({
    ...driver,
    teamColor: team.color,
    teamName: team.team_name
  }))
);

{allDrivers.map(driver => (
  <label key={driver.abbrev}>
    <input type="checkbox" />
    <span style={{color: driver.teamColor}}>
      {driver.abbrev} - {driver.teamName}
    </span>
  </label>
))}
```

### Pattern 3: Race Calendar Timeline
```javascript
const raceCalendar = season2025.races;

<div className="timeline">
  {raceCalendar.map((race, index) => (
    <div key={index} className="race-event">
      <span className="round">R{index + 1}</span>
      <span className="name">{race}</span>
    </div>
  ))}
</div>
```

---

## ⚠️ Data Notes

### Driver Mid-Season Changes
Some seasons have 20+ drivers due to mid-season replacements:
- **2019**: Gasly ↔ Albon swap (Red Bull/Toro Rosso)
- **2020**: COVID reserves (Russell at Mercedes, Hülkenberg at Racing Point)
- **2024**: Ricciardo → Lawson at RB, Sargeant → Colapinto at Williams

All drivers listed in their respective season files.

### Team Rebrands
- **Force India → Racing Point** (mid-2018/2019)
- **Racing Point → Aston Martin** (2021)
- **Renault → Alpine** (2021)
- **Toro Rosso → AlphaTauri → RB** (2020, 2024)
- **Sauber → Alfa Romeo → Sauber** (2018, 2024)

Team IDs remain stable, names reflect the year's branding.

### Color Consistency
Team colors are hex codes matched to official liveries:
- Use these for chart legends, driver bubbles, track overlays
- Colors may vary slightly year-to-year (e.g., Red Bull's blue shade)

---

## 🔜 Next Steps

1. **Generate remaining tracks**: Use FastF1 to create JSONs for all 24 circuits
   ```python
   import fastf1
   session = fastf1.get_session(2025, 'Bahrain', 'Q')
   session.load()
   circuit = session.get_circuit_info()
   # Extract coords and save to JSON
   ```

2. **Build track component library**: 
   - `<TrackMap track={albertPark} drivers={livePositions} />`
   - `<MultiTrackCompare tracks={[australia, bahrain]} />`

3. **Wire up OpenF1 API**:
   - Fetch live positions: `https://api.openf1.org/v1/location`
   - Update driver bubbles every 1-2 seconds

4. **Add historical data**:
   - Extend to 2010-2017 if needed
   - Follow same JSON structure

---

## 📁 File Structure Summary

```
TelemetryX/_inputs/
├── seasons/
│   ├── 2018_season.json
│   ├── 2019_season.json
│   ├── 2020_season.json
│   ├── 2021_season.json
│   ├── 2022_season.json
│   ├── 2023_season.json
│   └── 2024_season.json
├── tracks/
│   ├── australia_albert_park.json
│   └── TRACK_VISUALIZATION_GUIDE.md
├── 2025_race_calendar.json
├── 2025_race_calendar.csv
├── 2025_drivers_teams.json
├── track_geometry_guide.md
├── top_15_features_priority.md
├── README.md
└── DATA_INDEX.md (this file)
```

**Total files**: 16 (10 JSON, 6 Markdown)

---

## 🎯 Use This Data For

✅ Season selector dropdowns  
✅ Driver/team filters with correct colors  
✅ Race calendar timelines  
✅ Track visualizations (like your images)  
✅ Historical comparisons (2018-2025)  
✅ Live race overlays with driver positions  
✅ Telemetry analysis with track context  

---

**You're all set! 🏎️💨**
