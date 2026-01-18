import React from 'react';
import { useRaceStore } from '@/stores/useRaceStore';
import { Play, Pause, SkipBack, SkipForward, Settings } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { SESSION_TYPES, PLAYBACK_SPEEDS } from '@/constants';
import type { SessionType } from '@/types';

interface HeaderProps {
  onSessionSelect: (year: number, race: string, session: SessionType) => void;
  availableYears: number[];
  availableRaces: Record<number, string[]>;
  loading?: boolean;
}

export function Header({
  onSessionSelect,
  availableYears,
  availableRaces,
  loading
}: HeaderProps) {
  const {
    selectedSession,
    isPlaying,
    currentTime,
    playbackSpeed,
    duration,
    togglePlay,
    seek,
    setPlaybackSpeed
  } = useRaceStore();

  // State for selectors
  const [selectedYear, setSelectedYear] = React.useState<string>('');
  const [selectedRace, setSelectedRace] = React.useState<string>('');
  const [selectedSessionType, setSelectedSessionType] = React.useState<string>('R');

  const handleSessionChange = () => {
    if (selectedYear && selectedRace && selectedSessionType) {
      onSessionSelect(
        parseInt(selectedYear),
        selectedRace,
        selectedSessionType as SessionType
      );
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    seek(progress);
  };

  // Handle skip
  const skipSeconds = (seconds: number) => {
    seek(currentTime + seconds);
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-f1-red flex items-center justify-center">
          <span className="text-white font-bold text-sm">TX</span>
        </div>
        <h1 className="text-lg font-semibold text-white">TELEMETRYX</h1>
      </div>

      {/* Session Selector */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedYear}
          onChange={(v) => { setSelectedYear(v); setSelectedRace(''); }}
          options={availableYears.map(y => ({ value: String(y), label: String(y) }))}
          placeholder="Year"
        />
        <Select
          value={selectedRace}
          onChange={(v) => { setSelectedRace(v); }}
          options={(availableRaces[parseInt(selectedYear)] || []).map(r => ({ value: r, label: r }))}
          placeholder="Race"
          disabled={!selectedYear}
        />
        <Select
          value={selectedSessionType}
          onChange={(v) => setSelectedSessionType(v)}
          options={Object.entries(SESSION_TYPES).map(([key, { name }]) => ({
            value: key,
            label: `${name} (${key})`
          }))}
        />
        <Button
          variant="primary"
          onClick={handleSessionChange}
          disabled={!selectedYear || !selectedRace || loading}
        >
          {loading ? 'Loading...' : 'Load'}
        </Button>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {/* Skip Back 10s */}
        <Button variant="ghost" size="sm" onClick={() => skipSeconds(-10)}>
          <SkipBack className="w-4 h-4" />
        </Button>

        {/* Play/Pause */}
        <Button variant="primary" size="sm" onClick={togglePlay} disabled={!selectedSession}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        {/* Skip Forward 10s */}
        <Button variant="ghost" size="sm" onClick={() => skipSeconds(10)}>
          <SkipForward className="w-4 h-4" />
        </Button>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-white/60">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!selectedSession}
            className="w-32 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-f1-red"
          />
          <span className="text-xs text-white/60">{formatTime(duration)}</span>
        </div>

        {/* Speed Selector */}
        <Select
          value={String(playbackSpeed)}
          onChange={(v) => setPlaybackSpeed(parseFloat(v))}
          options={PLAYBACK_SPEEDS.map(s => ({ value: String(s.value), label: s.label }))}
          className="w-20"
        />

        {/* Settings */}
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
