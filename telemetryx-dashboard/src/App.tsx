import { useState, useCallback } from 'react';
import { DashboardLayout, Header } from '@/components/layout';
import { GlassCard, LoadingSpinner } from '@/components/ui';
import { useRaceStore } from '@/stores/useRaceStore';
import { SESSION_TYPES } from '@/constants';
import { Track3D } from '@/components/map/Track3D';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import type { SessionType, SessionData, DriverInfo } from '@/types';

// Available years (2018-2025)
const AVAILABLE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Mock races for demo (in production, this would come from API)
const MOCK_RACES: Record<number, string[]> = {
  2024: ['Bahrain Grand Prix', 'Saudi Arabian Grand Prix', 'Australian Grand Prix', 'Japanese Grand Prix', 'Chinese Grand Prix', 'Miami Grand Prix', 'Emilia Romagna Grand Prix', 'Monaco Grand Prix', 'Canadian Grand Prix', 'Spanish Grand Prix', 'Austrian Grand Prix', 'British Grand Prix', 'Hungarian Grand Prix', 'Belgian Grand Prix', 'Dutch Grand Prix', 'Italian Grand Prix', 'Azerbaijan Grand Prix', 'Singapore Grand Prix', 'United States Grand Prix', 'Mexico City Grand Prix', 'São Paulo Grand Prix', 'Las Vegas Grand Prix', 'Qatar Grand Prix', 'Abu Dhabi Grand Prix'],
  2023: ['Bahrain Grand Prix', 'Saudi Arabian Grand Prix', 'Australian Grand Prix', 'Azerbaijan Grand Prix', 'Miami Grand Prix', 'Monaco Grand Prix', 'Spanish Grand Prix', 'Canadian Grand Prix', 'British Grand Prix', 'Hungarian Grand Prix', 'Belgian Grand Prix', 'Dutch Grand Prix', 'Italian Grand Prix', 'Singapore Grand Prix', 'Japanese Grand Prix', 'Qatar Grand Prix', 'United States Grand Prix', 'Mexico City Grand Prix', 'São Paulo Grand Prix', 'Abu Dhabi Grand Prix'],
};

// Home Page for Session Selection
function HomePage() {
  const { setSelectedSession, setSessionData, setDuration } = useRaceStore();
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedRace, setSelectedRace] = useState<string>('');
  const [selectedSession, setSelectedSessionType] = useState<string>('R');
  const [loading, setLoading] = useState(false);

  const handleSessionSelect = useCallback(async (year: number, race: string, session: SessionType) => {
    setLoading(true);
    try {
      // Simulate loading - in production, this would load parquet data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock session data for demo
      const mockDrivers: DriverInfo[] = [
        { driverName: 'VER', driverNumber: 1, teamName: 'Red Bull Racing', teamColor: '#1e41ff', cluster: '0', clusterLabel: 'The Elite' },
        { driverName: 'HAM', driverNumber: 44, teamName: 'Mercedes', teamColor: '#00d2be', cluster: '0', clusterLabel: 'The Elite' },
        { driverName: 'LEC', driverNumber: 16, teamName: 'Ferrari', teamColor: '#e8002d', cluster: '2', clusterLabel: 'The Winner' },
        { driverName: 'NOR', driverNumber: 4, teamName: 'McLaren', teamColor: '#ff8000', cluster: '2', clusterLabel: 'The Winner' },
        { driverName: 'RUS', driverNumber: 63, teamName: 'Mercedes', teamColor: '#00d2be', cluster: '1', clusterLabel: 'Midfield Runner' },
      ];

      const mockSessionData: SessionData = {
        metadata: {
          year,
          raceName: race,
          sessionType: session,
          duration: 5400, // 90 minutes
          totalLaps: 57,
        },
        drivers: mockDrivers,
        laps: [],
        telemetry: [],
        positions: [],
      };

      setSelectedSession({ year, race, session });
      setSessionData(mockSessionData);
      setDuration(5400);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  }, [setSelectedSession, setSessionData, setDuration]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <GlassCard className="max-w-2xl w-full p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-f1-red flex items-center justify-center">
            <span className="text-white font-bold text-2xl">TX</span>
          </div>
          <h1 className="text-3xl font-bold text-white">TELEMETRYX</h1>
          <p className="text-white/40 mt-2">F1 Strategy Dashboard V1.0</p>
        </div>

        {/* Session Selector */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedRace(''); }}
              className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-f1-red/50"
            >
              <option value="">Select Year</option>
              {AVAILABLE_YEARS.map(year => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Race</label>
            <select
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
              disabled={!selectedYear}
              className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-f1-red/50 disabled:opacity-50"
            >
              <option value="">Select Race</option>
              {selectedYear && (MOCK_RACES[parseInt(selectedYear)] || []).map(race => (
                <option key={race} value={race}>{race}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Session</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(SESSION_TYPES).map(([key, { color }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedSessionType(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${selectedSession === key 
                      ? 'text-white' 
                      : 'text-white/40 hover:text-white/60'}`}
                  style={{ 
                    backgroundColor: selectedSession === key ? color : undefined,
                    opacity: selectedSession === key ? 1 : 0.3
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleSessionSelect(
              parseInt(selectedYear),
              selectedRace,
              selectedSession as SessionType
            )}
            disabled={!selectedYear || !selectedRace || loading}
            className="w-full bg-f1-red hover:bg-f1-red-light disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold py-4 rounded-lg transition-colors mt-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" /> Loading...
              </span>
            ) : (
              'Load Session'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-white/20 text-xs">
            Historical Race Playback • 2018-2025 • All Sessions
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

function Dashboard() {
  const { setSessionData, setSelectedSession } = useRaceStore();
  const [loading, setLoading] = useState(false);

  const handleSessionSelect = useCallback(async (year: number, race: string, session: SessionType) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockDrivers: DriverInfo[] = [
        { driverName: 'VER', driverNumber: 1, teamName: 'Red Bull Racing', teamColor: '#1e41ff', cluster: '0', clusterLabel: 'The Elite' },
        { driverName: 'HAM', driverNumber: 44, teamName: 'Mercedes', teamColor: '#00d2be', cluster: '0', clusterLabel: 'The Elite' },
        { driverName: 'LEC', driverNumber: 16, teamName: 'Ferrari', teamColor: '#e8002d', cluster: '2', clusterLabel: 'The Winner' },
        { driverName: 'NOR', driverNumber: 4, teamName: 'McLaren', teamColor: '#ff8000', cluster: '2', clusterLabel: 'The Winner' },
        { driverName: 'RUS', driverNumber: 63, teamName: 'Mercedes', teamColor: '#00d2be', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'ALO', driverNumber: 14, teamName: 'Aston Martin', teamColor: '#006e62', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'PIA', driverNumber: 81, teamName: 'McLaren', teamColor: '#ff8000', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'GAS', driverNumber: 10, teamName: 'Alpine', teamColor: '#0093cc', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'OCO', driverNumber: 31, teamName: 'Alpine', teamColor: '#0093cc', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'STR', driverNumber: 27, teamName: 'Haas', teamColor: '#b6babd', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'HUL', driverNumber: 24, teamName: 'Sauber', teamColor: '#52e252', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'MAG', driverNumber: 38, teamName: 'Haas', teamColor: '#b6babd', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'TSU', driverNumber: 22, teamName: 'RB', teamColor: '#6692ff', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'RIC', driverNumber: 3, teamName: 'RB', teamColor: '#6692ff', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'ALB', driverNumber: 23, teamName: 'Williams', teamColor: '#64c4ff', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'SAR', driverNumber: 55, teamName: 'Williams', teamColor: '#64c4ff', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'BOT', driverNumber: 77, teamName: 'Sauber', teamColor: '#52e252', cluster: '1', clusterLabel: 'Midfield Runner' },
        { driverName: 'ZHO', driverNumber: 20, teamName: 'Sauber', teamColor: '#52e252', cluster: '1', clusterLabel: 'Midfield Runner' },
      ];

      const mockSessionData: SessionData = {
        metadata: {
          year,
          raceName: race,
          sessionType: session,
          duration: 5400,
          totalLaps: 57,
        },
        drivers: mockDrivers,
        laps: [],
        telemetry: [],
        positions: [],
      };

      setSelectedSession({ year, race, session });
      setSessionData(mockSessionData);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  }, [setSelectedSession, setSessionData]);

  return (
    <DashboardLayout
      header={
        <Header
          onSessionSelect={handleSessionSelect}
          availableYears={AVAILABLE_YEARS}
          availableRaces={MOCK_RACES}
          loading={loading}
        />
      }
      leaderboard={<Leaderboard />}
      map={<Track3D />}
      panel={<EngineeringPanel />}
    />
  );
}

function EngineeringPanel() {
  const { activeTab, setActiveTab, sessionData } = useRaceStore();
  const tabs = ['telemetry', 'analysis', 'strategy', 'ml'];

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors
              ${activeTab === tab 
                ? 'text-white bg-surface-hover border-b-2 border-f1-red' 
                : 'text-white/40 hover:text-white/60'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <GlassCard className="p-4">
              <h3 className="text-sm font-medium text-white mb-2">Speed Trace</h3>
              <div className="h-24 bg-surface rounded flex items-center justify-center">
                <span className="text-xs text-white/40">Speed chart placeholder</span>
              </div>
            </GlassCard>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-24 bg-surface rounded-lg flex items-center justify-center">
                <span className="text-xs text-white/40">Throttle</span>
              </div>
              <div className="h-24 bg-surface rounded-lg flex items-center justify-center">
                <span className="text-xs text-white/40">Brake</span>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'analysis' && (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">Race Analysis</p>
            <p className="text-white/20 text-xs mt-1">Lap times, sector comparisons</p>
          </div>
        )}
        {activeTab === 'strategy' && (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">Strategy Panel</p>
            <p className="text-white/20 text-xs mt-1">Pit stops, tyre strategies</p>
          </div>
        )}
        {activeTab === 'ml' && sessionData && (
          <div className="space-y-4">
            <GlassCard className="p-4">
              <h4 className="text-sm font-medium text-white mb-2">Driver Clusters</h4>
              <div className="space-y-2">
                {sessionData.drivers.filter(d => d.clusterLabel).map(driver => (
                  <div key={driver.driverNumber} className="flex items-center justify-between">
                    <span className="text-xs text-white/60">{driver.driverName}</span>
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/40">
                      {driver.clusterLabel}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <h4 className="text-sm font-medium text-white mb-2">Undercut Watch</h4>
              <p className="text-xs text-white/40">No undercut opportunities detected</p>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const { selectedSession } = useRaceStore();

  return selectedSession ? <Dashboard /> : <HomePage />;
}

export default App;
