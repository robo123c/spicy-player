import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const electronAPI = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel: string, ...args: unknown[]): void {
    ipcRenderer.send(channel, ...args);
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  onMediaKey(action: string, callback: () => void) {
    const channel = `media-key:${action}`;
    const subscription = (_event: IpcRendererEvent) => callback();
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  isDev(): boolean {
    return process.env.NODE_ENV === 'development';
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);
