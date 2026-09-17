const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const { spawn } = require('child_process');

class UpdaterService {
  constructor() {
    this.currentVersion = require('../../package.json').version || '1.0.0';
    this.repoOwner = 'Maverick-Dev01';
    this.repoName = 'SpotMusic';
    this.downloading = false;
  }

  isNewerVersion(latest, current) {
    const cleanL = (latest || '').replace(/^v/, '').trim();
    const cleanC = (current || '').replace(/^v/, '').trim();
    const pL = cleanL.split('.').map(n => parseInt(n, 10) || 0);
    const pC = cleanC.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(pL.length, pC.length); i++) {
      const vL = pL[i] || 0;
      const vC = pC[i] || 0;
      if (vL > vC) return true;
      if (vL < vC) return false;
    }
    return false;
  }

  async checkForUpdates(customUrl = null) {
    const targetUrl = customUrl || `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;

    return new Promise((resolve) => {
      try {
        const urlObj = new URL(targetUrl);
        const client = urlObj.protocol === 'http:' ? http : https;

        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          headers: {
            'User-Agent': 'SpotMusic-Desktop-App',
            'Accept': 'application/vnd.github.v3+json,application/json'
          }
        };

        const req = client.get(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 404) {
              return resolve({
                hasUpdate: false,
                currentVersion: this.currentVersion,
                message: 'No hay versiones publicadas aún en el repositorio.'
              });
            }

            if (res.statusCode >= 400) {
              return resolve({
                hasUpdate: false,
                currentVersion: this.currentVersion,
                error: `Error al comprobar actualizaciones (HTTP ${res.statusCode})`
              });
            }

            try {
              const release = JSON.parse(data);
              const tagName = release.tag_name || release.version || '';
              const latestVersion = tagName.replace(/^v/, '');
              const hasUpdate = this.isNewerVersion(latestVersion, this.currentVersion);

              let assetUrl = null;
              let assetName = null;
              let assetSize = 0;

              const isWin = process.platform === 'win32';
              const isMac = process.platform === 'darwin';

              if (Array.isArray(release.assets)) {
                for (const asset of release.assets) {
                  const name = asset.name.toLowerCase();
                  if (isWin && (name.endsWith('.exe') && !name.includes('uninstaller'))) {
                    assetUrl = asset.browser_download_url;
                    assetName = asset.name;
                    assetSize = asset.size;
                    break;
                  }
                  if (isMac && name.endsWith('.dmg')) {
                    assetUrl = asset.browser_download_url;
                    assetName = asset.name;
                    assetSize = asset.size;
                    break;
                  }
                }
              }

              resolve({
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion,
                releaseName: release.name || `Versión ${latestVersion}`,
                releaseNotes: release.body || 'Correcciones y mejoras generales.',
                publishedAt: release.published_at || '',
                downloadUrl: assetUrl || release.html_url || '',
                fileName: assetName,
                fileSize: assetSize
              });
            } catch (parseErr) {
              resolve({
                hasUpdate: false,
                currentVersion: this.currentVersion,
                error: 'Respuesta de actualización inválida: ' + parseErr.message
              });
            }
          });
        });

        req.on('error', (err) => {
          resolve({
            hasUpdate: false,
            currentVersion: this.currentVersion,
            error: 'No se pudo conectar con el servidor de actualizaciones: ' + err.message
          });
        });
      } catch (err) {
        resolve({
          hasUpdate: false,
          currentVersion: this.currentVersion,
          error: err.message
        });
      }
    });
  }

  downloadFileWithProgress(url, targetPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const handleRequest = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 5) return reject(new Error('Demasiadas redirecciones en la descarga'));

        const urlObj = new URL(currentUrl);
        const client = urlObj.protocol === 'http:' ? http : https;

        client.get(currentUrl, {
          headers: { 'User-Agent': 'SpotMusic-Desktop-App' }
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return handleRequest(res.headers.location, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error en descarga: HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          const fileStream = fs.createWriteStream(targetPath);

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (progressCallback && totalBytes > 0) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              progressCallback({
                percent,
                downloadedBytes,
                totalBytes,
                mbDownloaded: (downloadedBytes / (1024 * 1024)).toFixed(1),
                mbTotal: (totalBytes / (1024 * 1024)).toFixed(1)
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve(targetPath));
          });

          fileStream.on('error', (err) => {
            fs.unlink(targetPath, () => {});
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      };

      handleRequest(url);
    });
  }

  async installDownloadedUpdate(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('El archivo de actualización no existe.');
    }

    if (process.platform === 'win32') {
      // Launch Windows installer and exit SpotMusic
      const child = spawn(filePath, [], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      setTimeout(() => {
        app.quit();
      }, 500);
      return { success: true };
    } else if (process.platform === 'darwin') {
      // On macOS open the DMG installer
      await shell.openPath(filePath);
      return { success: true, opened: true };
    } else {
      await shell.openPath(filePath);
      return { success: true };
    }
  }
}

module.exports = new UpdaterService();
