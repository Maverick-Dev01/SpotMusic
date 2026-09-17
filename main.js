const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const settingsService = require('./src/services/settings');
const spotifyService = require('./src/services/spotify');
const downloaderService = require('./src/services/downloader');
const licenseService = require('./src/services/licenseService');

let mainWindow = null;

const isMac = process.platform === 'darwin';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121212',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  downloaderService.cancelAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

ipcMain.handle('get-settings', async () => {
  return settingsService.getSettings();
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  return settingsService.saveSettings(newSettings);
});

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecciona la carpeta donde guardar la música',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-folder', async (event, dirPath) => {
  if (dirPath) {
    await shell.openPath(dirPath);
    return true;
  }
  return false;
});

ipcMain.handle('check-dependencies', async () => {
  return downloaderService.checkDependencies();
});

ipcMain.handle('test-spotify-credentials', async (event, { clientId, clientSecret }) => {
  return await spotifyService.testConnection(clientId, clientSecret);
});

ipcMain.handle('fetch-playlist', async (event, url) => {
  try {
    const settings = settingsService.getSettings();
    const playlist = await spotifyService.getPlaylist(
      url,
      settings.spotifyClientId,
      settings.spotifyClientSecret
    );
    return { success: true, data: playlist };
  } catch (err) {
    console.error('Error in fetch-playlist:', err);
    return {
      success: false,
      error: err.error?.message || err.message || 'Error al obtener la playlist de Spotify'
    };
  }
});

ipcMain.handle('get-license-status', async () => {
  return licenseService.getCurrentLicense();
});

ipcMain.handle('activate-license', async (event, token) => {
  return licenseService.saveLicense(token);
});

ipcMain.handle('remove-license', async () => {
  return licenseService.removeLicense();
});

ipcMain.handle('search-catalog', async (event, query) => {
  try {
    const settings = settingsService.getSettings();
    const results = await spotifyService.searchCatalog(
      query,
      settings.spotifyClientId,
      settings.spotifyClientSecret
    );
    return { success: true, data: results };
  } catch (err) {
    console.error('Error in search-catalog:', err);
    return {
      success: false,
      error: err.error?.message || err.message || 'Error al buscar en el catálogo'
    };
  }
});

const streamAudioCache = new Map();

ipcMain.handle('get-track-audio', async (event, track) => {
  if (!track || !track.name) {
    return { success: false, error: 'Información de pista no válida' };
  }

  const cacheKey = `${track.name} - ${track.artists || ''}`.toLowerCase().trim();
  if (streamAudioCache.has(cacheKey)) {
    return { success: true, url: streamAudioCache.get(cacheKey), source: 'cache' };
  }

  // 1. Check if track already has a valid preview_url from Spotify
  if (track.preview_url && typeof track.preview_url === 'string' && track.preview_url.startsWith('http')) {
    streamAudioCache.set(cacheKey, track.preview_url);
    return { success: true, url: track.preview_url, source: 'spotify' };
  }

  // 2. Query iTunes Preview Search API (~100ms ultra-fast official 30s preview)
  try {
    const itunesTerm = encodeURIComponent(`${track.name} ${track.artists || ''}`.trim());
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesTerm}&entity=song&limit=1`);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const previewUrl = data.results?.[0]?.previewUrl;
      if (previewUrl) {
        streamAudioCache.set(cacheKey, previewUrl);
        return { success: true, url: previewUrl, source: 'itunes' };
      }
    }
  } catch (err) {
    console.warn('[iTunes preview lookup failed]', err.message);
  }

  // 3. Fallback to yt-dlp direct audio stream extraction
  try {
    const ytStreamUrl = await downloaderService.getAudioStreamUrl(track.name, track.artists || '');
    if (ytStreamUrl) {
      streamAudioCache.set(cacheKey, ytStreamUrl);
      return { success: true, url: ytStreamUrl, source: 'youtube' };
    }
  } catch (err) {
    console.warn('[yt-dlp stream extraction failed]', err.message);
  }

  return {
    success: false,
    error: 'No se pudo obtener el audio de preescucha para esta pista'
  };
});

ipcMain.handle('start-batch-download', async (event, { tracks, format, concurrency, downloadDir }) => {
  try {
    const license = licenseService.getCurrentLicense();
    if (!license.valid) {
      return {
        success: false,
        error: 'Copia no activada: Se requiere una licencia válida para descargar música. Ve al menú de Activación de Licencia.'
      };
    }

    const settings = settingsService.getSettings();
    const targetDir = downloadDir || settings.downloadDir;
    const targetFormat = format || settings.defaultFormat;
    const targetConcurrency = concurrency || settings.concurrency || 3;

    downloaderService.startBatch(
      tracks,
      {
        downloadDir: targetDir,
        format: targetFormat,
        concurrency: targetConcurrency
      },
      (progressData) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', progressData);
        }
      }
    );

    return { success: true };
  } catch (err) {
    console.error('Error starting batch download:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('cancel-track', async (event, trackId) => {
  return downloaderService.cancelTrack(trackId);
});

ipcMain.handle('cancel-all', async () => {
  downloaderService.cancelAll();
  return true;
});

// Window controls for custom buttons if needed
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
