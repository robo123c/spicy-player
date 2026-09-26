import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { SpotifyAPI } from '@/lib/spotifyAPI';
import { parseSpicyLyrics } from '@/lib/lyricsParser';
import type { LyricLine, AttributionInfo } from '@/lib/lyricsParser';

interface UseLyricsReturn {
  lines: LyricLine[];
  attribution: AttributionInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchLyricsForTrack: (track: { title: string; artist: string; duration?: number }) => Promise<void>;
}

export function useLyrics(): UseLyricsReturn {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [attribution, setAttribution] = useState<AttributionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spotifyRef = useRef<SpotifyAPI | null>(null);

  const getSpotify = useCallback(() => {
    if (!spotifyRef.current) {
      const cid = import.meta.env?.VITE_SPOTIFY_CLIENT_ID || '';
      const secret = import.meta.env?.VITE_SPOTIFY_CLIENT_SECRET || '';
      if (cid && secret) {
        spotifyRef.current = new SpotifyAPI(cid, secret);
      }
    }
    return spotifyRef.current;
  }, []);

  const fetchLyricsForTrack = useCallback(async (track: { title: string; artist: string; duration?: number }) => {
    setIsLoading(true);
    setError(null);
    setLines([]);

    try {
      // Step 1: Find the Spotify track ID
      let trackId: string | null = null;
      const spotify = getSpotify();

      if (spotify) {
        const found = await spotify.findTrack(track.title, track.artist, track.duration ? track.duration * 1000 : undefined);
        if (found?.spotifyTrackId) {
          trackId = found.spotifyTrackId;
        }
      }

      // Fallback: search via IPC
      if (!trackId) {
        const result = await (window as any).electron?.invoke?.('spotify:search', `${track.title} ${track.artist}`, track.duration ? track.duration * 1000 : undefined);
        if (result?.id) {
          trackId = result.id;
        }
      }

      if (!trackId) {
        setError('Could not find the track on Spotify');
        setIsLoading(false);
        return;
      }

      // Step 2: Fetch lyrics from SpicyLyrics API
      const data = await (window as any).electron?.invoke?.('spicylyrics:lyrics', trackId);

      if (!data || data.Status !== 200 || !data.Body) {
        setError('No lyrics found for this track');
        setIsLoading(false);
        return;
      }

      // Step 3: Parse into line/word structures
      const parsed = parseSpicyLyrics(data);
      setLines(parsed.lines);
      setAttribution({
        provider: parsed.source === 'spicy_lyrics' ? 'Spicy Lyrics' : parsed.source,
        uploader: parsed.attribution.uploader,
        maker: parsed.attribution.maker,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch lyrics');
    } finally {
      setIsLoading(false);
    }
  }, [getSpotify]);

  return { lines, attribution, isLoading, error, fetchLyricsForTrack };
}
