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

  findPlatformAsset(assets, platform, arch) {
    if (!Array.isArray(assets) || assets.length === 0) return null;

    if (platform === 'darwin') {
      const dmgs = assets.filter(a => a.name && a.name.toLowerCase().endsWith('.dmg'));
      if (arch === 'arm64') {
        const armDmg = dmgs.find(a => {
          const n = a.name.toLowerCase();
          return n.includes('arm64') || n.includes('aarch64');
        });
        if (armDmg) return armDmg;
        const generalDmg = dmgs.find(a => {
          const n = a.name.toLowerCase();
          return !n.includes('x64') && !n.includes('intel') && !n.includes('x86_64');
        });
        if (generalDmg) return generalDmg;
      } else {
        const intelDmg = dmgs.find(a => {
          const n = a.name.toLowerCase();
          return n.includes('x64') || n.includes('intel') || n.includes('x86_64');
        });
        if (intelDmg) return intelDmg;
        const nonArmDmg = dmgs.find(a => {
          const n = a.name.toLowerCase();
          return !n.includes('arm64') && !n.includes('aarch64');
        });
        if (nonArmDmg) return nonArmDmg;
      }
      if (dmgs.length > 0) return dmgs[0];

      const zips = assets.filter(a => a.name && a.name.toLowerCase().endsWith('.zip') && a.name.toLowerCase().includes('mac'));
      if (arch === 'arm64') {
        const armZip = zips.find(a => a.name.toLowerCase().includes('arm64'));
        if (armZip) return armZip;
      }
      if (zips.length > 0) return zips[0];
    } else if (platform === 'win32') {
      const exes = assets.filter(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.exe') && !n.includes('uninstaller') && !n.endsWith('.blockmap');
      });
      const setupExe = exes.find(a => {
        const n = a.name.toLowerCase();
        return n.includes('setup') || n.includes('installer');
      });
      if (setupExe) return setupExe;
      if (exes.length > 0) return exes[0];
    } else if (platform === 'linux') {
      const appImages = assets.filter(a => a.name && a.name.toLowerCase().endsWith('.appimage'));
      const archKey = arch === 'arm64' ? 'arm64' : 'x86_64';
      const matchedAppImage = appImages.find(a => {
        const n = a.name.toLowerCase();
        return n.includes(archKey) || n.includes('amd64');
      });
      if (matchedAppImage) return matchedAppImage;
      if (appImages.length > 0) return appImages[0];

      const debs = assets.filter(a => a.name && a.name.toLowerCase().endsWith('.deb'));
      if (debs.length > 0) return debs[0];
    }

    return null;
  }

  async checkForUpdates(customUrl = null) {
    const targetUrl = customUrl || `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases`;

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
              const parsed = JSON.parse(data);
              const releases = Array.isArray(parsed) ? parsed : [parsed];

              if (releases.length === 0) {
                return resolve({
                  hasUpdate: false,
                  currentVersion: this.currentVersion,
                  message: 'No se encontraron versiones en el repositorio.'
                });
              }

              let candidateRelease = null;
              let candidateAsset = null;
              let candidateVersion = null;

              for (const rel of releases) {
                const tagName = rel.tag_name || rel.version || '';
                const relVersion = tagName.replace(/^v/, '').trim();
                if (!this.isNewerVersion(relVersion, this.currentVersion)) {
                  break;
                }

                const asset = this.findPlatformAsset(rel.assets, process.platform, process.arch);
                if (asset) {
                  candidateRelease = rel;
                  candidateAsset = asset;
                  candidateVersion = relVersion;
                  break;
                }
              }

              if (!candidateRelease || !candidateAsset) {
                const newestRel = releases[0];
                const newestTag = (newestRel.tag_name || newestRel.version || '').replace(/^v/, '').trim();
                const isNewerTag = this.isNewerVersion(newestTag, this.currentVersion);

                return resolve({
                  hasUpdate: false,
                  currentVersion: this.currentVersion,
                  latestVersion: isNewerTag ? newestTag : this.currentVersion,
                  message: isNewerTag
                    ? `La versión ${newestTag} está disponible pero no contiene instaladores para tu sistema (${process.platform} ${process.arch}).`
                    : `Tu versión (${this.currentVersion}) está al día.`
                });
              }

              resolve({
                hasUpdate: true,
                currentVersion: this.currentVersion,
                latestVersion: candidateVersion,
                releaseName: candidateRelease.name || `Versión ${candidateVersion}`,
                releaseNotes: candidateRelease.body || 'Correcciones y mejoras generales.',
                publishedAt: candidateRelease.published_at || '',
                downloadUrl: candidateAsset.browser_download_url,
                fileName: candidateAsset.name,
                fileSize: candidateAsset.size
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
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return reject(new Error('URL de descarga inválida.'));
      }
      if (!targetPath) {
        return reject(new Error('Ruta de destino inválida.'));
      }

      const handleRequest = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 8) return reject(new Error('Demasiadas redirecciones en la descarga'));

        const urlObj = new URL(currentUrl);
        const client = urlObj.protocol === 'http:' ? http : https;

        const req = client.get(currentUrl, {
          headers: {
            'User-Agent': 'SpotMusic-Desktop-App',
            'Accept': '*/*'
          }
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith('http')) {
              nextUrl = new URL(nextUrl, currentUrl).href;
            }
            return handleRequest(nextUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error en descarga: HTTP ${res.statusCode}`));
          }

          const contentType = (res.headers['content-type'] || '').toLowerCase();
          if (contentType.includes('text/html') && !targetPath.endsWith('.html')) {
            return reject(new Error('El servidor devolvió una página HTML en lugar de un archivo binario de instalación.'));
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
            fileStream.close(() => {
              try {
                const stats = fs.statSync(targetPath);
                if (stats.size < 1024 * 100) {
                  fs.unlink(targetPath, () => {});
                  return reject(new Error('El archivo descargado está incompleto o dañado (< 100KB).'));
                }
              } catch (e) {}
              resolve(targetPath);
            });
          });

          fileStream.on('error', (err) => {
            fs.unlink(targetPath, () => {});
            reject(err);
          });
        });

        req.on('error', (err) => {
          fs.unlink(targetPath, () => {});
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

    const ext = path.extname(filePath).toLowerCase();

    if (process.platform === 'win32') {
      if (ext !== '.exe') {
        throw new Error('El archivo de actualización de Windows debe ser un ejecutable (.exe).');
      }
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
      if (ext !== '.dmg' && ext !== '.zip') {
        throw new Error('El archivo de actualización para macOS debe ser .dmg o .zip');
      }

      const scriptPath = path.join(app.getPath('temp'), 'spotmusic_mac_updater.sh');
      const isDmg = ext === '.dmg';

      const scriptContent = `#!/bin/bash
sleep 1.2
TARGET_FILE="${filePath.replace(/"/g, '\\"')}"

if [ "${isDmg}" = "true" ]; then
  if [ -d "/Applications/SpotMusic.app" ]; then
    MOUNT_POINT=$(hdiutil attach -nobrowse -readonly "$TARGET_FILE" 2>/dev/null | grep -o '/Volumes/.*' | head -n 1)
    if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT/SpotMusic.app" ]; then
      rm -rf "/Applications/SpotMusic.app"
      cp -R "$MOUNT_POINT/SpotMusic.app" "/Applications/SpotMusic.app"
      hdiutil detach "$MOUNT_POINT" -force >/dev/null 2>&1
      open -a "/Applications/SpotMusic.app"
      exit 0
    fi
  fi
  open "$TARGET_FILE"
else
  EXTRACT_DIR="/tmp/spotmusic_extracted_$$"
  mkdir -p "$EXTRACT_DIR"
  unzip -q "$TARGET_FILE" -d "$EXTRACT_DIR" 2>/dev/null
  if [ -d "$EXTRACT_DIR/SpotMusic.app" ]; then
    if [ -d "/Applications/SpotMusic.app" ]; then
      rm -rf "/Applications/SpotMusic.app"
      cp -R "$EXTRACT_DIR/SpotMusic.app" "/Applications/SpotMusic.app"
      open -a "/Applications/SpotMusic.app"
      rm -rf "$EXTRACT_DIR"
      exit 0
    fi
    open "$EXTRACT_DIR"
  fi
fi
`;

      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      setTimeout(() => {
        app.quit();
      }, 500);

      return { success: true };

    } else if (process.platform === 'linux') {
      if (ext === '.appimage') {
        fs.chmodSync(filePath, 0o755);
        const child = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        setTimeout(() => {
          app.quit();
        }, 500);
        return { success: true };
      } else {
        await shell.openPath(filePath);
        setTimeout(() => {
          app.quit();
        }, 1000);
        return { success: true };
      }
    } else {
      await shell.openPath(filePath);
      return { success: true };
    }
  }
}

module.exports = new UpdaterService();
