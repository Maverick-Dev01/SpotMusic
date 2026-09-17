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

    this.ytDlpPath = this.resolveExecutable('yt-dlp', [
      '/opt/homebrew/bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      path.join(process.env.HOME || '', '.local/bin/yt-dlp')
    ]);

    this.ffmpegPath = this.resolveExecutable('ffmpeg', [
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg'
    ]);
  }

  resolveExecutable(name, customPaths = []) {
    const isWin = process.platform === 'win32';
    const binaryName = isWin && !name.endsWith('.exe') ? `${name}.exe` : name;

    for (const p of customPaths) {
      if (fs.existsSync(p)) return p;
      if (isWin && !p.endsWith('.exe') && fs.existsSync(`${p}.exe`)) return `${p}.exe`;
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
    // Re-check in case paths changed
    if (!this.ytDlpPath || !fs.existsSync(this.ytDlpPath)) {
      this.ytDlpPath = this.resolveExecutable('yt-dlp', ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']);
    }
    if (!this.ffmpegPath || !fs.existsSync(this.ffmpegPath)) {
      this.ffmpegPath = this.resolveExecutable('ffmpeg', ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']);
    }

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

      // Prepare search query
      const searchQuery = `ytsearch1:${track.name} ${track.artists} audio`;

      const args = [
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

      if (this.ffmpegPath) {
        args.push('--ffmpeg-location', this.ffmpegPath);
      }

      const ytExecutable = this.ytDlpPath || 'yt-dlp';
      let child;

      try {
        child = spawn(ytExecutable, args, {
          env: {
            ...process.env,
            PATH: `${path.dirname(this.ffmpegPath || '')}:${process.env.PATH}`
          }
        });
        this.activeProcesses.set(trackId, child);
      } catch (err) {
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
        this.activeProcesses.delete(trackId);
        if (code === 0) {
          this.notify(trackId, {
            status: 'completed',
            percent: 100,
            message: '¡Descarga completada!'
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

  async getAudioStreamUrl(title, artist) {
    if (!this.ytDlpPath || !fs.existsSync(this.ytDlpPath)) {
      this.ytDlpPath = this.resolveExecutable('yt-dlp', ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']);
    }
    if (!this.ytDlpPath) return null;

    const query = `ytsearch1:${title} ${artist} audio`;
    return new Promise((resolve) => {
      const args = [
        query,
        '-g',
        '-f', '140/bestaudio/best',
        '--no-playlist',
        '--no-warnings'
      ];

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
      }, 9000);
    });
  }
}

module.exports = new DownloaderService();
