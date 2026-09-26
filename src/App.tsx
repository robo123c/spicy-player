import { useState, useCallback, useRef, useEffect } from 'react';

// Extend Window interface for electron
declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      onMediaKey: (action: string, callback: () => void) => () => void;
      isDev: () => boolean;
    };
  }
}
import { LyricsView } from './components/LyricsView';
import { PlayerControls } from './components/PlayerControls';
import { TrackList } from './components/TrackList';
import { ConfigPanel } from './components/ConfigPanel';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useLyrics } from './hooks/useLyrics';
import type { TrackInfo } from './types';

export default function App() {
  const audio = useAudioPlayer();
  const { lines, attribution, isLoading, error, fetchLyricsForTrack } = useLyrics();

  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({
    spicyLyricsKey: '',
    spotifyClientId: '',
    spotifyClientSecret: '',
  });
  
  const configTriggerRef = useRef<HTMLButtonElement>(null);

  const loadFiles = useCallback(async () => {
    console.log('[renderer] loadFiles called');
    const paths = await (window as any).electron?.invoke?.('open-file-dialog');
    console.log('[renderer] dialog returned:', paths);
    if (!paths || paths.length === 0) {
      console.log('[renderer] no paths selected');
      return;
    }

    const newTracks: TrackInfo[] = [];
    for (const filePath of paths) {
      const meta = await (window as any).electron?.invoke?.('get-track-metadata', filePath);
      if (meta) {
        newTracks.push({ ...meta, localPath: filePath });
      }
    }

    setTracks((prev) => [...newTracks, ...prev]);

    // Auto-load first track
    if (newTracks.length > 0 && !audio.currentTrack) {
      const first = newTracks[0];
      setCurrentTrackId(first.id || first.filePath || '');
      audio.loadTrack(first);
      audio.play();
    }
  }, [audio]);

  const loadFolder = useCallback(async () => {
    console.log('[renderer] loadFolder called');
    const paths = await (window as any).electron?.invoke?.('open-directory-dialog');
    console.log('[renderer] directory dialog returned:', paths);
    if (!paths || paths.length === 0) {
      console.log('[renderer] no directory selected');
      return;
    }
    const folderPath = paths[0];
    
    // Recursively find all audio files in the folder
    const findAudioFiles = async (dir: string): Promise<string[]> => {
      const entries = await (window as any).electron?.invoke?.('read-directory', dir);
      if (!entries) return [];
      const audioFiles: string[] = [];
      for (const entry of entries) {
        const fullPath = entry.path || entry;
        if (entry.isDirectory) {
          const nested = await findAudioFiles(fullPath);
          audioFiles.push(...nested);
        } else if (entry.isFile && /\.(mp3|flac|m4a|wav|ogg|wma)$/i.test(fullPath)) {
          audioFiles.push(fullPath);
        }
      }
      return audioFiles;
    };
    
    const audioFiles = await findAudioFiles(folderPath);
    if (audioFiles.length === 0) {
      console.log('[renderer] no audio files found in folder');
      return;
    }
    
    const newTracks: TrackInfo[] = [];
    for (const filePath of audioFiles) {
      const meta = await (window as any).electron?.invoke?.('get-track-metadata', filePath);
      if (meta) {
        newTracks.push({ ...meta, localPath: filePath });
      }
    }
    
    setTracks((prev) => [...newTracks, ...prev]);
    
    if (newTracks.length > 0 && !audio.currentTrack) {
      const first = newTracks[0];
      setCurrentTrackId(first.id || first.filePath || '');
      audio.loadTrack(first);
      audio.play();
      fetchLyricsForTrack({ title: first.title, artist: first.artist, duration: first.duration });
    }
  }, [audio, fetchLyricsForTrack]);


  const selectTrack = useCallback((track: TrackInfo) => {
    setCurrentTrackId(track.id || track.filePath || '');
    audio.unload();
    audio.loadTrack(track);
    audio.play();

    // Fetch lyrics automatically
    fetchLyricsForTrack({ title: track.title, artist: track.artist, duration: track.duration });
  }, [audio, fetchLyricsForTrack]);

  const removeTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => (t.id || t.filePath) !== trackId));
    // If current track was removed, clear selection
    if (currentTrackId === trackId) {
      setCurrentTrackId(null);
      audio.unload();
    }
  }, [audio, currentTrackId]);

  const clearLibrary = useCallback(() => {
    setTracks([]);
    setCurrentTrackId(null);
    audio.unload();
  }, [audio]);

  const nextTrack = useCallback(() => {
    const idx = tracks.findIndex((t) => (t.id || t.filePath) === currentTrackId);
    if (idx < tracks.length - 1) {
      const next = tracks[idx + 1];
      selectTrack(next);
    }
  }, [tracks, currentTrackId, selectTrack]);

  const prevTrack = useCallback(() => {
    const idx = tracks.findIndex((t) => (t.id || t.filePath) === currentTrackId);
    if (idx > 0) {
      const prev = tracks[idx - 1];
      selectTrack(prev);
    }
  }, [tracks, currentTrackId, selectTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          audio.togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          audio.seek(audio.currentTime + 10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          audio.seek(audio.currentTime - 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          audio.setVolume(Math.min(1, audio.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          audio.setVolume(Math.max(0, audio.volume - 0.1));
          break;
        case 'KeyJ':
          e.preventDefault();
          audio.seek(audio.currentTime - 10);
          break;
        case 'KeyL':
          e.preventDefault();
          audio.seek(audio.currentTime + 10);
          break;
        case 'KeyM':
          e.preventDefault();
          audio.setVolume(audio.volume > 0 ? 0 : 0.5);
          break;
        case 'KeyN':
          e.preventDefault();
          nextTrack();
          break;
        case 'KeyP':
          e.preventDefault();
          prevTrack();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audio, nextTrack, prevTrack]);

  // Global media key listeners
  useEffect(() => {
    const cleanupPlayPause = window.electron?.onMediaKey('playpause', () => {
      audio.togglePlayPause();
    });
    const cleanupNext = window.electron?.onMediaKey('next', () => {
      nextTrack();
    });
    const cleanupPrev = window.electron?.onMediaKey('prev', () => {
      prevTrack();
    });
    const cleanupStop = window.electron?.onMediaKey('stop', () => {
      audio.pause();
      audio.seek(0);
    });
    
    return () => {
      cleanupPlayPause?.();
      cleanupNext?.();
      cleanupPrev?.();
      cleanupStop?.();
    };
  }, [audio, nextTrack, prevTrack]);

  const handleConfigSave = useCallback((newConfig: Record<string, string>) => {
    setConfig(newConfig);
    // Persist to main process
    (window as any).electron?.invoke?.('config:set', newConfig);
    // Also set env vars for main process
    if (newConfig.spicyLyricsKey) {
      (window as any).__SPICY_LYRICS_API_KEY__ = newConfig.spicyLyricsKey;
    }
  }, []);

  // Load config on mount
  useState(() => {
    (window as any).electron?.invoke?.('config:get').then((c: Record<string, string>) => {
      setConfig(c);
    });
  });

  const activeTrack = tracks.find((t) => (t.id || t.filePath) === currentTrackId);

  return (
    <div className="player-container">
      {/* Top bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>SpicyPlayer</span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
            Word-Synced Lyrics
          </span>
        </div>
        <button
          ref={configTriggerRef}
          onClick={() => setShowConfig(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ⚙️
        </button>
      </header>

      {/* Main area */}
      <div className="main-area">
        {/* Left: Track list */}
        <div className="side-panel" style={{ width: 320 }}>
          <TrackList
            tracks={tracks}
            currentTrackId={currentTrackId}
            onSelect={selectTrack}
            onLoadFiles={loadFiles}
            onLoadFolder={loadFolder}
            onRemoveTrack={removeTrack}
            onClearLibrary={clearLibrary}
          />
        </div>

        {/* Center: Player + Lyrics */}
        <div className="center-panel" style={{ flex: 1 }}>
          {/* Album art */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            {activeTrack?.coverUrl ? (
              <img
                src={activeTrack.coverUrl}
                alt=""
                className="album-art"
                style={{
                  width: 240,
                  height: 240,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 60px ${attribution ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.4)'}`,
                }}
              />
            ) : (
              <div style={{
                width: 240, height: 240, borderRadius: 12,
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <span style={{ fontSize: '3rem' }}>&#127925;</span>
              </div>
            )}
          </div>

          {/* Track info */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '0.25rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {audio.currentTrack?.title || '--'}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
              {audio.currentTrack?.artist || '--'}
            </p>
          </div>

          {/* Player controls */}
          <PlayerControls
            isPlaying={audio.isPlaying}
            currentTime={audio.currentTime}
            duration={audio.duration}
            volume={audio.volume}
            onPlayPause={audio.togglePlayPause}
            onNext={nextTrack}
            onPrev={prevTrack}
            onSeek={audio.seek}
            onVolumeChange={audio.setVolume}
          />

          {/* Lyrics */}
          <div style={{
            flex: 1,
            width: '100%',
            maxWidth: 600,
            marginTop: '1rem',
            borderRadius: 16,
            background: 'rgba(15,15,15,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
          }}>
            {isLoading && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                Fetching synced lyrics...
              </div>
            )}
            {error && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(239,68,68,0.6)', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            {!isLoading && !error && (
              <LyricsView
                lines={lines}
                currentTime={audio.currentTime}
                attribution={attribution || undefined}
                onSeek={audio.seek}
              />
            )}
          </div>
        </div>
      </div>

      {/* Config panel */}
      <ConfigPanel
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onSave={handleConfigSave}
        initialConfig={config}
        triggerRef={configTriggerRef}
      />
    </div>
  );
}
