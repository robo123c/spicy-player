import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs'
import { readdir, stat } from 'fs/promises';
import axios from 'axios';
import { parseFile } from 'music-metadata';




// Force SwiftShader software rendering for Wayland
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('disable-gpu', 'false');
app.commandLine.appendSwitch('ozone-platform', 'x11');


const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPICY_API = 'https://api.spicylyrics.org/v1/lyrics';
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadConfig(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: Record<string, string>) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;
  const cid = process.env.SPOTIFY_CLIENT_ID || loadConfig().spotifyClientId;
  const secret = process.env.SPOTIFY_CLIENT_SECRET || loadConfig().spotifyClientSecret;
  if (!cid || !secret) return null;
  const creds = Buffer.from(`${cid}:${secret}`).toString('base64');
  try {
    const res = await axios.post(TOKEN_URL, 'grant_type=client_credentials', {
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    spotifyToken = res.data.access_token;
    spotifyTokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch (e) {
    console.error('[main] Spotify token exchange failed:', e);
    return null;
  }
}

ipcMain.handle('open-file-dialog', async () => {
  console.log('[main] open-file-dialog invoked');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'wma'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  console.log('[main] dialog result:', result);
  if (result.canceled) {
    console.log('[main] dialog canceled');
    return [];
  }
  console.log('[main] selected files:', result.filePaths);
  return result.filePaths;
});

ipcMain.handle('open-directory-dialog', async () => {
  console.log('[main] open-directory-dialog invoked');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  console.log('[main] directory dialog result:', result);
  if (result.canceled) {
    console.log('[main] directory dialog canceled');
    return [];
  }
  console.log('[main] selected directory:', result.filePaths);
  return result.filePaths;
});



ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  console.log('[main] read-directory invoked for:', dirPath);
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (err) {
    console.error('[main] read-directory error:', err);
    return [];
  }
});

ipcMain.handle('get-track-metadata', async (_event, filePath: string) => {
  try {
    const metadata = await parseFile(filePath, { skipPostHeaders: true, skipCovers: false });
    const pic = metadata.common.picture?.[0] as any;
    return {
      filePath,
      title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
      artist: metadata.common.artist || metadata.common.albumartist || 'Unknown Artist',
      album: metadata.common.album || '',
      duration: metadata.format.duration || 0,
      cover: pic ? `data:${pic.mime || 'image/jpeg'};base64,${Buffer.from(pic.data).toString('base64')}` : null,
    };
  } catch (e) {
    console.error('[main] Metadata error:', e);
    return null;
  }
});

ipcMain.handle('spotify:search', async (_event, query: string, durationMs?: number) => {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const res = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, type: 'track', limit: 8 },
    });
    const tracks: any[] = res.data?.tracks?.items || [];
    if (tracks.length === 0) return null;
    if (durationMs) {
      const matched = tracks.find((t: any) => Math.abs(t.duration_ms - durationMs) <= 5000);
      if (matched) return matched;
    }
    return tracks[0];
  } catch (e) {
    console.error('[main] Spotify search error:', e);
    return null;
  }
});

ipcMain.handle('spicylyrics:lyrics', async (_event, trackId: string) => {
  const apiKey = process.env.SPICY_LYRICS_API_KEY || loadConfig().spicyLyricsKey;
  if (!apiKey) {
    console.error('[main] SPICY_LYRICS_API_KEY not set');
    return null;
  }
  try {
    const res = await axios.get(`${SPICY_API}/${trackId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });
    return res.data;
  } catch (e: any) {
    if (e.response?.status === 404) return { Status: 404, Body: null };
    console.error('[main] SpicyLyrics API error:', e.response?.status, e.message);
    return null;
  }
});

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_event, config: Record<string, string>) => {
  saveConfig(config);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 20, y: 20 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../build/index.html')}`;
  win.loadURL(startUrl);
  if (process.env.NODE_ENV === 'development') win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
