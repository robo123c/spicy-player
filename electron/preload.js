"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    invoke(channel, ...args) {
        return electron_1.ipcRenderer.invoke(channel, ...args);
    },
    send(channel, ...args) {
        electron_1.ipcRenderer.send(channel, ...args);
    },
    on(channel, callback) {
        const subscription = (_event, ...args) => callback(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => electron_1.ipcRenderer.removeListener(channel, subscription);
    },
    onMediaKey(action, callback) {
        const channel = `media-key:${action}`;
        const subscription = (_event) => callback();
        electron_1.ipcRenderer.on(channel, subscription);
        return () => electron_1.ipcRenderer.removeListener(channel, subscription);
    },
    isDev() {
        return process.env.NODE_ENV === 'development';
    },
};
electron_1.contextBridge.exposeInMainWorld('electron', electronAPI);
