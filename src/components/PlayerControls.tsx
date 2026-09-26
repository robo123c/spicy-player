import React, { useRef, useCallback, useState, useEffect } from 'react';
import { IconPlayerPlay, IconPlayerPause, IconPlayerSkipBack, IconPlayerSkipForward, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { useDebounce } from '@/hooks/useDebounce';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying, currentTime, duration, volume,
  onPlayPause, onNext, onPrev, onSeek, onVolumeChange,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const debouncedSeek = useDebounce(onSeek, 50);

  const handleSliderClick = useCallback((e: React.MouseEvent) => {
    if (!sliderRef.current || !duration) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    debouncedSeek(pct * duration);
  }, [duration, debouncedSeek]);

  const handleSliderMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sliderRef.current || !duration) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    debouncedSeek(pct * duration);
  }, [isDragging, duration, debouncedSeek]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleSliderMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('mousemove', handleSliderMove);
      window.removeEventListener('mouseup', () => setIsDragging(false));
    };
  }, [isDragging, handleSliderMove]);

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div style={{ width: '100%', maxWidth: 600, padding: '0 1rem' }}>
      {/* Progress bar */}
      <div
        ref={sliderRef}
        className="progress-track"
        onClick={handleSliderClick}
        style={{ marginBottom: '1rem' }}
      >
        <div
          className="progress-fill"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
        />
      </div>

      {/* Time labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1rem' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <button className="ctrl-btn" onClick={onPrev}>
          <IconPlayerSkipBack stroke={2} size={20} />
        </button>
        <button className="ctrl-btn play-btn" onClick={onPlayPause}>
          {isPlaying ? (
            <IconPlayerPause stroke={2} size={24} />
          ) : (
            <IconPlayerPlay stroke={2} size={24} />
          )}
        </button>
        <button className="ctrl-btn" onClick={onNext}>
          <IconPlayerSkipForward stroke={2} size={20} />
        </button>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '2rem' }}>
          <button
            className="ctrl-btn"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.5)}
            style={{ width: 36, height: 36 }}
          >
            {volume > 0 ? <IconVolume stroke={2} size={16} /> : <IconVolumeOff stroke={2} size={16} />}
          </button>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#8b5cf6' }}
          />
        </div>
      </div>
    </div>
  );
};
