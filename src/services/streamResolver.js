const CryptoJS = require('crypto-js');

class StreamResolver {
  constructor() {
    this.cache = new Map();
    this.cachedAt = new Map();
    this.pending = new Map();
    this.scClientId = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
    this.backupScClientIds = [
      'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo',
      'b7h4Jv4c0iFh3eU08K8k0K944J23t40F',
      'y5bYq3fR78uK13H5k2A78L00p44J22x1'
    ];
    this.downloaderService = null;
  }

  setDownloaderService(ds) {
    this.downloaderService = ds;
  }

  cleanTitle(title) {
    if (!title) return '';
    return title
      .replace(/\(feat\.[^)]+\)/gi, '')
      .replace(/\(ft\.[^)]+\)/gi, '')
      .replace(/\(official[^)]*\)/gi, '')
      .replace(/\(video[^)]*\)/gi, '')
      .replace(/\[official[^\]]*\]/gi, '')
      .replace(/\s*-\s*(Remaster(ed)?\s*\d*|Live|Radio Edit|Acoustic|Single Version|Bonus Track|Deluxe).*$/i, '')
      .replace(/\s*\((feat\.|ft\.|with\b|remaster(ed)?|live|radio edit|acoustic|version|mono|stereo).*?\)/gi, '')
      .replace(/\s*\[(feat\.|ft\.|with\b|remaster(ed)?|live|radio edit|acoustic|version|mono|stereo).*?\]/gi, '')
      .trim();
  }

  normalize(value) {
    if (!value) return '';
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\b(feat|ft|official|audio|video|lyrics?|remaster(?:ed)?|version)\b.*$/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  similarity(expected, actual) {
    const a = new Set(this.normalize(expected).split(' ').filter(Boolean));
    const b = new Set(this.normalize(actual).split(' ').filter(Boolean));
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter(token => b.has(token)).length;
    return (2 * intersection) / (a.size + b.size);
  }

  matchScore(title, artist, durationMs, candidate) {
    const titleScore = this.similarity(this.cleanTitle(title), candidate.title || '');
    const firstArtist = (artist || '').split(/[,&/]/)[0].trim();
    const artistScore = this.similarity(firstArtist, candidate.artist || '');
    const durationScore = durationMs && candidate.durationMs
      ? Math.max(0, 1 - Math.abs(durationMs - candidate.durationMs) / Math.max(durationMs, 1))
      : 0.5;

    // Reject poor matches
    if (titleScore < 0.65) return 0;
    return titleScore * 0.65 + artistScore * 0.25 + durationScore * 0.1;
  }

  bestMatch(title, artist, durationMs, candidates) {
    const ranked = candidates
      .map(candidate => ({ candidate, score: this.matchScore(title, artist, durationMs, candidate) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 0.65) return null;
    return { ...best.candidate, matchScore: best.score };
  }

  decryptJioMediaUrl(encUrl) {
    try {
      const key = CryptoJS.enc.Utf8.parse('38346591');
      const decrypted = CryptoJS.DES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encUrl) },
        key,
        {
          mode: CryptoJS.mode.ECB,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      const url = decrypted.toString(CryptoJS.enc.Utf8);
      if (!url || !url.startsWith('http')) return null;
      return url;
    } catch (e) {
      return null;
    }
  }

  formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async resolveJioSaavn(title, artist, durationMs) {
    try {
      const cleanT = this.cleanTitle(title);
      const firstArtist = (artist || '').split(/[,&/]/)[0].trim();
      const query = `${cleanT} ${firstArtist}`.trim();
      const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&n=8&p=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.results || !data.results.length) return null;

      const candidates = [];
      for (const item of data.results) {
        if (item.encrypted_media_url) {
          let streamUrl = this.decryptJioMediaUrl(item.encrypted_media_url);
          if (streamUrl) {
            // Upgrade to 320kbps when available
            const highQualityUrl = streamUrl.replace(/_96\.(mp4|m4a|mp3)/i, '_320.$1');
            const durSec = parseInt(item.duration, 10) || 180;
            const cleanName = (item.song || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
            const cleanArt = (item.singers || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");

            candidates.push({
              audioUrl: highQualityUrl || streamUrl,
              durationMs: durSec * 1000,
              durationStr: this.formatDuration(durSec),
              format: '320kbps AAC (Full)',
              source: 'jiosaavn',
              coverUrl: item.image ? item.image.replace('150x150', '500x500') : null,
              title: cleanName,
              artist: cleanArt
            });
          }
        }
      }

      return this.bestMatch(title, artist, durationMs, candidates);
    } catch (e) {
      return null;
    }
  }

  async resolveYouTube(title, artist) {
    if (!this.downloaderService || typeof this.downloaderService.getAudioStreamUrl !== 'function') {
      return null;
    }
    try {
      const cleanT = this.cleanTitle(title);
      const firstArtist = (artist || '').split(/[,&/]/)[0].trim();
      const streamUrl = await this.downloaderService.getAudioStreamUrl(cleanT || title, firstArtist || artist);
      if (streamUrl && streamUrl.startsWith('http')) {
        return {
          audioUrl: streamUrl,
          durationMs: 0,
          format: 'YouTube Direct Audio (Full)',
          source: 'youtube',
          title: title,
          artist: artist
        };
      }
    } catch (e) {}
    return null;
  }

  async resolveSoundCloud(title, artist, durationMs) {
    const cleanT = this.cleanTitle(title);
    const firstArtist = (artist || '').split(/[,&/]/)[0].trim();
    const query = `${cleanT} ${firstArtist}`.trim();
    const clientIds = [this.scClientId, ...this.backupScClientIds];

    for (const cId of clientIds) {
      try {
        const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${cId}&limit=4`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data || !data.collection || !data.collection.length) continue;

        for (const track of data.collection) {
          const prog = track.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
          if (prog && prog.url) {
            const streamRes = await fetch(`${prog.url}?client_id=${cId}`, { signal: AbortSignal.timeout(3000) });
            if (streamRes.ok) {
              const streamData = await streamRes.json();
              if (streamData.url) {
                const durSec = Math.round((track.duration || 180000) / 1000);
                return {
                  audioUrl: streamData.url,
                  durationMs: durSec * 1000,
                  durationStr: this.formatDuration(durSec),
                  format: 'SoundCloud MP3 (Full)',
                  source: 'soundcloud',
                  coverUrl: track.artwork_url ? track.artwork_url.replace('large', 't500x500') : null,
                  title: track.title,
                  artist: track.user?.username
                };
              }
            }
          }
        }
      } catch (e) {}
    }
    return null;
  }

  async resolveFullAudio(title, artist, durationMs, fallbackPreviewUrl = null) {
    const key = `${this.cleanTitle(title)}---${artist}`.toLowerCase().trim();
    const now = Date.now();

    // 1. Check cache (5 min TTL)
    if (this.cache.has(key)) {
      const cachedTime = this.cachedAt.get(key) || 0;
      if (now - cachedTime < 300000) {
        return this.cache.get(key);
      }
      this.cache.delete(key);
      this.cachedAt.delete(key);
    }

    // 2. Reuse in-flight request if deduplicating
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = (async () => {
      // Tier 1: JioSaavn (Fast, Full 320kbps CDNs)
      const jioResult = await this.resolveJioSaavn(title, artist, durationMs);
      if (jioResult && jioResult.audioUrl) {
        return jioResult;
      }

      // Tier 2: YouTube direct stream extraction
      const ytResult = await this.resolveYouTube(title, artist);
      if (ytResult && ytResult.audioUrl) {
        return ytResult;
      }

      // Tier 3: SoundCloud progressive stream
      const scResult = await this.resolveSoundCloud(title, artist, durationMs);
      if (scResult && scResult.audioUrl) {
        return scResult;
      }

      // Tier 4: Fallback to 30s preview (Spotify / iTunes)
      if (fallbackPreviewUrl) {
        return {
          audioUrl: fallbackPreviewUrl,
          durationMs: 30000,
          durationStr: '0:30',
          format: 'Vista Previa (30s)',
          source: 'preview'
        };
      }

      return null;
    })();

    this.pending.set(key, promise);

    try {
      const result = await promise;
      if (result) {
        this.cache.set(key, result);
        this.cachedAt.set(key, Date.now());
      }
      return result;
    } finally {
      this.pending.delete(key);
    }
  }
}

module.exports = new StreamResolver();
