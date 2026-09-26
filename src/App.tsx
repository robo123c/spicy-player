import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricsView } from './components/LyricsView';
import { PlayerControls } from './components/PlayerControls';
import { TrackList } from './components/TrackList';
import { ConfigPanel } from './components/ConfigPanel';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useLyrics } from './hooks/useLyrics';
import { useReducedMotion, getSpring } from '@/lib/motion';
import { IconFile, IconFolder, IconMusic, IconList } from '@tabler/icons-react';
import { QueuePanel } from './components/QueuePanel';
import type { TrackInfo } from './types';

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
  const [folderLoading, setFolderLoading] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [queue, setQueue] = useState<TrackInfo[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  
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
    
    setFolderLoading({ current: 0, total: audioFiles.length, currentFile: '' });
    
    const newTracks: TrackInfo[] = [];
    for (let i = 0; i < audioFiles.length; i++) {
      const filePath = audioFiles[i];
      setFolderLoading({ current: i + 1, total: audioFiles.length, currentFile: filePath.split('/').pop() || filePath });
      const meta = await (window as any).electron?.invoke?.('get-track-metadata', filePath);
      if (meta) {
        newTracks.push({ ...meta, localPath: filePath });
      }
      // Yield to main thread every 10 files
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    setFolderLoading(null);
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

    // Add to queue if not already there
    setQueue((prev) => {
      const exists = prev.some(t => (t.id || t.filePath) === (track.id || track.filePath));
      if (!exists) {
        return [...prev, track];
      }
      return prev;
    });

    // Fetch lyrics automatically
    fetchLyricsForTrack({ title: track.title, artist: track.artist, duration: track.duration });
  }, [audio, fetchLyricsForTrack]);

  const removeTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => (t.id || t.filePath) !== trackId));
    setQueue((prev) => prev.filter((t) => (t.id || t.filePath) !== trackId));
    // If current track was removed, clear selection
    if (currentTrackId === trackId) {
      setCurrentTrackId(null);
      audio.unload();
    }
  }, [audio, currentTrackId]);

  const editTrack = useCallback((trackId: string, title: string, artist: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        (t.id || t.filePath) === trackId ? { ...t, title, artist } : t
      )
    );
    setQueue((prev) =>
      prev.map((t) =>
        (t.id || t.filePath) === trackId ? { ...t, title, artist } : t
      )
    );
  }, []);

  const clearLibrary = useCallback(() => {
    setTracks([]);
    setQueue([]);
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

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return newQueue;
    });
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue((prev) => prev.filter((t) => (t.id || t.filePath) !== trackId));
  }, []);

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

  // First-run onboarding
  useEffect(() => {
    const hasLoadedTracks = localStorage.getItem('spicyplayer-has-loaded');
    if (!hasLoadedTracks && tracks.length === 0) {
      setShowOnboarding(true);
    }
  }, [tracks.length]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('spicyplayer-has-loaded', 'true');
    setShowOnboarding(false);
  };

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
        <button
          onClick={() => setShowQueue(!showQueue)}
          style={{
            background: 'none',
            border: 'none',
            color: showQueue ? '#8b5cf6' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: 4,
            marginLeft: 8,
          }}
          aria-label={showQueue ? 'Hide queue' : 'Show queue'}
        >
          <IconList stroke={2} size={20} />
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
            onEditTrack={editTrack}
            folderLoading={folderLoading}
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
            ) : activeTrack ? (
              <div className="skeleton skeleton-lg" style={{
                width: 240, height: 240,
                margin: '0 auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }} />
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

      {/* Queue panel */}
      <QueuePanel
        queue={queue}
        currentTrackId={currentTrackId}
        onSelect={selectTrack}
        onRemove={removeFromQueue}
        onReorder={reorderQueue}
        onClose={() => setShowQueue(false)}
        isOpen={showQueue}
      />

      {/* Config panel */}
      <ConfigPanel
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onSave={handleConfigSave}
        initialConfig={config}
        triggerRef={configTriggerRef}
      />

      {/* Onboarding */}
      {showOnboarding && (
        <motion.div
          key="onboarding"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            style={{
              background: 'rgba(20,20,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '2rem',
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={getSpring('slow', useReducedMotion())}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '3rem' }}>🎵</span>
              <h2 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>Welcome to SpicyPlayer</h2>
              <p style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                Word-synced lyrics for your music library
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconFile stroke={2} size={24} color="#8b5cf6" />
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Load Music Files</strong>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Select individual audio files (MP3, FLAC, M4A, etc.)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconFolder stroke={2} size={24} color="#8b5cf6" />
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Load Music Folder</strong>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Recursively scan a folder for all audio files</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconMusic stroke={2} size={24} color="#8b5cf6" />
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Synced Lyrics</strong>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Automatic word-by-word lyrics from SpicyLyrics</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => { setShowConfig(true); handleOnboardingComplete(); }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: 8,
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  color: '#8b5cf6',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Open Settings
              </button>
              <button
                onClick={handleOnboardingComplete}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: 8,
                  background: 'rgba(139,92,246,0.8)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Get Started
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
