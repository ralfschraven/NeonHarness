import { contextBridge, ipcRenderer } from 'electron'

const windowApi = {
  minimize: () => ipcRenderer.send('neon-window:minimize'),
  toggleMaximize: () => ipcRenderer.send('neon-window:toggle-maximize'),
  close: () => ipcRenderer.send('neon-window:close'),
  getState: () => ipcRenderer.invoke('neon-window:get-state'),
  onStateChange: callback => {
    const listener = (_event, state) => callback(Boolean(state?.maximized))
    ipcRenderer.on('neon-window:state', listener)
    return () => ipcRenderer.removeListener('neon-window:state', listener)
  },
}

contextBridge.exposeInMainWorld('neonWindow', windowApi)
