const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class DownloaderService {
  constructor() {
    this.activeProcesses = new Map(); // trackId -> childProcess
    this.queue = [];
    this.runningCount = 0;
    this.maxConcurrency = 3;
    this.isCancelled = false;
    this.onProgressCallback = null;

    this.ytDlpPath = this.resolveExecutable('yt-dlp');
    this.ffmpegPath = this.resolveExecutable('ffmpeg');
  }

  getSearchPaths(name) {
    const isWin = process.platform === 'win32';
    const binaryName = isWin && !name.endsWith('.exe') ? `${name}.exe` : name;
    const platformFolder = isWin ? 'win' : 'mac';
    const paths = [];

    // 1. Packaged electron app resources path (process.resourcesPath/bin)
    if (process.resourcesPath) {
      paths.push(path.join(process.resourcesPath, 'bin', binaryName));
      paths.push(path.join(process.resourcesPath, binaryName));
    }

    // 2. Dev environment (bin/<platform>/ or bin/)
    paths.push(path.join(__dirname, '..', '..', 'bin', platformFolder, binaryName));
    paths.push(path.join(__dirname, '..', '..', 'bin', binaryName));

    // 3. User data directory if dynamically downloaded
    try {
      const { app } = require('electron');
      if (app && app.getPath) {
        paths.push(path.join(app.getPath('userData'), 'bin', binaryName));
      }
    } catch (e) {}

    // 4. Standard system paths
    if (isWin) {
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      paths.push(path.join(localAppData, 'Programs', 'yt-dlp', binaryName));
      paths.push(path.join(programFiles, 'yt-dlp', binaryName));
      paths.push(path.join(programFiles, 'ffmpeg', 'bin', binaryName));
      paths.push(`C:\\yt-dlp\\${binaryName}`);
      paths.push(`C:\\ffmpeg\\bin\\${binaryName}`);
    } else {
      paths.push('/opt/homebrew/bin/' + binaryName);
      paths.push('/usr/local/bin/' + binaryName);
      paths.push(path.join(process.env.HOME || '', '.local/bin', binaryName));
    }

    return paths;
  }

  resolveExecutable(name, customPaths = []) {
    const isWin = process.platform === 'win32';
    const binaryName = isWin && !name.endsWith('.exe') ? `${name}.exe` : name;
    const allPaths = [...this.getSearchPaths(name), ...customPaths];

    for (const p of allPaths) {
      if (p && fs.existsSync(p)) {
        try {
          if (process.platform === 'darwin') {
            try { execSync(`chmod +x "${p}" 2>/dev/null; xattr -d com.apple.quarantine "${p}" 2>/dev/null || true`); } catch (e) {}
          }
          fs.accessSync(p, fs.constants.X_OK);
          return p;
        } catch (e) {
          if (isWin || fs.existsSync(p)) return p;
        }
      }
    }

    try {
      const checkCmd = isWin ? `where ${binaryName}` : `which ${binaryName}`;
      const detected = execSync(checkCmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
      if (detected && fs.existsSync(detected)) return detected;
    } catch (e) {
      // Not found via which / where
    }
    return null;
  }

  checkDependencies() {
    this.ytDlpPath = this.resolveExecutable('yt-dlp');
    this.ffmpegPath = this.resolveExecutable('ffmpeg');

    return {
      ytDlp: {
        available: !!this.ytDlpPath,
        path: this.ytDlpPath || 'No encontrado'
      },
      ffmpeg: {
        available: !!this.ffmpegPath,
        path: this.ffmpegPath || 'No encontrado'
      }
    };
  }

  cleanFilename(str) {
    if (!str) return 'track';
    return str.replace(/[\\/:*?"<>|]/g, '').trim();
  }

  getFormatFlags(format) {
    switch (format) {
      case 'mp3-320':
        return { ext: 'mp3', quality: '320k' };
      case 'mp3-192':
        return { ext: 'mp3', quality: '192k' };
      case 'flac':
        return { ext: 'flac', quality: '0' };
      case 'm4a':
        return { ext: 'm4a', quality: '256k' };
      case 'opus':
        return { ext: 'opus', quality: '0' };
      case 'wav':
        return { ext: 'wav', quality: '0' };
      default:
        return { ext: 'mp3', quality: '320k' };
    }
  }

  notify(trackId, data) {
    if (this.onProgressCallback) {
      this.onProgressCallback({
        trackId,
        ...data
      });
    }
  }

  async startBatch(tracks, options, progressCallback) {
    this.onProgressCallback = progressCallback;
    this.isCancelled = false;
    this.maxConcurrency = options.concurrency || 3;
    const downloadDir = options.downloadDir;
    const formatKey = options.format || 'mp3-320';

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Filter tracks not already in queue
    for (const track of tracks) {
      this.queue.push({
        track,
        downloadDir,
        formatKey
      });
      this.notify(track.id, {
        status: 'queued',
        percent: 0,
        message: 'En cola...'
      });
    }

    this.processQueue();
  }

  processQueue() {
    if (this.isCancelled) return;

    while (this.runningCount < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.runningCount++;
      this.downloadTrack(item.track, item.downloadDir, item.formatKey)
        .finally(() => {
          this.runningCount--;
          this.processQueue();
        });
    }
  }

  downloadTrack(track, downloadDir, formatKey) {
    return new Promise((resolve) => {
      const trackId = track.id;
      const { ext, quality } = this.getFormatFlags(formatKey);

      const artistClean = this.cleanFilename(track.artists);
      const titleClean = this.cleanFilename(track.name);
      const outputPattern = path.join(downloadDir, `${artistClean} - ${titleClean}.%(ext)s`);

      this.notify(trackId, {
        status: 'searching',
        percent: 5,
        message: 'Buscando en YouTube...'
      });

      // Prepare clean search query
      const cleanName = (track.name || '').replace(/\(feat\.[^)]+\)/gi, '').replace(/\(ft\.[^)]+\)/gi, '').trim();
      const firstArtist = (track.artists || '').split(/[,&/]/)[0].trim();
      const searchQuery = `ytsearch3:${cleanName} ${firstArtist} official audio`;

      const args = [
        '--extractor-args', 'youtube:player_client=android,web',
        searchQuery,
        '-x',
        '--audio-format', ext,
        '--audio-quality', quality,
        '--no-playlist',
        '--no-warnings',
        '--embed-thumbnail',
        '--add-metadata',
        '--newline',
        '--output', outputPattern
      ];

      if (track.duration_ms && track.duration_ms > 45000) {
        const maxDur = Math.round((track.duration_ms / 1000) * 1.25);
        const minDur = Math.round((track.duration_ms / 1000) * 0.75);
        args.push('--match-filter', `duration <= ${maxDur} & duration >= ${minDur}`);
      }

      if (this.ffmpegPath) {
        args.push('--ffmpeg-location', this.ffmpegPath);
      }

      const ytExecutable = this.ytDlpPath || 'yt-dlp';
      let child;
      let downloadTimeout = null;

      try {
        child = spawn(ytExecutable, args, {
          env: {
            ...process.env,
            PATH: `${path.dirname(this.ffmpegPath || '')}:${process.env.PATH}`
          }
        });
        this.activeProcesses.set(trackId, child);

        // Safety timeout: 4 minutes max per track
        downloadTimeout = setTimeout(() => {
          if (this.activeProcesses.has(trackId)) {
            try { child.kill('SIGKILL'); } catch (e) {}
            this.activeProcesses.delete(trackId);
            this.notify(trackId, {
              status: 'error',
              percent: 0,
              error: 'Tiempo de espera agotado al descargar la pista (timeout)'
            });
            resolve(false);
          }
        }, 240000);
      } catch (err) {
        if (downloadTimeout) clearTimeout(downloadTimeout);
        this.notify(trackId, {
          status: 'error',
          percent: 0,
          error: `Error al iniciar yt-dlp: ${err.message}`
        });
        return resolve(false);
      }

      let lastStderr = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        // Parse download percentage: [download]  45.2% of 4.12MiB at 1.20MiB/s ETA 00:03
        const downloadMatch = text.match(/\[download\]\s+([\d\.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
        if (downloadMatch) {
          const percent = parseFloat(downloadMatch[1]);
          const size = downloadMatch[2];
          const speed = downloadMatch[3];
          const eta = downloadMatch[4];

          this.notify(trackId, {
            status: 'downloading',
            percent: Math.min(Math.round(percent * 0.85), 85), // scale 0-85%
            speed: speed,
            eta: eta,
            message: `Descargando: ${percent.toFixed(0)}% (${speed})`
          });
          return;
        }

        if (text.includes('[ExtractAudio]') || text.includes('[ffmpeg]')) {
          this.notify(trackId, {
            status: 'converting',
            percent: 90,
            message: `Convirtiendo a ${ext.toUpperCase()}...`
          });
          return;
        }

        if (text.includes('[EmbedThumbnail]') || text.includes('[Metadata]')) {
          this.notify(trackId, {
            status: 'converting',
            percent: 96,
            message: 'Incrustando carátula y metadatos...'
          });
          return;
        }
      });

      child.stderr.on('data', (data) => {
        lastStderr += data.toString();
      });

      child.on('close', (code) => {
        if (downloadTimeout) clearTimeout(downloadTimeout);
        this.activeProcesses.delete(trackId);
        if (code === 0) {
          this.notify(trackId, {
            status: 'completed',
            percent: 100,
            message: '¡Descarga completada!',
            track
          });
          resolve(true);
        } else {
          // If was killed intentionally
          if (child.killed) {
            this.notify(trackId, {
              status: 'cancelled',
              percent: 0,
              message: 'Descarga cancelada'
            });
          } else {
            console.error(`yt-dlp failed for ${track.name}:`, lastStderr);
            this.notify(trackId, {
              status: 'error',
              percent: 0,
              error: `Error al procesar: ${lastStderr.slice(-150) || 'Error desconocido'}`
            });
          }
          resolve(false);
        }
      });

      child.on('error', (err) => {
        if (downloadTimeout) clearTimeout(downloadTimeout);
        this.activeProcesses.delete(trackId);
        this.notify(trackId, {
          status: 'error',
          percent: 0,
          error: `Error de ejecución: ${err.message}`
        });
        resolve(false);
      });
    });
  }

  cancelTrack(trackId) {
    // Remove from queue if not started
    const queueIdx = this.queue.findIndex(item => item.track.id === trackId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      this.notify(trackId, {
        status: 'cancelled',
        percent: 0,
        message: 'Cancelado'
      });
      return true;
    }

    // Kill active process
    const proc = this.activeProcesses.get(trackId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(trackId);
      this.notify(trackId, {
        status: 'cancelled',
        percent: 0,
        message: 'Cancelado'
      });
      return true;
    }
    return false;
  }

  cancelAll() {
    this.isCancelled = true;
    // Clear pending
    for (const item of this.queue) {
      this.notify(item.track.id, {
        status: 'cancelled',
        percent: 0,
        message: 'Cancelado'
      });
    }
    this.queue = [];

    // Kill active
    for (const [trackId, proc] of this.activeProcesses.entries()) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {}
      this.notify(trackId, {
        status: 'cancelled',
        percent: 0,
        message: 'Cancelado'
      });
    }
    this.activeProcesses.clear();
    this.runningCount = 0;
  }

  async getAudioStreamUrl(title, artist, durationMs = 0) {
    if (!this.ytDlpPath || !fs.existsSync(this.ytDlpPath)) {
      this.ytDlpPath = this.resolveExecutable('yt-dlp', ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']);
    }
    if (!this.ytDlpPath) return null;

    const cleanTitle = (title || '').replace(/\(feat\.[^)]+\)/gi, '').replace(/\(ft\.[^)]+\)/gi, '').trim();
    const firstArtist = (artist || '').split(/[,&/]/)[0].trim();
    const query = `ytsearch3:${cleanTitle} ${firstArtist} official audio`;
    return new Promise((resolve) => {
      const args = [
        '--no-warnings',
        '--no-playlist',
        '--js-runtimes', 'node',
        '--extractor-args', 'youtube:player_client=android,web',
        '-g',
        '-f', '140/bestaudio/best',
        query
      ];

      if (durationMs && durationMs > 45000) {
        const maxDur = Math.round((durationMs / 1000) * 1.25);
        const minDur = Math.round((durationMs / 1000) * 0.75);
        args.push('--match-filter', `duration <= ${maxDur} & duration >= ${minDur}`);
      }

      let child;
      try {
        child = spawn(this.ytDlpPath, args, {
          env: {
            ...process.env,
            PATH: `${path.dirname(this.ffmpegPath || '')}:${process.env.PATH}`
          }
        });
      } catch (e) {
        return resolve(null);
      }

      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          const lines = stdout.trim().split('\n').filter((l) => l.startsWith('http'));
          resolve(lines[0] || null);
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));

      setTimeout(() => {
        try { child.kill('SIGTERM'); } catch (e) {}
        resolve(null);
      }, 20000);
    });
  }
}

module.exports = new DownloaderService();
