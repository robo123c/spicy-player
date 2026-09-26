import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconMusic, IconX, IconGripVertical, IconList, IconTrash } from '@tabler/icons-react';
import type { TrackInfo } from '@/types';
import { useReducedMotion, getSpring } from '@/lib/motion';

interface QueuePanelProps {
  queue: TrackInfo[];
  currentTrackId: string | null;
  onSelect: (track: TrackInfo) => void;
  onRemove: (trackId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  currentTrackId,
  onSelect,
  onRemove,
  onReorder,
  onClose,
  isOpen,
}) => {
  const reduced = useReducedMotion();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const spring = getSpring('base', reduced);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
    setDraggedId(trackId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (trackId !== draggedId) {
      setDragOverId(trackId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTrackId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetTrackId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const fromIndex = queue.findIndex(t => (t.id || t.filePath) === draggedId);
    const toIndex = queue.findIndex(t => (t.id || t.filePath) === targetTrackId);

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedId(null);
    setDragOverId(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="queue-panel"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 380,
          background: 'rgba(15,15,15,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          zIndex: 100,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        initial={{ opacity: 0, x: 380 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 380 }}
        transition={getSpring('slow', reduced)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconList stroke={2} size={20} color="#8b5cf6" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Up Next ({queue.length})</h2>
          </div>
          <button
            onClick={onClose}
            className="ctrl-btn"
            style={{ width: 36, height: 36 }}
            aria-label="Close queue"
          >
            <IconX stroke={2} size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {queue.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
              <IconMusic stroke={2} size={32} />
              <p className="text-sm" style={{ marginTop: '0.5rem' }}>Queue is empty</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Play tracks to add them here</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {queue.map((track, index) => {
                const trackId = track.id || track.filePath || '';
                const isCurrent = trackId === currentTrackId;
                const isDragged = draggedId === trackId;
                const isDragOver = dragOverId === trackId;

                return (
                  <motion.div
                    key={trackId}
                    layout
                    className={"queue-item " + (isCurrent ? 'active ' : '') + (isDragged ? 'dragging ' : '') + (isDragOver ? 'drag-over' : '')}
                    style={{
                      opacity: isDragged ? 0.4 : 1,
                    }}
                    transition={spring}
                    whileHover={{ background: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, trackId)}
                      onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, trackId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, trackId)}
                      onDragEnd={handleDragEnd}
                      style={{ width: '100%', height: '100%' }}
                    >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.3)',
                          cursor: 'grab',
                          flexShrink: 0,
                        }}
                      >
                        <IconGripVertical stroke={2} size={16} />
                      </div>

                      <div style={{ width: 28, textAlign: 'center', fontSize: '0.75rem', color: isCurrent ? '#8b5cf6' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                        {isCurrent ? (
                          <motion.span
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            ▶
                          </motion.span>
                        ) : (
                          index + 1
                        )}
                      </div>

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

                      <div className="track-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="track-title" style={{ color: isCurrent ? '#fff' : '#e5e5e5' }}>
                          {track.title}
                        </div>
                        <div className="track-artist">{track.artist}</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(trackId);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          opacity: isDragged ? 0 : 1,
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                        aria-label="Remove from queue"
                      >
                        <IconX stroke={2} size={14} />
                      </button>
                    </div>
                  </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {queue.length > 0 && (
          <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => {
                if (confirm('Clear entire queue?')) {
                  queue.forEach(t => onRemove(t.id || t.filePath || ''));
                }
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <IconTrash stroke={1.5} size={14} style={{ marginRight: 6 }} /> Clear Queue
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
