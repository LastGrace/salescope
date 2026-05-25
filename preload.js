const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onCloseRequest: (callback) => ipcRenderer.on('close-app-request', callback),
    quitApp: () => ipcRenderer.send('quit-app'),
    minimizeApp: () => ipcRenderer.send('minimize-app'),
    maximizeApp: () => ipcRenderer.send('maximize-app'),
    closeWindow: () => ipcRenderer.send('close-window'),
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, data) => callback(data)),
    retryStartup: () => ipcRenderer.send('retry-startup'),
    notifyLogin: () => ipcRenderer.send('user-logged-in'),
    notifyLogout: () => ipcRenderer.send('user-logged-out')
});
