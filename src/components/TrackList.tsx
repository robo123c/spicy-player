import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { IconMusic, IconSearch, IconX, IconFolder } from '@tabler/icons-react';
import type { TrackInfo } from '@/types';

interface TrackListProps {
  tracks: TrackInfo[];
  currentTrackId: string | null;
  onSelect: (track: TrackInfo) => void;
  onLoadFiles: () => void;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentTrackId, onSelect, onLoadFiles }) => {
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
          <button className="ctrl-btn" onClick={onLoadFiles} style={{ width: 32, height: 32 }}>
            <IconFolder stroke={2} size={16} />
          </button>
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
          <div className="empty-state" style={{ padding: '2rem' }}>
            <IconMusic stroke={2} size={32} />
            <p className="text-sm">No tracks loaded</p>
            <button
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
            >
              Load Audio Files
            </button>
          </div>
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
