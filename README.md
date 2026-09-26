# SpicyPlayer 🎵

A music player with word-synced lyrics powered by the [Spicy Lyrics API](https://developers.spicylyrics.org/).

## Features

- 🎧 **Audio Playback** — Play local FLAC, MP3, M4A, WAV, OGG files
- 📝 **Word-Synced Lyrics** — Real-time word-by-word highlighting from SpicyLyrics API
- 🎨 **SpicyLyrics Visual Style** — Gradient text fill, spring-physics animations, per-word scale/blur/opacity
- 🔍 **Spotify Track Search** — Automatically matches local tracks to Spotify catalog for lyrics lookup
- ⚙️ **API Configuration** — Built-in config panel for API keys
- 📱 **Desktop Native** — Electron app with system media controls

## Architecture

```
├── electron/          # Electron main process
│   ├── main.ts        # IPC handlers for Spotify & SpicyLyrics APIs
│   └── preload.ts     # Context bridge
├── src/
│   ├── lib/
│   │   ├── lyricsParser.ts    # Parse spicy-lyrics Content → LyricLine[]
│   │   └── spotifyAPI.ts      # Spotify Web API client
│   ├── components/
│   │   ├── LyricsView.tsx     # Word-synced lyrics (framer-motion)
│   │   ├── PlayerControls.tsx # Play/pause/seek/volume
│   │   ├── TrackList.tsx      # Local file browser
│   │   └── ConfigPanel.tsx    # API key configuration
│   ├── hooks/
│   │   ├── useAudioPlayer.ts  # Howler.js audio playback
│   │   └── useLyrics.ts       # Lyrics fetching pipeline
│   └── styles/
│       └── index.css          # Tailwind + custom styles
├── vite.config.ts     # Vite build config
└── electron-builder.yml
```

## Getting Started

### Prerequisites
- Node.js >= 20
- npm

### 1. Get API Keys
- **SpicyLyrics API Key**: Create an app at [developers.spicylyrics.org](https://developers.spicylyrics.org/docs)
- **Spotify Client ID & Secret**: Create an app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

### 2. Configure
```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Install & Run
```bash
npm install
npm run dev
```

### 4. Build Distribution
```bash
npm run dist
```

## How It Works

1. **Load Audio Files** — Click the folder icon or use the library panel
2. **Metadata Extraction** — Reads ID3 tags via `music-metadata`
3. **Spotify Search** — Finds matching track on Spotify to get the 22-char track ID
4. **Lyrics Fetch** — Calls `GET https://api.spicylyrics.org/v1/lyrics/{trackId}` with your API key
5. **Content Parsing** — The API returns `Body.Content[].Lead.Syllables[]` with per-syllable timestamps and `IsPartOfWord` flags. Consecutive syllables with `IsPartOfWord=true` are grouped into words.
6. **Word Animation** — Each word gets `Active`/`Sung`/`NotSung` status with spring-physics animations (scale, y-offset, blur, opacity) and gradient text fill

## SpicyLyrics API Integration

The API uses Spotify track IDs (22-base62 chars). The Content array structure:

```json
{
  "Body": {
    "Type": "Syllable",
    "Content": [{
      "Lead": {
        "Syllables": [{
          "Text": "Hello",
          "StartTime": 1.0,
          "EndTime": 2.5,
          "IsPartOfWord": false
        }]
      }
    }]
  }
}
```

- `IsPartOfWord: false` → starts a new word
- `IsPartOfWord: true` → continuation of the previous word
- Words are grouped into `LyricWord` objects with `startTime`/`endTime`

## Attribution

Per the [SpicyLyrics API Terms](https://developers.spicylyrics.org/docs/attribution), when `source: "spicy_lyrics"`, the app displays:
- The provider (Spicy Lyrics)
- The uploader (linked)
- The maker (linked)
