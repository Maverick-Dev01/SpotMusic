const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('snapAPI', {
  platform: process.platform,
  readClipboard: () => clipboard.readText(),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (dirPath) => ipcRenderer.invoke('open-folder', dirPath),
  fetchPlaylist: (url) => ipcRenderer.invoke('fetch-playlist', url),
  searchCatalog: (query) => ipcRenderer.invoke('search-catalog', query),
  getTrackAudio: (track) => ipcRenderer.invoke('get-track-audio', track),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  activateLicense: (token) => ipcRenderer.invoke('activate-license', token),
  removeLicense: () => ipcRenderer.invoke('remove-license'),
  testSpotifyCredentials: (clientId, clientSecret) =>
    ipcRenderer.invoke('test-spotify-credentials', { clientId, clientSecret }),
  startBatchDownload: (payload) => ipcRenderer.invoke('start-batch-download', payload),
  cancelTrack: (trackId) => ipcRenderer.invoke('cancel-track', trackId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  getAlbumTracks: (params) => ipcRenderer.invoke('get-album-tracks', params),
  getDownloadedTracks: () => ipcRenderer.invoke('get-downloaded-tracks'),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  deleteDownloadedTrack: (filePath) => ipcRenderer.invoke('delete-downloaded-track', filePath),
  checkForUpdates: (customUrl) => ipcRenderer.invoke('check-for-updates', customUrl),
  downloadUpdate: (payload) => ipcRenderer.invoke('download-update', payload),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  onUpdateDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close')
});
