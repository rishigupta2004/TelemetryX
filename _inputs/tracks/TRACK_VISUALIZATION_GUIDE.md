# Track Visualization Guide - Matching Your Images

## Overview
This guide explains how to render F1 tracks like the examples you provided:
1. **Image 1**: Multi-track comparison view showing multiple circuit layouts with DRS zones
2. **Image 2**: Single track view with live driver positions and corner numbers

---

## Image 1 Style: Multi-Track Comparison

### Visual Elements:
- Multiple track outlines in different colors
- Green labels for DRS zones ("DRS DETECTION" / "DRS ZONE")
- Pink/magenta labels for special zones ("TURN NOW")
- Black background
- Thin track lines (~2-3px)
- Corner markers as small circles

### Implementation:
```javascript
// SVG-based rendering
<svg viewBox="0 0 800 600" style="background: black">
  {tracks.map(track => (
    <g key={track.id}>
      {/* Track path */}
      <path
        d={generatePathFromCoordinates(track.layout.path_coordinates)}
        stroke={track.color}
        strokeWidth="3"
        fill="none"
      />
      
      {/* DRS zones */}
      {track.drs_zones.map(zone => (
        <rect
          x={zone.x}
          y={zone.y}
          width="60"
          height="20"
          fill="#00FF00"
          rx="3"
        />
      ))}
      
      {/* Corner markers */}
      {track.corners.map(corner => (
        <circle
          cx={corner.x}
          cy={corner.y}
          r="4"
          fill={track.color}
        />
      ))}
    </g>
  ))}
</svg>
```

---

## Image 2 Style: Live Driver Positions

### Visual Elements:
- Gray track outline (medium thickness ~6-8px)
- Colored driver bubbles positioned on track
- 3-letter driver abbreviations in bubbles
- Corner numbers in gray circles
- Finish line (checkered pattern)
- Black background
- Clean, modern aesthetic

### Driver Bubble Colors:
Match team colors from season JSON files:
- Red Bull: `#3671C6` (blue)
- Ferrari: `#E8002D` (red)
- McLaren: `#FF8000` (orange)
- Mercedes: `#27F4D2` (cyan)
- Alpine: `#FF87BC` (pink)
- Aston Martin: `#229971` (green)
- etc.

### Implementation:
```javascript
<svg viewBox="0 0 800 600" style="background: black">
  {/* Track base */}
  <path
    d={track.path}
    stroke="#4A4A4A"
    strokeWidth="8"
    fill="none"
    strokeLinecap="round"
  />
  
  {/* Corner numbers */}
  {track.corners.map(corner => (
    <g key={corner.number}>
      <circle cx={corner.x} cy={corner.y} r="15" fill="#2A2A2A" />
      <text
        x={corner.x}
        y={corner.y + 5}
        fill="white"
        fontSize="12"
        textAnchor="middle"
      >
        {corner.number}
      </text>
    </g>
  ))}
  
  {/* Driver positions */}
  {livePositions.map(driver => {
    const pos = calculateTrackPosition(driver.distance, track);
    return (
      <g key={driver.abbrev}>
        <circle
          cx={pos.x}
          cy={pos.y}
          r="18"
          fill={driver.teamColor}
        />
        <text
          x={pos.x}
          y={pos.y + 5}
          fill="white"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
        >
          {driver.abbrev}
        </text>
      </g>
    );
  })}
  
  {/* Finish line */}
  <g>
    <rect x="395" y="545" width="10" height="15" fill="white" />
    <rect x="395" y="545" width="5" height="7.5" fill="black" />
    <rect x="400" y="552.5" width="5" height="7.5" fill="black" />
  </g>
</svg>
```

---

## Track Data Structure

Each track JSON contains:

```json
{
  "track_name": "Albert Park Circuit",
  "circuit_key": "australia",
  "length_km": 5.278,
  "layout": {
    "svg_viewbox": "0 0 800 600",
    "path_coordinates": [
      {"x": 400, "y": 550, "distance": 0, "sector": 1},
      // ... more points
    ]
  },
  "corners": [
    {"number": 1, "x": 450, "y": 520, "distance": 250}
  ],
  "drs_zones": [
    {"zone_number": 1, "activation_point": 3500, "end_point": 250}
  ]
}
```

---

## Position Calculation

To place drivers on track based on distance traveled:

```javascript
function calculateTrackPosition(distance, track) {
  // Normalize distance to track length
  const normalizedDist = distance % track.length_km;
  
  // Find surrounding path points
  const coords = track.layout.path_coordinates;
  for (let i = 0; i < coords.length - 1; i++) {
    if (normalizedDist >= coords[i].distance && 
        normalizedDist <= coords[i + 1].distance) {
      
      // Linear interpolation between points
      const t = (normalizedDist - coords[i].distance) / 
                (coords[i + 1].distance - coords[i].distance);
      
      return {
        x: coords[i].x + t * (coords[i + 1].x - coords[i].x),
        y: coords[i].y + t * (coords[i + 1].y - coords[i].y)
      };
    }
  }
}
```

---

## DRS Zone Rendering

```javascript
function renderDRSZones(track) {
  return track.drs_zones.map(zone => {
    // Get start/end coordinates
    const start = getCoordinatesAtDistance(zone.activation_point);
    const end = getCoordinatesAtDistance(zone.end_point);
    
    return (
      <g key={zone.zone_number}>
        {/* Highlight track section */}
        <path
          d={getPathBetween(start, end)}
          stroke="#00FF00"
          strokeWidth="10"
          opacity="0.3"
        />
        
        {/* Label */}
        <rect
          x={start.x - 30}
          y={start.y - 40}
          width="80"
          height="25"
          fill="#00FF00"
          rx="4"
        />
        <text
          x={start.x}
          y={start.y - 22}
          fill="black"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
        >
          DRS ZONE {zone.zone_number}
        </text>
      </g>
    );
  });
}
```

---

## Color Schemes

### Image 1 (Multi-track):
- Background: `#000000`
- Track 1: `#8B0000` (dark red/maroon)
- Track 2: `#1E3A8A` (navy blue)
- DRS labels: `#00FF00` (bright green)
- Special labels: `#FF1493` (hot pink)

### Image 2 (Live positions):
- Background: `#000000`
- Track: `#4A4A4A` (medium gray)
- Corner circles: `#2A2A2A` (dark gray)
- Driver bubbles: Team colors (see season JSONs)
- Text: `#FFFFFF` (white)

---

## React Component Example

```jsx
import React from 'react';
import trackData from './tracks/australia_albert_park.json';
import seasonData from './seasons/2025_season.json';

function TrackMap({ livePositions }) {
  return (
    <svg
      viewBox={trackData.layout.svg_viewbox}
      className="w-full h-full bg-black rounded-lg"
    >
      {/* Track outline */}
      <TrackPath coordinates={trackData.layout.path_coordinates} />
      
      {/* Corner numbers */}
      {trackData.corners.map(corner => (
        <CornerMarker key={corner.number} corner={corner} />
      ))}
      
      {/* DRS zones */}
      {trackData.drs_zones.map(zone => (
        <DRSZone key={zone.zone_number} zone={zone} track={trackData} />
      ))}
      
      {/* Driver positions */}
      {livePositions.map(driver => {
        const team = findTeamByDriver(driver.abbrev, seasonData);
        const pos = calculateTrackPosition(driver.distance, trackData);
        
        return (
          <DriverBubble
            key={driver.abbrev}
            x={pos.x}
            y={pos.y}
            abbrev={driver.abbrev}
            color={team.color}
          />
        );
      })}
      
      {/* Finish line */}
      <FinishLine x={400} y={550} />
    </svg>
  );
}
```

---

## Performance Tips

1. **Memoize path calculations**: Cache SVG path strings
2. **Use CSS transforms**: For driver position updates instead of re-rendering
3. **Request animation frame**: For smooth 60fps updates during live sessions
4. **Canvas fallback**: For 20+ drivers, consider Canvas API over SVG
5. **Path simplification**: Reduce path points for zoom-out views

---

## Animation

Smooth driver movement:

```javascript
const [driverPositions, setDriverPositions] = useState([]);

useEffect(() => {
  const interval = setInterval(() => {
    // Fetch from OpenF1 /location endpoint
    fetch(`https://api.openf1.org/v1/location?session_key=${sessionKey}`)
      .then(res => res.json())
      .then(data => {
        setDriverPositions(data.map(d => ({
          abbrev: getDriverAbbrev(d.driver_number),
          distance: d.distance,
          teamColor: getTeamColor(d.driver_number)
        })));
      });
  }, 1000); // Update every second
  
  return () => clearInterval(interval);
}, [sessionKey]);
```

---

## Next Steps

1. Create track JSONs for all 24 circuits (use FastF1 to extract coordinates)
2. Build reusable `<TrackMap>` React component
3. Integrate with OpenF1 live location API
4. Add zoom/pan controls for detailed views
5. Implement speed heatmap overlay (gradient on track path)
6. Add mini-map for full-screen telemetry view
