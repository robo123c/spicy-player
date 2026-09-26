import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconExternalLink, IconX, IconTrash, IconSettings } from '@tabler/icons-react';
import { useReducedMotion, getSpring } from '@/lib/motion';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string>) => void;
  initialConfig: Record<string, string>;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose, onSave, initialConfig, triggerRef }) => {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [transformOrigin, setTransformOrigin] = useState('top right');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [spicyLyricsKey, setSpicyLyricsKey] = useState(initialConfig.spicyLyricsKey || '');
  const [spotifyClientId, setSpotifyClientId] = useState(initialConfig.spotifyClientId || '');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState(initialConfig.spotifyClientSecret || '');
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // Compute transform-origin from trigger position
  useEffect(() => {
    if (!triggerRef?.current || !panelRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    
    // Origin relative to panel top-left
    const originX = triggerRect.right - panelRect.left;
    const originY = triggerRect.top - panelRect.top;
    
    setTransformOrigin(`${originX}px ${originY}px`);
  }, [triggerRef, isOpen]);
  
  const spring = getSpring('slow', reduced);
  const fastSpring = getSpring('fast', reduced);
  
  if (!isOpen) return null;
  
  const handleSave = () => {
    onSave({ 
      spicyLyricsKey: spicyLyricsKey, 
      spotifyClientId: spotifyClientId, 
      spotifyClientSecret: spotifyClientSecret 
    });
    onClose();
  };
  
  const handleTestKey = async () => {
    if (!spicyLyricsKey.trim()) {
      setTestResult('Enter a key first');
      return;
    }
    setTestResult('Testing...');
    try {
      const res = await fetch('https://api.spicylyrics.org/v1/lyrics/11dFghVXANMlKmJXsNCbNl', {
        headers: { Authorization: `Bearer ${spicyLyricsKey}` },
      });
      if (res.ok) {
        setTestResult('✓ Valid key');
      } else {
        setTestResult('✗ Invalid key');
      }
    } catch {
      setTestResult('✗ Network error');
    }
  };
  
  const handleTestSpotify = async () => {
    if (!spotifyClientId.trim() || !spotifyClientSecret.trim()) {
      setTestResult('Enter both credentials');
      return;
    }
    setTestResult('Testing...');
    try {
      const params = new URLSearchParams({ grant_type: 'client_credentials' });
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${spotifyClientId}:${spotifyClientSecret}`)}`,
        },
        body: params,
      });
      if (res.ok) {
        setTestResult('✓ Valid credentials');
      } else {
        setTestResult('✗ Invalid credentials');
      }
    } catch {
      setTestResult('✗ Network error');
    }
  };
  
  const handleClearLibrary = () => {
    if (confirm('Clear all loaded tracks?')) {
      (window as any).electron?.invoke?.('config:set', { clearLibrary: 'true' });
      window.location.reload();
    }
  };

  return (
    <motion.div
      ref={panelRef}
      className="config-panel"
      style={{ 
        transformOrigin,
      } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.95, filter: 'blur(0px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(20px)' }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(0px)' }}
      transition={{
        opacity: spring,
        scale: spring,
        filter: fastSpring,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconSettings stroke={2} size={16} /> API Configuration
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
          <IconX stroke={2} size={16} />
        </button>
      </div>

      <label>SpicyLyrics API Key</label>
      <input
        type="password"
        placeholder="sl_sk_..."
        value={spicyLyricsKey}
        onChange={(e) => setSpicyLyricsKey(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
        <button onClick={handleTestKey} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '0.7rem', cursor: 'pointer' }}>
          Test Key
        </button>
        <button onClick={() => setShowSecrets(!showSecrets)} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e5e5', fontSize: '0.7rem', cursor: 'pointer' }}>
          {showSecrets ? 'Hide' : 'Show'}
        </button>
      </div>
      {testResult && <p style={{ fontSize: '0.7rem', color: testResult.includes('✓') ? '#22c55e' : '#ef4444', marginTop: '0.5rem' }}>{testResult}</p>}

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>Advanced Settings</span>
          <span style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
        </button>
        
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              key="advanced"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={getSpring('base', reduced)}
              style={{ overflow: 'hidden', marginTop: '0.75rem' }}
            >
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <label>Spotify Client ID</label>
                <input
                  type="text"
                  placeholder="Client ID"
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                />
                <label style={{ marginTop: '0.5rem' }}>Spotify Client Secret</label>
                <input
                  type="password"
                  placeholder="Client Secret"
                  value={spotifyClientSecret}
                  onChange={(e) => setSpotifyClientSecret(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: '0.5rem' }}>
                  <button onClick={handleTestSpotify} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '0.7rem', cursor: 'pointer' }}>
                    Test Credentials
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <label>Links</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  <a href="https://developers.spicylyrics.org" target="_blank" rel="noreferrer" style={{ color: 'rgba(139,92,246,0.7)', textDecoration: 'none' }}>
                    <IconExternalLink stroke={1.5} size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> SpicyLyrics Dashboard
                  </a>
                  <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'rgba(139,92,246,0.7)', textDecoration: 'none' }}>
                    <IconExternalLink stroke={1.5} size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Spotify Developer Dashboard
                  </a>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={handleClearLibrary} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <IconTrash stroke={1.5} size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Clear Library
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};