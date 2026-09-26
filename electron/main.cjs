"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const promises_1 = require("fs/promises");
const axios_1 = __importDefault(require("axios"));
const music_metadata_1 = require("music-metadata");
// Force SwiftShader software rendering for Wayland
electron_1.app.commandLine.appendSwitch('use-gl', 'swiftshader');
electron_1.app.commandLine.appendSwitch('disable-gpu', 'false');
electron_1.app.commandLine.appendSwitch('ozone-platform', 'x11');
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPICY_API = 'https://api.spicylyrics.org/v1/lyrics';
const CONFIG_FILE = path_1.default.join(electron_1.app.getPath('userData'), 'config.json');
const BOUNDS_FILE = path_1.default.join(electron_1.app.getPath('userData'), 'window-bounds.json');
function loadConfig() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    }
    catch { }
    return {};
}
function saveConfig(config) {
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function loadBounds() {
    try {
        if (fs_1.default.existsSync(BOUNDS_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(BOUNDS_FILE, 'utf-8'));
        }
    }
    catch { }
    return null;
}
function saveBounds(bounds) {
    fs_1.default.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds, null, 2));
}
let spotifyToken = null;
let spotifyTokenExpiry = 0;
async function getSpotifyToken() {
    if (spotifyToken && Date.now() < spotifyTokenExpiry)
        return spotifyToken;
    const cid = process.env.SPOTIFY_CLIENT_ID || loadConfig().spotifyClientId;
    const secret = process.env.SPOTIFY_CLIENT_SECRET || loadConfig().spotifyClientSecret;
    if (!cid || !secret)
        return null;
    const creds = Buffer.from(`${cid}:${secret}`).toString('base64');
    try {
        const res = await axios_1.default.post(TOKEN_URL, 'grant_type=client_credentials', {
            headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        spotifyToken = res.data.access_token;
        spotifyTokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
        return spotifyToken;
    }
    catch (e) {
        console.error('[main] Spotify token exchange failed:', e);
        return null;
    }
}
electron_1.ipcMain.handle('open-file-dialog', async () => {
    console.log('[main] open-file-dialog invoked');
    const result = await electron_1.dialog.showOpenDialog({
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
electron_1.ipcMain.handle('open-directory-dialog', async () => {
    console.log('[main] open-directory-dialog invoked');
    const result = await electron_1.dialog.showOpenDialog({
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
electron_1.ipcMain.handle('read-directory', async (_event, dirPath) => {
    console.log('[main] read-directory invoked for:', dirPath);
    try {
        const entries = await (0, promises_1.readdir)(dirPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            path: path_1.default.join(dirPath, entry.name),
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
        }));
    }
    catch (err) {
        console.error('[main] read-directory error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-track-metadata', async (_event, filePath) => {
    try {
        const metadata = await (0, music_metadata_1.parseFile)(filePath, { skipPostHeaders: true, skipCovers: false });
        const pic = metadata.common.picture?.[0];
        return {
            filePath,
            title: metadata.common.title || path_1.default.basename(filePath, path_1.default.extname(filePath)),
            artist: metadata.common.artist || metadata.common.albumartist || 'Unknown Artist',
            album: metadata.common.album || '',
            duration: metadata.format.duration || 0,
            cover: pic ? `data:${pic.mime || 'image/jpeg'};base64,${Buffer.from(pic.data).toString('base64')}` : null,
        };
    }
    catch (e) {
        console.error('[main] Metadata error:', e);
        return null;
    }
});
electron_1.ipcMain.handle('spotify:search', async (_event, query, durationMs) => {
    const token = await getSpotifyToken();
    if (!token)
        return null;
    try {
        const res = await axios_1.default.get('https://api.spotify.com/v1/search', {
            headers: { Authorization: `Bearer ${token}` },
            params: { q: query, type: 'track', limit: 8 },
        });
        const tracks = res.data?.tracks?.items || [];
        if (tracks.length === 0)
            return null;
        if (durationMs) {
            const matched = tracks.find((t) => Math.abs(t.duration_ms - durationMs) <= 5000);
            if (matched)
                return matched;
        }
        return tracks[0];
    }
    catch (e) {
        console.error('[main] Spotify search error:', e);
        return null;
    }
});
electron_1.ipcMain.handle('spicylyrics:lyrics', async (_event, trackId) => {
    const apiKey = process.env.SPICY_LYRICS_API_KEY || loadConfig().spicyLyricsKey;
    if (!apiKey) {
        console.error('[main] SPICY_LYRICS_API_KEY not set');
        return null;
    }
    try {
        const res = await axios_1.default.get(`${SPICY_API}/${trackId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 15000,
        });
        return res.data;
    }
    catch (e) {
        if (e.response?.status === 404)
            return { Status: 404, Body: null };
        console.error('[main] SpicyLyrics API error:', e.response?.status, e.message);
        return null;
    }
});
electron_1.ipcMain.handle('config:get', () => loadConfig());
electron_1.ipcMain.handle('config:set', (_event, config) => {
    saveConfig(config);
    return true;
});
function createWindow() {
    const savedBounds = loadBounds();
    const win = new electron_1.BrowserWindow({
        width: savedBounds?.width || 1400,
        height: savedBounds?.height || 850,
        x: savedBounds?.x,
        y: savedBounds?.y,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a0a0a',
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
        trafficLightPosition: { x: 20, y: 20 },
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Save window bounds on resize/move
    const saveWindowBounds = () => {
        const bounds = win.getBounds();
        saveBounds(bounds);
    };
    win.on('resize', saveWindowBounds);
    win.on('move', saveWindowBounds);
    const startUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:5173'
        : `file://${path_1.default.join(__dirname, '../build/index.html')}`;
    win.loadURL(startUrl);
    if (process.env.NODE_ENV === 'development')
        win.webContents.openDevTools({ mode: 'detach' });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    // Register global media keys
    const registerMediaKeys = () => {
        electron_1.globalShortcut.register('MediaPlayPause', () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win)
                win.webContents.send('media-key:playpause');
        });
        electron_1.globalShortcut.register('MediaNextTrack', () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win)
                win.webContents.send('media-key:next');
        });
        electron_1.globalShortcut.register('MediaPreviousTrack', () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win)
                win.webContents.send('media-key:prev');
        });
        electron_1.globalShortcut.register('MediaStop', () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win)
                win.webContents.send('media-key:stop');
        });
    };
    registerMediaKeys();
    // Re-register on focus (some OS unregister when app loses focus)
    electron_1.app.on('browser-window-focus', registerMediaKeys);
});
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
electron_1.app.on('window-all-closed', () => {
    electron_1.globalShortcut.unregisterAll();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
