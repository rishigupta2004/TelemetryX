import { useRaceStore } from '@/stores/useRaceStore';

export function Track3D() {
  const { sessionData } = useRaceStore();

  return (
    <div className="w-full h-full flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-f1-red/20 to-f1-red/5 flex items-center justify-center border border-white/5">
          <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-white/60 font-medium mb-2">3D Track Visualization</h3>
        <p className="text-white/30 text-sm max-w-xs">
          {sessionData 
            ? `Showing ${sessionData.metadata.raceName} - ${sessionData.metadata.sessionType} session`
            : 'Load a session to view track'}
        </p>
        
        {sessionData && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {sessionData.drivers.map((driver) => (
              <div 
                key={driver.driverNumber}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-hover border"
                style={{ borderColor: driver.teamColor + '40' }}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: driver.teamColor }}
                />
                <span className="text-xs text-white/70">{driver.driverName}</span>
                {driver.clusterLabel && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                    {driver.clusterLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TrackLayer() {
  return null;
}

export function CarMarkers() {
  return null;
}
