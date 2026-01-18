import { useRaceStore } from '@/stores/useRaceStore';
import { TYRE_COLORS } from '@/constants';

interface DriverRowProps {
  driver: {
    driverName: string;
    driverNumber: number;
    teamName: string;
    teamColor: string;
    clusterLabel?: string;
  };
  position: number;
  gap?: string;
  tyre?: string;
  laps?: number;
}

function DriverRow({ driver, position, gap, tyre, laps }: DriverRowProps) {
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
      onClick={() => {}}
    >
      <span className={`w-6 text-sm font-medium ${position <= 3 ? 'text-f1-red' : 'text-white/40'}`}>
        {position}
      </span>
      <div 
        className="w-1 h-8 rounded"
        style={{ backgroundColor: driver.teamColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{driver.driverName}</span>
          {driver.clusterLabel && (
            <span 
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50"
              title={driver.clusterLabel}
            >
              {driver.clusterLabel.split(' ')[0]}
            </span>
          )}
        </div>
        <span className="text-xs text-white/40">{driver.teamName}</span>
      </div>
      {tyre && (
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ 
            backgroundColor: TYRE_COLORS[tyre as keyof typeof TYRE_COLORS] || '#666',
            color: tyre === 'MEDIUM' ? '#000' : '#fff'
          }}
        >
          {tyre.charAt(0)}
        </div>
      )}
      {gap && (
        <span className="text-xs text-white/50 font-mono">{gap}</span>
      )}
      {laps !== undefined && (
        <span className="text-xs text-white/40">{laps}</span>
      )}
    </div>
  );
}

export function Leaderboard() {
  const { sessionData } = useRaceStore();

  if (!sessionData) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Leaderboard</h2>
        <div className="text-center py-8">
          <p className="text-white/40 text-sm">No session loaded</p>
        </div>
      </div>
    );
  }

  const sortedDrivers = [...sessionData.drivers].sort((a, b) => {
    return a.driverNumber - b.driverNumber;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Leaderboard</h2>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-white/40">{sessionData.metadata.raceName}</span>
          <span className="text-xs text-white/40">{sessionData.metadata.sessionType}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-white/40 uppercase tracking-wider">
            <span className="w-6">Pos</span>
            <span className="flex-1">Driver</span>
            <span className="w-8 text-center">Tyre</span>
            <span className="w-12 text-right">Gap</span>
            <span className="w-8 text-right">Lap</span>
          </div>
          
          {sortedDrivers.map((driver, index) => (
            <DriverRow
              key={driver.driverNumber}
              driver={driver}
              position={index + 1}
              gap={index === 0 ? 'Leader' : '+0.5s'}
              tyre="SOFT"
              laps={index * 5 + 10}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Total Drivers</span>
          <span className="text-white/60">{sessionData.drivers.length}</span>
        </div>
      </div>
    </div>
  );
}
