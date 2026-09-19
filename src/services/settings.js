const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

class SettingsService {
  constructor() {
    // Default download directory: ~/Downloads/SnapMusic
    const defaultDownloads = path.join(os.homedir(), 'Downloads', 'SnapMusic');

    this.defaultSettings = {
      spotifyClientId: 'e0e9be08cc8f4815a6b726ee648016f2',
      spotifyClientSecret: '',
      downloadDir: defaultDownloads,
      defaultFormat: 'mp3-320', // mp3-320, mp3-192, flac, m4a, opus, wav
      concurrency: 3, // 1 to 5 parallel downloads
      embedCover: true,
      embedMetadata: true
    };

    this.configPath = path.join(app.getPath('userData'), 'snapmusic-config.json');
    this.ensureDownloadDir(defaultDownloads);
  }

  ensureDownloadDir(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (err) {
      console.error('Error creating default download directory:', err);
    }
  }

  getSettings() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(data);
        return {
          ...this.defaultSettings,
          ...parsed,
          spotifyClientId: (parsed.spotifyClientId && parsed.spotifyClientId.trim()) || this.defaultSettings.spotifyClientId,
          spotifyClientSecret: (parsed.spotifyClientSecret && parsed.spotifyClientSecret.trim()) || this.defaultSettings.spotifyClientSecret
        };
      }
    } catch (err) {
      console.error('Error reading settings file, returning defaults:', err);
    }
    return { ...this.defaultSettings };
  }

  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf8');
      
      if (updated.downloadDir) {
        this.ensureDownloadDir(updated.downloadDir);
      }
      return { success: true, settings: updated };
    } catch (err) {
      console.error('Error saving settings:', err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new SettingsService();
