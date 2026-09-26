import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconMusic, IconSearch, IconX, IconFolder } from '@tabler/icons-react';
import type { TrackInfo } from '@/types';
import { useReducedMotion, getSpring } from '@/lib/motion';

interface TrackListProps {
  tracks: TrackInfo[];
  currentTrackId: string | null;
  onSelect: (track: TrackInfo) => void;
  onLoadFiles: () => void;
  onLoadFolder: () => void;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentTrackId, onSelect, onLoadFiles, onLoadFolder }) => {
  const [query, setQuery] = useState('');

  const filtered = query
    ? tracks.filter((t) =>
        `${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase())
      )
    : tracks;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Your Library</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ctrl-btn" onClick={onLoadFiles} style={{ width: 32, height: 32 }} title="Load Audio Files">
              <IconFolder stroke={2} size={16} />
            </button>
            <button className="ctrl-btn" onClick={onLoadFolder} style={{ width: 32, height: 32 }} title="Load Folder">
              <IconFolder stroke={2} size={16} />
            </button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <IconSearch stroke={2} size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            placeholder="Search tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#e5e5e5',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Track list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {filtered.length === 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="empty-state"
              className="empty-state"
              style={{ padding: '2rem' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={getSpring('slower', useReducedMotion())}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={getSpring('slower', useReducedMotion())}
              >
                <IconMusic stroke={2} size={32} />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={getSpring('slower', useReducedMotion())}
                className="text-sm"
              >
                No tracks loaded
              </motion.p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <motion.button
                  onClick={onLoadFiles}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    background: 'rgba(139,92,246,0.2)',
                    color: '#8b5cf6',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    ...getSpring('slow', useReducedMotion()),
                    delay: 0.06,
                    damping: 0.8, // Pop feel for delight
                  }}
                >
                  Load Audio Files
                </motion.button>
                <motion.button
                  onClick={onLoadFolder}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    background: 'rgba(139,92,246,0.2)',
                    color: '#8b5cf6',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    ...getSpring('slow', useReducedMotion()),
                    delay: 0.12,
                    damping: 0.8,
                  }}
                >
                  Load Music Folder
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          filtered.map((track) => (
            <motion.div
              key={track.id || track.filePath}
              className={`track-item ${currentTrackId === (track.id || track.filePath) ? 'active' : ''}`}
              onClick={() => onSelect(track)}
              whileHover={{ background: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.98 }}
            >
              {track.coverUrl ? (
                <img
                  src={track.coverUrl}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconMusic stroke={2} size={16} />
                </div>
              )}
              <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist}</div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
