import { useState, useEffect, useCallback, useRef } from 'react';

interface TelemetryData {
  speed: number[];
  throttle: number[];
  brake: number[];
  timestamp?: number[];
  distance?: number[];
  isLoading: boolean;
  error: string | null;
}

interface UseTelemetryDataParams {
  year: number;
  round: number;
  driverCode: string;
  lapNumber: number;
}

export function useTelemetryData({
  year,
  round,
  driverCode,
  lapNumber,
}: UseTelemetryDataParams): TelemetryData {
  const [data, setData] = useState<TelemetryData>({
    speed: [],
    throttle: [],
    brake: [],
    isLoading: true,
    error: null,
  });

  const mounted = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!year || !round || !driverCode || !lapNumber) {
      if (mounted.current) {
        setData({
          speed: [],
          throttle: [],
          brake: [],
          isLoading: false,
          error: 'Missing required parameters',
        });
      }
      return;
    }

    if (mounted.current) {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      // Format round to match backend expectations (replace spaces with hyphens if needed)
      const formattedRound = String(round).replace(/\s+/g, '-');
      
      // Use environment variable for API base URL if set, otherwise use relative URL
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const url = `${baseUrl}/api/telemetry/${year}/${formattedRound}/${driverCode}/laps/${lapNumber}`;
      
      // Try the lap-specific endpoint first
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch telemetry data: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid data format received from API');
      }

      // Extract arrays for charting
      const speed: number[] = [];
      const throttle: number[] = [];
      const brake: number[] = [];
      const timestamp: number[] = [];

      result.data.forEach((point: any) => {
        if (point.speed !== undefined) speed.push(Number(point.speed));
        if (point.throttle !== undefined) throttle.push(Number(point.throttle));
        if (point.brake !== undefined) brake.push(Number(point.brake));
        if (point.time_ms !== undefined) timestamp.push(Number(point.time_ms));
      });

      if (mounted.current) {
        setData({
          speed,
          throttle,
          brake,
          timestamp,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      if (mounted.current) {
        console.error('Error fetching telemetry data:', err);
        setData({
          speed: [],
          throttle: [],
          brake: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        });
      }
    }
  }, [year, round, driverCode, lapNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}