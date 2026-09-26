import { useState, useCallback } from 'react';
import axios from 'axios';
import { parsePaxsenixLyrics } from '@/lib/lyricsParser';
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

  const fetchLyricsForTrack = useCallback(async (track: { title: string; artist: string; duration?: number }) => {
    setIsLoading(true);
    setError(null);
    setLines([]);

    try {
      // Step 1: Search iTunes for Apple Music track ID (free, no auth)
      const searchQuery = track.title + ' ' + track.artist;
      const searchResponse = await axios.get('https://itunes.apple.com/search', {
        params: { term: searchQuery, entity: 'song', limit: 8, country: 'US' },
        timeout: 10000,
      });

      const results = searchResponse.data?.results || [];
      if (results.length === 0) {
        setError('No matching track found on Apple Music');
        setIsLoading(false);
        return;
      }

      // Find best duration match (±5s)
      let selectedTrack = results[0];
      const durationMs = track.duration !== undefined ? track.duration * 1000 : undefined;
      if (durationMs !== undefined) {
        const matched = results.find((t: any) =>
          Math.abs(t.trackTimeMillis - durationMs) <= 5000
        );
        if (matched) selectedTrack = matched;
      }

      const appleMusicId = selectedTrack.trackId;
      if (!appleMusicId) {
        setError('No Apple Music track ID found');
        setIsLoading(false);
        return;
      }

      // Step 2: Fetch word-synced lyrics from paxsenix (Apple Music)
      const lyricsResponse = await axios.get(
        'https://lyrics.paxsenix.org/apple-music/lyrics?id=' + appleMusicId,
        { timeout: 15000 }
      );

      const data = lyricsResponse.data;
      if (!data || data.error) {
        setError('No lyrics found for this track');
        setIsLoading(false);
        return;
      }

      // Step 3: Convert paxsenix format to our internal format
      const parsed = parsePaxsenixLyrics(data);
      setLines(parsed.lines);
      setAttribution({
        provider: 'Apple Music (via paxsenix)',
        uploader: undefined,
        maker: undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch lyrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lines, attribution, isLoading, error, fetchLyricsForTrack };
}
