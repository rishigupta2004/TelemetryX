import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimingRow {
  position: number;
  driverNumber: number;
  driverCode: string;
  driverName: string;
  teamColor: string;
  gap: string;
  interval: string;
  lastLap: string;
  bestLap: string;
  tyreCompound: string;
  sector1: string | null;
  sector2: string | null;
  sector3: string | null;
  s1Color: 'purple' | 'green' | 'yellow' | 'white';
  s2Color: 'purple' | 'green' | 'yellow' | 'white';
  s3Color: 'purple' | 'green' | 'yellow' | 'white';
  currentLap: number;
  lapsCompleted: number;
}

export interface UseTimingDataResult {
  rows: TimingRow[];
  status: 'loading' | 'ready' | 'empty' | 'error';
  error: string | null;
}

interface LapData {
  driver_number: number;
  driver_name: string;
  lap_number: number;
  lap_time_seconds: number | null;
  lap_time_formatted: string | null;
  position: number | null;
  tyre_compound: string | null;
  sector1_sessiontime?: string | null;
  sector2_sessiontime?: string | null;
  sector3_sessiontime?: string | null;
}

const DRIVER_CODE_MAP: Record<number, string> = {
  1: 'VER', 11: 'PER', 16: 'LEC', 55: 'SAI', 44: 'HAM',
  63: 'RUS', 4: 'NOR', 3: 'RIC', 14: 'ALO', 22: 'TSU',
  31: 'OCO', 18: 'STR', 23: 'ALB', 2: 'SAR', 77: 'BOT',
  20: 'MAG', 24: 'ZHO', 27: 'HUL', 88: 'NISS', 45: 'LAW',
  21: 'DRIC', 34: 'COL', 41: 'SCH', 43: 'DOO', 50: 'BRO',
  81: 'PIA', 61: 'UUR', 10: 'PIE', 6: 'LAT', 35: 'RAI'
};

const TEAM_COLOR_MAP: Record<string, string> = {
  'Red Bull Racing': '#005aff',
  'Ferrari': '#dc0000',
  'Mercedes': '#00d2be',
  'McLaren': '#ff8000',
  'Aston Martin': '#006f62',
  'Alpine': '#ff87dc',
  'Williams': '#64c4ff',
  'AlphaTauri': '#6692ff',
  'Alfa Romeo': '#b12039',
  'Haas F1 Team': '#b6b6b6',
  'RB': '#6692ff',
  'Kick Sauber': '#b12039'
};

function getDriverCode(driverNumber: number, driverName?: string): string {
  if (DRIVER_CODE_MAP[driverNumber]) return DRIVER_CODE_MAP[driverNumber];
  if (driverName) return driverName.substring(0, 3).toUpperCase();
  return '???';
}

function getTeamColor(driverName?: string): string {
  if (!driverName) return '#666666';
  for (const [team, color] of Object.entries(TEAM_COLOR_MAP)) {
    if (driverName.toLowerCase().includes(team.toLowerCase())) {
      return color;
    }
  }
  return '#666666';
}

function formatLapTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec;
}

function getSectorColor(sector: string | null | undefined, best: number): 'purple' | 'green' | 'yellow' | 'white' {
  if (!sector) return 'white';
  const sectorNum = parseFloat(sector);
  if (!isFinite(sectorNum)) return 'white';
  if (best === 0 || sectorNum <= best + 0.005) return 'purple';
  if (sectorNum <= best * 1.02) return 'green';
  return 'yellow';
}

const DEFAULT_YEAR = 2024;
const DEFAULT_ROUND = 'bahrain';
const DEFAULT_SESSION = 'R';

export function useTimingData(
  year: number = DEFAULT_YEAR,
  round: string = DEFAULT_ROUND,
  session: string = DEFAULT_SESSION
): UseTimingDataResult {
  const [rows, setRows] = useState<TimingRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchTimingData = useCallback(async () => {
    if (mounted.current) {
      setStatus('loading');
      setError(null);
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const url = `${baseUrl}/api/v1/sessions/${year}/${round}/${session}/laps`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch timing data: ${response.statusText}`);
      }

      const lapsData: LapData[] = await response.json();

      if (!lapsData || !Array.isArray(lapsData) || lapsData.length === 0) {
        if (mounted.current) {
          setRows([]);
          setStatus('empty');
        }
        return;
      }

      const driversMap = new Map<number, {
        laps: LapData[];
        driverNumber: number;
        driverName: string;
        code: string;
        teamColor: string;
      }>();

      for (const lap of lapsData) {
        const driverNumber = lap.driver_number;
        if (!driversMap.has(driverNumber)) {
          driversMap.set(driverNumber, {
            laps: [],
            driverNumber,
            driverName: lap.driver_name || '',
            code: getDriverCode(driverNumber, lap.driver_name),
            teamColor: getTeamColor(lap.driver_name)
          });
        }
        driversMap.get(driverNumber)!.laps.push(lap);
      }

      const processedRows: TimingRow[] = [];
      let sessionBestS1 = Infinity;
      let sessionBestS2 = Infinity;
      let sessionBestS3 = Infinity;

      for (const [, driver] of driversMap) {
        const laps = driver.laps.sort((a, b) => b.lap_number - a.lap_number);
        
        let bestS1 = Infinity, bestS2 = Infinity, bestS3 = Infinity;
        let bestLapTime = Infinity;
        let lastLap = '—';
        
        for (const lap of laps) {
          if (lap.sector1_sessiontime) {
            const s1 = parseFloat(lap.sector1_sessiontime);
            if (isFinite(s1) && s1 > 0) bestS1 = Math.min(bestS1, s1);
          }
          if (lap.sector2_sessiontime) {
            const s2 = parseFloat(lap.sector2_sessiontime);
            if (isFinite(s2) && s2 > 0) bestS2 = Math.min(bestS2, s2);
          }
          if (lap.sector3_sessiontime) {
            const s3 = parseFloat(lap.sector3_sessiontime);
            if (isFinite(s3) && s3 > 0) bestS3 = Math.min(bestS3, s3);
          }
          if (lap.lap_time_seconds && lap.lap_time_seconds > 0) {
            bestLapTime = Math.min(bestLapTime, lap.lap_time_seconds);
            lastLap = formatLapTime(lap.lap_time_seconds);
          }
        }

        const latestLap = laps[0];
        const currentPosition = latestLap?.position || processedRows.length + 1;
        const lapsCompleted = latestLap?.lap_number || 0;

        sessionBestS1 = Math.min(sessionBestS1, bestS1);
        sessionBestS2 = Math.min(sessionBestS2, bestS2);
        sessionBestS3 = Math.min(sessionBestS3, bestS3);

        processedRows.push({
          position: currentPosition,
          driverNumber: driver.driverNumber,
          driverCode: driver.code,
          driverName: driver.driverName,
          teamColor: driver.teamColor,
          gap: currentPosition === 1 ? 'Leader' : `+${(currentPosition - 1) * 0.5}s`,
          interval: '—',
          lastLap: lastLap,
          bestLap: bestLapTime < Infinity ? formatLapTime(bestLapTime) : '—',
          tyreCompound: latestLap?. tyre_compound?.charAt(0) || '—',
          s1Color: getSectorColor(latestLap?.sector1_sessiontime, bestS1),
          s2Color: getSectorColor(latestLap?.sector2_sessiontime, bestS2),
          s3Color: getSectorColor(latestLap?.sector3_sessiontime, bestS3),
          sector1: latestLap?.sector1_sessiontime || null,
          sector2: latestLap?.sector2_sessiontime || null,
          sector3: latestLap?.sector3_sessiontime || null,
          currentLap: lapsCompleted,
          lapsCompleted
        });
      }

      processedRows.sort((a, b) => a.position - b.position);

      if (processedRows.length > 0) {
        processedRows[0].gap = 'Leader';
        for (let i = 1; i < processedRows.length; i++) {
          const gapToLeader = (processedRows[i].position - processedRows[i - 1].position) * 0.5;
          processedRows[i].gap = gapToLeader < 1 ? `+${(gapToLeader).toFixed(1)}s` : `+${gapToLeader.toFixed(1)}s`;
        }
      }

      if (mounted.current) {
        setRows(processedRows.slice(0, 20));
        setStatus('ready');
      }
    } catch (err) {
      if (mounted.current) {
        console.error('Error fetching timing data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
        setRows([]);
      }
    }
  }, [year, round, session]);

  useEffect(() => {
    fetchTimingData();
    
    const interval = setInterval(fetchTimingData, 5000);
    return () => clearInterval(interval);
  }, [fetchTimingData]);

  return { rows, status, error };
}
