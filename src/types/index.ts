/* ── SpicyLyrics API types ────────────────────────────────────────── */

export type SyncType = 'Syllable' | 'Line' | 'Static';
export type SyncSource = 'spicy_lyrics' | 'apple_music' | 'spotify' | string;

export interface SpicyLyricsSyllable {
  Text: string;
  StartTime: number;          // seconds
  EndTime: number;            // seconds
  IsPartOfWord: boolean;
  TransliteratedText?: string;
}

export interface SpicyLyricsVoicePart {
  Syllables: SpicyLyricsSyllable[];
  StartTime: number;
  EndTime: number;
  TransliteratedText?: string;
  TranslatedText?: string;
  HasTransliterations?: boolean;
  HasTranslations?: boolean;
}

export interface SpicyLyricsContentItem {
  Type: 'Vocal' | 'Background' | string;
  OppositeAligned?: boolean;
  Lead: SpicyLyricsVoicePart;
  Background?: SpicyLyricsVoicePart[];
  HasTransliterations?: boolean;
  HasTranslations?: boolean;
}

export interface SpicyLyricsAttribution {
  Uploader: {
    id: string;
    username: string;
    url?: string;
    avatar?: string;
    hasProfileBanner: boolean;
  };
  Maker: {
    id: string;
    username: string;
    url?: string;
    avatar?: string;
    hasProfileBanner: boolean;
  };
}

export interface SpicyLyricsResponse {
  Body: {
    id: string;
    source: SyncSource;
    SongWriters?: string[];
    UploadAttribution?: SpicyLyricsAttribution;
    HasTransliterations: boolean;
    HasTranslations: boolean;
    Type: SyncType;
    StartTime: number;   // seconds
    EndTime: number;     // seconds
    Content: SpicyLyricsContentItem[];
  };
  Status: number;
  Type: 'object';
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  spotifyTrackId?: string;
  filePath?: string;
  localPath?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}
