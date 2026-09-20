const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snapAPI', {
  platform: process.platform,
  // Electron no longer exposes the clipboard module here, so it is read in main.
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (dirPath) => ipcRenderer.invoke('open-folder', dirPath),
  fetchPlaylist: (url) => ipcRenderer.invoke('fetch-playlist', url),
  searchCatalog: (query) => ipcRenderer.invoke('search-catalog', query),
  getTrackAudio: (track) => ipcRenderer.invoke('get-track-audio', track),
  getLicenseStatus: (forceOnline = false) => ipcRenderer.invoke('get-license-status', forceOnline),
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
  resolveCoverArt: (params) => ipcRenderer.invoke('resolve-cover-art', params),
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
  onLicenseRevoked: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('license-revoked', listener);
    return () => ipcRenderer.removeListener('license-revoked', listener);
  },
  onLicenseStatusChanged: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('license-status-changed', listener);
    return () => ipcRenderer.removeListener('license-status-changed', listener);
  },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  connectSpotify: () => ipcRenderer.invoke('spotify-connect'),
  disconnectSpotify: () => ipcRenderer.invoke('spotify-disconnect'),
  onSpotifyConnected: callback => ipcRenderer.on('spotify-connected', (_event, result) => callback(result))
});
