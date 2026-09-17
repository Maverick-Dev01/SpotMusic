const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const settingsService = require('./src/services/settings');
const spotifyService = require('./src/services/spotify');
const downloaderService = require('./src/services/downloader');
const licenseService = require('./src/services/licenseService');
const updaterService = require('./src/services/updater');

// Register local-audio scheme as privileged for seamless offline audio streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

let mainWindow = null;

const isMac = process.platform === 'darwin';

// Downloaded Track Metadata Registry (Cover Art & Album persistence)
function getMetadataFilePath() {
  const base = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.join(os.homedir(), '.snapmusic');
  if (!fs.existsSync(base)) {
    try { fs.mkdirSync(base, { recursive: true }); } catch (e) {}
  }
  return path.join(base, 'downloaded-metadata.json');
}

function getDownloadedMetadataMap() {
  try {
    const metaFile = getMetadataFilePath();
    if (fs.existsSync(metaFile)) {
      return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveDownloadedMetadata(key, meta) {
  try {
    const metaFile = getMetadataFilePath();
    const map = getDownloadedMetadataMap();
    map[key.toLowerCase()] = meta;
    fs.writeFileSync(metaFile, JSON.stringify(map, null, 2), 'utf8');
  } catch (e) {}
}

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
    // Protocol handler for playing offline downloaded audio files safely
    try {
      protocol.handle('local-audio', (request) => {
        try {
          let fileUrl = request.url.replace(/^local-audio:/, 'file:');
          if (fileUrl.startsWith('file://') && !fileUrl.startsWith('file:///')) {
            fileUrl = fileUrl.replace('file://', 'file:///');
          }
          return net.fetch(fileUrl);
        } catch (err) {
          console.error('Failed to handle local-audio protocol:', err);
          return new Response('File not found', { status: 404 });
        }
      });
    } catch (protErr) {
      console.warn('Protocol registration warning:', protErr.message);
    }

    createWindow();

    // Heartbeat check every 2.5 minutes for cloud license revocation
    setInterval(async () => {
      try {
        const license = await licenseService.getCurrentLicense(true);
        if (license && license.revoked && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('license-revoked', license);
        }
      } catch (e) {}
    }, 150000);

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
  return await licenseService.getCurrentLicense();
});

ipcMain.handle('activate-license', async (event, token) => {
  return await licenseService.saveLicense(token);
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

ipcMain.handle('get-album-tracks', async (event, { albumId, albumName, albumCover }) => {
  try {
    return await spotifyService.getAlbumTracks(albumId, albumName, albumCover);
  } catch (err) {
    console.error('Error in get-album-tracks:', err);
    return {
      success: false,
      error: err.message || 'Error al obtener canciones del álbum'
    };
  }
});

const streamAudioCache = new Map();

ipcMain.handle('get-track-audio', async (event, track) => {
  if (!track || !track.name) {
    return { success: false, error: 'Información de pista no válida' };
  }

  // 0. Check if track is a local offline downloaded file
  if (track.isLocal && track.localPath) {
    if (fs.existsSync(track.localPath)) {
      return {
        success: true,
        url: pathToFileURL(track.localPath).toString().replace(/^file:/, 'local-audio:'),
        source: 'local'
      };
    }
    return { success: false, error: 'El archivo descargado no se encuentra en el disco' };
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

// Downloaded Files & Library IPC Handlers
ipcMain.handle('get-downloaded-tracks', async () => {
  try {
    const settings = settingsService.getSettings();
    const downloadDir = settings.downloadDir;
    if (!downloadDir || !fs.existsSync(downloadDir)) {
      return { success: true, tracks: [] };
    }

    const audioExts = new Set(['.mp3', '.m4a', '.flac', '.opus', '.wav', '.ogg']);
    const entries = fs.readdirSync(downloadDir, { withFileTypes: true });
    const metadataMap = getDownloadedMetadataMap();

    const tracks = [];
    for (const file of entries) {
      if (!file.isFile()) continue;
      const ext = path.extname(file.name).toLowerCase();
      if (!audioExts.has(ext)) continue;

      const fullPath = path.join(downloadDir, file.name);
      const stat = fs.statSync(fullPath);
      const nameWithoutExt = path.basename(file.name, ext);

      // Parse "Artist - Title"
      let artist = 'Descarga Local';
      let title = nameWithoutExt;
      if (nameWithoutExt.includes(' - ')) {
        const parts = nameWithoutExt.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      const cacheKey = `${artist} - ${title}`.toLowerCase();
      let meta = metadataMap[cacheKey] || metadataMap[file.name.toLowerCase()] || null;
      let coverUrl = meta ? meta.cover_url : null;
      let albumName = meta ? meta.album : 'Descargas Locales';

      // Check if a companion thumbnail exists next to the file (e.g. "Artist - Title.jpg" or ".webp")
      if (!coverUrl) {
        for (const cExt of possibleCovers) {
          const companion = path.join(downloadDir, nameWithoutExt + cExt);
          if (fs.existsSync(companion)) {
            coverUrl = pathToFileURL(companion).toString().replace(/^file:/, 'local-audio:');
            break;
          }
        }
      }

      const sizeMb = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';

      tracks.push({
        id: `local-${stat.ino || stat.mtimeMs}`,
        name: title,
        artists: artist,
        album: albumName,
        format: ext.replace('.', '').toUpperCase(),
        size: sizeMb,
        mtime: stat.mtimeMs,
        localPath: fullPath,
        cover_url: coverUrl || '',
        isLocal: true,
        duration_str: '--:--'
      });
    }

    tracks.sort((a, b) => b.mtime - a.mtime);
    return { success: true, tracks };
  } catch (err) {
    console.error('Error in get-downloaded-tracks:', err);
    return { success: false, error: err.message, tracks: [] };
  }
});

ipcMain.handle('resolve-cover-art', async (event, { artist, title }) => {
  try {
    if (!artist || !title) return { success: false };
    const key = `${artist} - ${title}`.toLowerCase();
    const map = getDownloadedMetadataMap();
    if (map[key] && map[key].cover_url) {
      return { success: true, cover_url: map[key].cover_url, album: map[key].album };
    }

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await net.fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const art = (data.results[0].artworkUrl100 || '').replace('100x100bb', '600x600bb');
        if (art) {
          saveDownloadedMetadata(key, {
            cover_url: art,
            album: data.results[0].collectionName || 'Descargas Locales'
          });
          return { success: true, cover_url: art, album: data.results[0].collectionName };
        }
      }
    }
  } catch (e) {
    console.warn('resolve-cover-art warning:', e.message);
  }
  return { success: false };
});

ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
  if (fullPath && fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
    return { success: true };
  }
  return { success: false, error: 'Archivo no encontrado' };
});

ipcMain.handle('delete-downloaded-track', async (event, fullPath) => {
  try {
    if (fullPath && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return { success: true };
    }
    return { success: false, error: 'Archivo no encontrado' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Auto-Updater IPC Handlers
ipcMain.handle('check-for-updates', async (event, customUrl) => {
  return await updaterService.checkForUpdates(customUrl);
});

ipcMain.handle('download-update', async (event, { downloadUrl, fileName }) => {
  try {
    const targetPath = path.join(app.getPath('temp'), fileName || 'SpotMusic_Update');
    await updaterService.downloadFileWithProgress(downloadUrl, targetPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progress);
      }
    });
    return { success: true, filePath: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', async (event, filePath) => {
  return await updaterService.installDownloadedUpdate(filePath);
});

ipcMain.handle('start-batch-download', async (event, { tracks, format, concurrency, downloadDir }) => {
  try {
    const license = await licenseService.getCurrentLicense(true);
    if (!license.valid) {
      return {
        success: false,
        error: license.error || 'Copia no activada o licencia revocada. Se requiere una licencia activa para descargar música.'
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
        if (progressData && progressData.status === 'completed' && progressData.track) {
          const t = progressData.track;
          const k = `${t.artists || ''} - ${t.name || ''}`.toLowerCase().trim();
          if (t.cover_url) {
            saveDownloadedMetadata(k, {
              cover_url: t.cover_url,
              album: t.album || ''
            });
          }
        }
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
