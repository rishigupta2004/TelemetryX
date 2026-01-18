// F1 Official Colors
export const F1_COLORS = {
  primary: '#e10600',
  primaryLight: '#ff4d4d',
  secondary: '#1c1c1e',
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceHover: '#242424',
};

// Status Colors
export const STATUS_COLORS = {
  green: '#34c759',
  yellow: '#ffcc00',
  red: '#ff3b30',
  orange: '#ff9500',
};

// Tyre Compound Colors (Official F1 Standards)
export const TYRE_COLORS = {
  SOFT: '#ff3333',       // Red
  MEDIUM: '#f2f520',     // Yellow
  HARD: '#ffffff',       // White
  INTERMEDIATE: '#43d13e', // Green
  WET: '#0066ff',        // Blue
};

// Track Status Colors
export const TRACK_STATUS_COLORS = {
  GREEN: '#34c759',
  YELLOW: '#ffcc00',
  RED: '#ff3b30',
  SC: '#ff9500',         // Safety Car
  VSC: '#af52de',        // Virtual Safety Car
  FLAGS: '#0066ff',
};

// Team Colors (Official 2024)
export const TEAM_COLORS: Record<string, string> = {
  'Ferrari': '#e8002d',
  'Mercedes': '#00d2be',
  'Red Bull Racing': '#1e41ff',
  'McLaren': '#ff8000',
  'Aston Martin': '#006e62',
  'Alpine': '#0093cc',
  'Williams': '#64c4ff',
  'RB': '#6692ff',
  'Sauber': '#52e252',
  'Haas': '#b6babd',
  'Lotus': '#ffb800',
  'Renault': '#ffd900',
  'Force India': '#652d87',
  'Spyker': '#ff6600',
  'Minardi': '#2b9dbf',
  'Jordan': '#ffed00',
  'BAR': '#004393',
  'Jaguar': '#df0000',
  'Prost': '#003399',
};

// Session Types
export const SESSION_TYPES = {
  R: { name: 'Race', color: '#e10600' },
  Q: { name: 'Qualifying', color: '#0066ff' },
  S: { name: 'Sprint', color: '#00d2be' },
  SS: { name: 'Sprint Shootout', color: '#ff9500' },
};

// Playback Speeds
export const PLAYBACK_SPEEDS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
];

// Cluster Labels
export const CLUSTER_LABELS = {
  'The Elite': { color: '#ffd700', description: 'Championship contenders' },
  'The Winner': { color: '#c0c0c0', description: 'Race winners' },
  'Podium Hunter': { color: '#cd7f32', description: 'Podium regulars' },
  'Sunday Specialist': { color: '#34c759', description: 'Strong race pace' },
  'The Qualifier': { color: '#0066ff', description: 'Qualifying specialists' },
  'Mr. Consistent': { color: '#af52de', description: 'Reliable points scorer' },
  'Midfield Runner': { color: '#8e8e93', description: 'Midfield competitors' },
};
