import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LyricLine, LyricWord, WordStatus, AttributionInfo } from '@/lib/lyricsParser';
import { computeWordStyle, findActiveLineIndex } from '@/lib/lyricsParser';
import { useReducedMotion, getSpring } from '@/lib/motion';

interface LyricsViewProps {
  lines: LyricLine[];
  currentTime: number;
  attribution?: AttributionInfo;
  onSeek?: (time: number) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ lines, currentTime, attribution, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = findActiveLineIndex(lines, currentTime);

  // Scroll active line into view with proper padding
  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;
    const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
    if (!activeEl) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    
    // Check if element is fully visible with 2-line padding (approx 80px)
    const padding = 80;
    const isFullyVisible = (
      elRect.top >= containerRect.top + padding &&
      elRect.bottom <= containerRect.bottom - padding
    );
    
    if (!isFullyVisible) {
      // Scroll to position with offset to keep 2 lines visible above/below
      const scrollTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-4xl mb-2">&#9835;</div>
        <p className="text-sm">No synced lyrics found</p>
        <p className="text-xs opacity-50">Load a track to see word-synced lyrics</p>
      </div>
    );
  }

  return (
    <div className="lyrics-container" ref={containerRef}>
      <AnimatePresence mode="wait">
        {lines.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPreActive = idx === activeIndex - 1;
          const isPlayed = idx < activeIndex;

          // Spring configs
        const lineSpring = getSpring('slow', useReducedMotion());
        const scaleSpring = getSpring('base', useReducedMotion());
        
        // Differentiated initial states
        const initial = isPlayed 
          ? { opacity: 0.3, y: 0, scale: 1 }
          : { opacity: 0, y: 8, scale: 0.98 };
        
        const animate = isActive
          ? { opacity: 1, y: 0, scale: 1.02 }
          : isPlayed
            ? { opacity: 0.3, y: 0, scale: 1 }
            : { opacity: 0.6, y: 0, scale: 1 };
        
        const exit = { opacity: 0, y: -8, scale: 0.98 };

        // Format timestamp for tooltip
        const formatTooltipTime = (seconds: number) => {
          const m = Math.floor(seconds / 60);
          const s = Math.floor(seconds % 60).toString().padStart(2, '0');
          return `${m}:${s}`;
        };

        return (
            <motion.div
              key={idx}
              className="lyric-line"
              onClick={() => {
                onSeek?.(line.startTime);
              }}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={{
                opacity: lineSpring,
                y: lineSpring,
                scale: scaleSpring,
              }}
              style={{ 
                paddingLeft: '0.5em', 
                paddingRight: '0.5em',
                cursor: 'pointer',
              }}
              whileHover={{ textDecoration: 'underline' }}
            >
              <motion.p
                style={{
                  fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                  fontWeight: isActive ? 700 : 400,
                  lineHeight: 1.6,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                }}
              >
                {line.words.map((word, wi) => {
                  const style = computeWordStyle(word, currentTime);
                  const statusClass = style.status === 'Active' ? 'Active'
                    : style.status === 'Sung' ? 'Sung' : 'NotSung';

                  return (
                    <motion.span
                      key={wi}
                      className={`lyric-word gradient-text ${statusClass}`}
                      style={{
                        '--gradient-position': style.status === 'Active' ? '100%' : '-20%',
                      } as React.CSSProperties}
                      animate={{
                        scale: style.scale,
                        y: style.yOffset,
                        filter: `blur(${style.blur}px)`,
                        opacity: style.opacity,
                      }}
                      transition={(() => {
                        const reduced = useReducedMotion();
                        const wordSpring = getSpring('base', reduced);
                        const opacitySpring = getSpring('fast', reduced);
                        return {
                          scale: wordSpring,
                          y: wordSpring,
                          filter: wordSpring,
                          opacity: opacitySpring,
                        };
                      })()}
                    >
                      {word.text}{' '}
                    </motion.span>
                  );
                })}
              </motion.p>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Attribution */}
      {attribution && (
        <div className="attribution">
          <span>Lyrics by </span>
          <strong>{attribution.provider}</strong>
          {attribution.uploader && (
            <>
              {' · uploaded by '}
              <a href={attribution.uploader.url} target="_blank" rel="noreferrer">
                {attribution.uploader.username}
              </a>
            </>
          )}
          {attribution.maker && (
            <>
              {' · made by '}
              <a href={attribution.maker.url} target="_blank" rel="noreferrer">
                {attribution.maker.username}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
};
