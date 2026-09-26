import axios from 'axios';
import type { TrackInfo } from '../types';

/** Spotify Web API client-credentials token endpoint */
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
}

export class SpotifyAPI {
  private clientId: string;
  private clientSecret: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /** Exchange client credentials for a bearer token (cached until expiry) */
  private async getAccessToken(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    try {
      const res = await axios.post(
        TOKEN_URL,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.token = res.data['access_token'];
      this.tokenExpiry = Date.now() + (res.data['expires_in'] - 60) * 1000;
      return this.token;
    } catch (err) {
      console.error('[SpotifyAPI] Token exchange failed:', err);
      return null;
    }
  }

  /** Search Spotify and return the best-matching track with a 22-char ID */
  async searchTrack(query: string, durationMs?: number): Promise<SpotifyTrack | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          q: query,
          type: 'track',
          limit: 8,
        },
      });

      const tracks: SpotifyTrack[] = res.data?.tracks?.items || [];
      if (tracks.length === 0) return null;

      // Prefer the closest duration match (within ±5 s)
      if (durationMs) {
        const matched = tracks.find(
          (t) => Math.abs(t.duration_ms - durationMs) <= 5000,
        );
        if (matched) return matched;
      }

      return tracks[0];
    } catch (err) {
      console.error('[SpotifyAPI] Search failed:', err);
      return null;
    }
  }

  /** Convenience: search by title+artist, return TrackInfo */
  async findTrack(title: string, artist: string, durationMs?: number): Promise<TrackInfo | null> {
    const query = `track:${title} artist:${artist}`;
    const spotify = await this.searchTrack(query, durationMs);
    if (!spotify) return null;

    const bestImage =
      spotify.album.images.sort((a, b) => b.width - a.width)[0]?.url ||
      spotify.album.images[0]?.url ||
      '';

    return {
      id: spotify.id,
      title: spotify.name,
      artist: spotify.artists.map((a) => a.name).join(', '),
      album: spotify.album.name,
      duration: Math.round(spotify.duration_ms / 1000),
      coverUrl: bestImage,
      spotifyTrackId: spotify.id,
    };
  }
}
