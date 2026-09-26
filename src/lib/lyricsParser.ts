import type {
  SpicyLyricsResponse,
  SyncType,
} from '../types';

export interface LyricWord {
  text: string;
  startTime: number;   // seconds
  endTime: number;     // seconds
  isPartOfWord: boolean;
}

export interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
  words: LyricWord[];
}

export interface AttributionInfo {
  provider: string;
  uploader?: { username: string; url?: string; avatar?: string };
  maker?: { username: string; url?: string; avatar?: string };
}

const IDLE_SCALE = 0.95;

/**
 * Parse raw spicy-lyrics API JSON into line/word structures + metadata.
 *
 * The API `Content` is an array of items. Each item has a `Lead` (main vocal)
 * and optionally `Background` (harmony / backing vocals). Each voice part has a
 * `Syllables` array where `IsPartOfWord` indicates whether the syllable is a
 * continuation of the previous syllable (e.g. "Ruh" + "dle" → "Riddle").
 *
 * Grouping rule: if IsPartOfWord is false, start a new word; if true, append
 * to the current word. Word start time = first syllable start; word end time
 * = last syllable end.
 */
export function parseSpicyLyrics(
  data: SpicyLyricsResponse,
): {
  lines: LyricLine[];
  type: SyncType;
  source: string;
  attribution: AttributionInfo;
  startTime: number;
  endTime: number;
} {
  const { Body } = data;
  const type = Body.Type;
  const source = Body.source;

  const lines: LyricLine[] = [];

  if (type === 'Syllable' && Array.isArray(Body.Content)) {
    for (const item of Body.Content) {
      if (!item.Lead?.Syllables || item.Type === 'Background') continue;

      const words = groupSyllablesIntoWords(item.Lead.Syllables);
      if (words.length === 0) continue;

      const text = words.map((w) => w.text).join(' ');
      const startTime = words[0].startTime;
      const endTime = words[words.length - 1].endTime;

      lines.push({ text, startTime, endTime, words });

      // Background vocals — render as a separate sub-line for richness
      if (Array.isArray(item.Background)) {
        for (const bg of item.Background) {
          if (!bg.Syllables || bg.Syllables.length === 0) continue;
          const bgWords = groupSyllablesIntoWords(bg.Syllables);
          if (bgWords.length === 0) continue;
          const bgText = bgWords.map((w) => w.text).join(' ');
          const bgStart = bgWords[0].startTime;
          const bgEnd = bgWords[bgWords.length - 1].endTime;
          lines.push({
            text: bgText,
            startTime: bgStart,
            endTime: bgEnd,
            words: bgWords,
          });
        }
      }
    }
  } else if (type === 'Line' && Array.isArray(Body.Content)) {
    // Line-level sync: each Content item has a Lead with StartTime/EndTime and
  // TransliteratedText or a text field — split into pseudo-words
    for (const item of Body.Content) {
      const lead = item.Lead;
      if (!lead) continue;
      const lineText = lead.TransliteratedText || '';
      if (!lineText) continue;
      const start = lead.StartTime ?? Body.StartTime;
      const end = lead.EndTime ?? start + 2;
      const wordTexts = lineText.split(/\s+/).filter((w) => w.length > 0);
      const duration = end - start;
      const wordDur = wordTexts.length > 0 ? duration / wordTexts.length : 1;
      const words: LyricWord[] = wordTexts.map((w, i) => ({
        text: w,
        startTime: start + i * wordDur,
        endTime: start + (i + 1) * wordDur,
        isPartOfWord: false,
      }));
      lines.push({ text: lineText, startTime: start, endTime: end, words });
    }
  }

  // Sort by start time and link end times to the next line's start
  lines.sort((a, b) => a.startTime - b.startTime);
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].endTime > lines[i + 1].startTime) {
      lines[i].endTime = lines[i + 1].startTime;
    }
  }

  // Build attribution from source
  const attribution: AttributionInfo = {
    provider: source === 'spicy_lyrics' ? 'Spicy Lyrics' : source,
  };
  if (source === 'spicy_lyrics' && Body.UploadAttribution) {
    const { Uploader, Maker } = Body.UploadAttribution;
    if (Uploader) {
      attribution.uploader = {
        username: Uploader.username,
        url: Uploader.url,
        avatar: Uploader.avatar,
      };
    }
    if (Maker) {
      attribution.maker = {
        username: Maker.username,
        url: Maker.url,
        avatar: Maker.avatar,
      };
    }
  }

  return {
    lines,
    type,
    source,
    attribution,
    startTime: Body.StartTime,
    endTime: Body.EndTime,
  };
}

/**
 * Group consecutive syllables into words using IsPartOfWord.
 * - If a syllable's IsPartOfWord is false → start a new word.
 * - If true → append text to the current word and extend its endTime.
 */
function groupSyllablesIntoWords(syllables: any[]): LyricWord[] {
  const words: LyricWord[] = [];

  for (const syl of syllables) {
    const text = syl.Text?.trim();
    if (!text) continue;

    if (words.length === 0 || !syl.IsPartOfWord) {
      // Start a new word
      words.push({
        text,
        startTime: syl.StartTime,
        endTime: syl.EndTime,
        isPartOfWord: false,
      });
    } else {
      // Append to the current word
      const last = words[words.length - 1];
      last.text += text;
      last.endTime = syl.EndTime;
    }
  }

  return words;
}

/** Status types for each word at a given playback position */
export type WordStatus = 'NotSung' | 'Active' | 'Sung';

/**
 * Determine the status of a single word given the current playback time.
 * Uses the exact same logic from the lyrics-sync skill (getElementStatus).
 */
export function getWordStatus(
  currentTime: number,
  wordStart: number,
  wordEnd: number,
): WordStatus {
  if (currentTime < wordStart) return 'NotSung';
  if (currentTime >= wordEnd) return 'Sung';
  return 'Active';
}

/** Clamp helper */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Compute per-word animation parameters for a given playback time.
 * Mirrors the spicy-lyrics animation physics (scale, y-offset, blur, opacity).
 */
export function computeWordStyle(
  word: LyricWord,
  currentTime: number,
): { scale: number; yOffset: number; blur: number; opacity: number; status: WordStatus } {
  const status = getWordStatus(currentTime, word.startTime, word.endTime);
  const progress =
    status === 'Active'
      ? clamp(
          (currentTime - word.startTime) / Math.max(0.001, word.endTime - word.startTime),
          0,
          1,
        )
      : 0;

  let scale = IDLE_SCALE;
  let yOffset = 0;
  let blur = 0;
  let opacity = 0.5;

  if (status === 'Active') {
    // Scale: 0.95 → 1.05 → 1.0 over the word's lifetime
    if (progress < 0.7) {
      scale = 0.95 + (1.0505 - 0.95) * (progress / 0.7);
    } else {
      scale = 1.0505 + (1.0 - 1.0505) * ((progress - 0.7) / 0.3);
    }
    yOffset = (1 / 100) + (-(1 / 60) - 1 / 100) * clamp(progress / 0.9, 0, 1);
    blur = 0;
    opacity = 1;
  } else if (status === 'Sung') {
    scale = 0.98;
    blur = Math.round(3 * 1.25);
    opacity = 0.3;
  }

  return { scale, yOffset, blur, opacity, status };
}

/** Find the index of the line currently being sung */
export function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].startTime && currentTime < lines[i].endTime) {
      return i;
    }
  }
  if (lines.length > 0 && currentTime >= lines[lines.length - 1].startTime) {
    return lines.length - 1;
  }
  return -1;
}

export { IDLE_SCALE };
