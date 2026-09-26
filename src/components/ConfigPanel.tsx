import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { IconSettings, IconX } from '@tabler/icons-react';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string>) => void;
  initialConfig: Record<string, string>;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose, onSave, initialConfig }) => {
  const [spicyKey, setSpicyKey] = useState(initialConfig.spicyLyricsKey || '');
  const [spotifyId, setSpotifyId] = useState(initialConfig.spotifyClientId || '');
  const [spotifySecret, setSpotifySecret] = useState(initialConfig.spotifyClientSecret || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ spicyLyricsKey: spicyKey, spotifyClientId: spotifyId, spotifyClientSecret: spotifySecret });
    onClose();
  };

  return (
    <motion.div
      className="config-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
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
        value={spicyKey}
        onChange={(e) => setSpicyKey(e.target.value)}
      />

      <label style={{ marginTop: '0.5rem' }}>Spotify Client ID</label>
      <input
        type="text"
        placeholder="Your Spotify App Client ID"
        value={spotifyId}
        onChange={(e) => setSpotifyId(e.target.value)}
      />

      <label style={{ marginTop: '0.5rem' }}>Spotify Client Secret</label>
      <input
        type="password"
        placeholder="Your Spotify App Client Secret"
        value={spotifySecret}
        onChange={(e) => setSpotifySecret(e.target.value)}
      />

      <button
        onClick={handleSave}
        style={{
          width: '100%',
          marginTop: '1rem',
          padding: '0.6rem',
          borderRadius: 8,
          background: 'rgba(139,92,246,0.3)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
      >
        Save Configuration
      </button>
      <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.5rem' }}>
        Get keys at <a href="https://developers.spicylyrics.org/docs" target="_blank" rel="noreferrer" style={{ color: 'rgba(139,92,246,0.6)' }}>developers.spicylyrics.org</a> and <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'rgba(139,92,246,0.6)' }}>Spotify Developer Dashboard</a>
      </p>
    </motion.div>
  );
};
