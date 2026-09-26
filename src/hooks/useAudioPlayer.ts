import { useState, useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import type { TrackInfo } from '@/types';

export function useAudioPlayer() {
  const soundRef = useRef<Howl | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadTrack = useCallback((track: TrackInfo) => {
    stopInterval();
    if (soundRef.current) {
      soundRef.current.unload();
      soundRef.current = null;
    }

    const sound = new Howl({
      src: [track.filePath || track.localPath || ''],
      format: [track.filePath?.split('.').pop() || 'mp3'],
      html5: true,
      autoplay: false,
      volume: volume,
      onload: () => {
        setDuration(sound.duration());
        setCurrentTrack(track);
      },
      onloaderror: (err) => {
        console.error('[AudioPlayer] Load error:', err);
      },
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => setIsPlaying(false),
      onend: () => {
        setIsPlaying(false);
        stopInterval();
      },
    });

    soundRef.current = sound;
  }, [volume, stopInterval]);

  const play = useCallback(() => {
    if (soundRef.current && !isPlaying) {
      soundRef.current.play();
    }
  }, [isPlaying]);

  const pause = useCallback(() => {
    if (soundRef.current && isPlaying) {
      soundRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlayPause = useCallback(() => {
    if (!soundRef.current) return;
    if (soundRef.current.playing()) {
      soundRef.current.pause();
    } else {
      soundRef.current.play();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (soundRef.current) {
      soundRef.current.seek(time);
      setCurrentTime(time);
    }
  }, []);

  const setVolumeVal = useCallback((vol: number) => {
    if (soundRef.current) {
      soundRef.current.volume(vol);
    }
    setVolume(vol);
  }, []);

  // Time update loop
  useEffect(() => {
    if (isPlaying && soundRef.current) {
      intervalRef.current = setInterval(() => {
        if (soundRef.current?.playing()) {
          const t = soundRef.current.seek();
          setCurrentTime(t);
        }
      }, 100);
    }
    return () => stopInterval();
  }, [isPlaying, stopInterval]);

  const unload = useCallback(() => {
    stopInterval();
    if (soundRef.current) {
      soundRef.current.unload();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(null);
  }, [stopInterval]);

  return {
    soundRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    currentTrack,
    loadTrack,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume: setVolumeVal,
    unload,
  };
}
