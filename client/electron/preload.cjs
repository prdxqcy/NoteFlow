const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noteflowDesktop', {
  isAvailable: true,
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('desktop:update-settings', settings),
  onAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('desktop:action', listener);
    return () => ipcRenderer.removeListener('desktop:action', listener);
  },
});
