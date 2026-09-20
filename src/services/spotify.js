const https = require('https');

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 30,
  keepAliveMsecs: 60000
});

class SpotifyService {
  constructor() {
    this.searchCache = new Map();
    this.searchCacheTTL = 10 * 60 * 1000; // 10 minutes
  }

  extractSpotifyInfo(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();

    // Match playlist: https://open.spotify.com/intl-es/playlist/{id} or https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
    const playlistMatch = clean.match(/playlist[\/:]([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      return { type: 'playlist', id: playlistMatch[1] };
    }

    // Match album: https://open.spotify.com/intl-es/album/{id} or spotify:album:{id}
    const albumMatch = clean.match(/album[\/:]([a-zA-Z0-9]+)/);
    if (albumMatch) {
      return { type: 'album', id: albumMatch[1] };
    }

    // Match track: https://open.spotify.com/intl-es/track/{id} or spotify:track:{id}
    const trackMatch = clean.match(/track[\/:]([a-zA-Z0-9]+)/);
    if (trackMatch) {
      return { type: 'track', id: trackMatch[1] };
    }

    // Match raw 22-character Spotify ID
    if (/^[a-zA-Z0-9]{22}$/.test(clean)) {
      return { type: 'playlist', id: clean };
    }

    return null;
  }

  /**
   * Catalogue search buries the original recording under covers and karaoke
   * versions that share its exact title. Spotify's popularity settles it when it
   * is available; otherwise fall back to what the text reveals.
   */
  rankSearchResults(query, tracks) {
    const VERSION_MARKERS = /(remix|nightcore|slowed|reverb|sped up|speed up|8d|cover|karaoke|instrumental|acapella|a cappella|tribute|originally performed|made famous by|in the style of|live|extended mix|mashup|bootleg|lofi|lo-fi|bass boosted|version|1 hour|10 hours|loop)/i;
    const COVER_FACTORY = /(kidz bop|rockabye baby|lullaby|lullabies|lullapop|karaoke|tribute band|the hit crew|ameritz|zzang|piano tribute|string quartet|8-bit|8 bit)/i;
    const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const wanted = normalize(query);
    const terms = new Set(wanted.split(' ').filter(Boolean));
    const queryWantsVersion = VERSION_MARKERS.test(query || '');

    const score = (track) => {
      const title = normalize(track.name);
      const artist = normalize(track.artists);
      const tokens = new Set(`${title} ${artist}`.split(' ').filter(Boolean));
      let value = (title === wanted || `${title} ${artist}` === wanted || `${artist} ${title}` === wanted ? 2 : 0)
        + (terms.size ? [...terms].filter(term => tokens.has(term)).length / terms.size : 0);
      if (!queryWantsVersion && VERSION_MARKERS.test(`${track.name} ${track.artists}`)) value -= 1.5;
      if (COVER_FACTORY.test(`${track.name} ${track.artists}`)) value -= 2.5;
      if (typeof track.popularity === 'number' && Number.isFinite(track.popularity)) {
        value += Math.max(0, Math.min(100, track.popularity)) / 100 * 3;
      }
      return value;
    };

    // Stable: equal scores keep the provider's own relevance order.
    return tracks
      .map((track, index) => ({ track, index, value: score(track) }))
      .sort((a, b) => b.value - a.value || a.index - b.index)
      .map(entry => entry.track);
  }

  formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async makeHttpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const opts = { agent: httpsAgent, ...options };
      const req = https.request(opts, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              resolve(body);
            }
          } else {
            if (res.statusCode === 403) {
              reject(new Error('Spotify rechazó el acceso (403). El administrador debe autorizar esta cuenta en Spotify Developer si la aplicación está en modo desarrollo. Comprueba también que puedas acceder a la playlist con la cuenta vinculada.'));
              return;
            }
            if (res.statusCode === 401) {
              reject(new Error('La sesión de Spotify venció (401). Desvincula y vuelve a vincular tu cuenta en Ajustes.'));
              return;
            }
            let parsedErr;
            try {
              parsedErr = JSON.parse(body);
            } catch (e) {
              parsedErr = body;
            }
            reject({
              statusCode: res.statusCode,
              error: parsedErr
            });
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.setTimeout(15000, () => {
        req.destroy(new Error('Tiempo de espera agotado al conectar con Spotify'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  async getClientCredentialsToken(clientId, clientSecret) {
    if (this.cachedToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const authHeader = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    const postData = 'grant_type=client_credentials';

    const options = {
      hostname: 'accounts.spotify.com',
      port: 443,
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await this.makeHttpRequest(options, postData);
    if (response && response.access_token) {
      this.cachedToken = response.access_token;
      const expiresInSec = response.expires_in || 3600;
      this.tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000;
      return this.cachedToken;
    }
    throw new Error('No se pudo obtener el token de acceso de Spotify. Revisa tu Client ID y Secret.');
  }

  async testConnection(clientId, clientSecret) {
    try {
      const token = await this.getClientCredentialsToken(clientId, clientSecret);
      return { success: true, tokenPreview: token.substring(0, 10) + '...' };
    } catch (err) {
      const errMsg = err.error?.error_description || err.error?.error || err.message || 'Error de autenticación';
      return { success: false, error: errMsg };
    }
  }

  // Robust embed fetcher that works with all public playlists and tracks
  async fetchFromEmbed(type, id, redirectHops = 0) {
    if (redirectHops > 5) {
      throw new Error('Demasiadas redirecciones al consultar Spotify');
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'open.spotify.com',
        port: 443,
        path: `/embed/${type}/${id}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        }
      };

      const req = https.request(options, (res) => {
        // Handle HTTP redirects (301, 302, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location;
          try {
            const redirectUrl = new URL(loc, 'https://open.spotify.com');
            const newPath = redirectUrl.pathname;
            const newInfo = this.extractSpotifyInfo(newPath);
            if (newInfo) {
              return resolve(this.fetchFromEmbed(newInfo.type, newInfo.id, redirectHops + 1));
            }
          } catch (e) {
            // ignore redirect error and continue
          }
        }

        let html = '';
        res.on('data', chunk => { html += chunk; });
        res.on('end', () => {
          try {
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
            if (!match) {
              return reject(new Error('No se pudieron extraer los datos de la playlist. Asegúrate de que sea pública o que el enlace sea correcto.'));
            }

            const parsed = JSON.parse(match[1]);
            const entity = parsed.props?.pageProps?.state?.data?.entity;
            if (!entity) {
              return reject(new Error('No se encontró información para este enlace de Spotify.'));
            }

            const trackList = entity.trackList || [];
            const coverUrl = entity.coverArt?.sources?.[0]?.url || entity.visualIdentity?.image?.[0]?.url || null;

            const tracks = trackList.map((t, idx) => {
              const trackId = t.id || (t.uri ? t.uri.split(':')[2] : null) || `track-${idx}`;
              return {
                id: trackId,
                name: t.title || t.name || 'Canción sin título',
                artists: t.subtitle || (t.artists ? t.artists.map(a => a.name).join(', ') : 'Desconocido'),
                album: entity.name || '',
                duration_ms: t.duration || t.duration_ms || 0,
                duration_str: this.formatDuration(t.duration || t.duration_ms),
                cover_url: t.thumbnail || coverUrl,
                preview_url: null, // Always resolve full audio stream
                spotify_url: t.uri ? `https://open.spotify.com/track/${t.uri.split(':')[2]}` : ''
              };
            });

            resolve({
              id: id,
              type: type,
              name: entity.name || entity.title || 'Playlist de Spotify',
              description: entity.subtitle || entity.description || '',
              cover_url: coverUrl,
              owner: (entity.authors && entity.authors[0]?.name) || 'Spotify',
              total_tracks: tracks.length,
              tracks: tracks,
              partial: type !== 'track'
            });
          } catch (err) {
            reject(new Error('Error al procesar el listado de Spotify: ' + err.message));
          }
        });
      });

      req.on('error', (e) => reject(new Error('Error de conexión con Spotify: ' + e.message)));
      req.setTimeout(15000, () => req.destroy(new Error('Tiempo de espera agotado al conectar con Spotify')));
      req.end();
    });
  }

  async getPlaylist(inputUrl, clientId = '', clientSecret = '', userToken = '') {
    const info = this.extractSpotifyInfo(inputUrl);
    if (!info) {
      throw new Error('El enlace ingresado no es válido. Debe ser un enlace de Spotify (ej: https://open.spotify.com/playlist/...)');
    }

    // A linked account loads every page, but Spotify answers 404 for its own
    // editorial playlists (Today's Top Hits, Discover Weekly) over the Web API,
    // so linking an account must never be what stops an import: fall through to
    // the public reader on anything that is not an explicit access denial.
    if (info.type === 'playlist' && userToken) {
      try {
        return await this.fetchPlaylistWithApi(info.id, userToken);
      } catch (error) {
        const message = error?.message || '';
        if (/401|403/.test(message)) throw error;
        console.warn('Spotify API import failed, falling back to the public reader:', message);
      }
    }
    // The public embed is only a partial view. Prefer paginated API access.
    if (info.type === 'playlist' && clientId?.trim() && clientSecret?.trim()) {
      try {
        const token = await this.getClientCredentialsToken(clientId, clientSecret);
        return await this.fetchPlaylistWithApi(info.id, token);
      } catch (error) {
        console.warn('Spotify API access unavailable:', error.message);
      }
    }
    try {
      return await this.fetchFromEmbed(info.type, info.id);
    } catch (embedErr) {
      console.warn('Embed extractor falló, intentando API oficial:', embedErr.message);

      // Secondary fallback: if client credentials provided, try official API
      if (clientId && clientSecret && clientId.trim().length > 0 && clientSecret.trim().length > 0) {
        try {
          const token = await this.getClientCredentialsToken(clientId, clientSecret);
          return await this.fetchPlaylistWithApi(info.id, token);
        } catch (apiErr) {
          throw new Error(`No se pudo cargar la playlist. Asegúrate de que la playlist sea pública en Spotify. Detalle: ${embedErr.message}`);
        }
      }

      throw embedErr;
    }
  }

  async fetchPlaylistWithApi(playlistId, accessToken) {
    const playlistOptions = {
      hostname: 'api.spotify.com',
      port: 443,
      path: `/v1/playlists/${playlistId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SnapMusic/1.0'
      }
    };

    const playlist = await this.makeHttpRequest(playlistOptions);
    const coverUrl = playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null;
    let tracks = [];
    const items = [];
    let offset = 0;
    let total = Number(playlist.items?.total ?? playlist.tracks?.total ?? 0);
    do {
      const page = await this.makeHttpRequest({ ...playlistOptions,
        path: `/v1/playlists/${playlistId}/items?limit=50&offset=${offset}` });
      if (!Array.isArray(page.items)) throw new Error('Spotify devolvió una página de canciones inválida.');
      items.push(...page.items);
      total = Number(page.total ?? total);
      offset += page.items.length;
      if (!page.next) break;
      if (!page.items.length) throw new Error('Spotify interrumpió la importación. Intenta nuevamente.');
    } while (true);

    for (const item of items) {
      const t = item.item || item.track;
      if (!t || !t.name) continue;
      const artists = (t.artists || []).map(a => a.name).join(', ');
      tracks.push({
        id: t.id || `${t.name}-${artists}`,
        name: t.name,
        artists: artists || 'Desconocido',
        album: t.album ? t.album.name : '',
        duration_ms: t.duration_ms || 0,
        duration_str: this.formatDuration(t.duration_ms),
        cover_url: (t.album && t.album.images && t.album.images[0]?.url) || coverUrl,
        preview_url: null, // Always resolve full audio stream
        spotify_url: t.external_urls?.spotify || ''
      });
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      cover_url: coverUrl,
      owner: (playlist.owner && playlist.owner.display_name) || 'Spotify',
      total_tracks: total || tracks.length,
      tracks: tracks,
      partial: total > items.length
    };
  }

  async searchCatalog(query, clientId, clientSecret) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { tracks: [], albums: [], playlists: [], recommendations: [] };
    }

    const cleanQuery = query.trim();
    const cacheKey = cleanQuery.toLowerCase();

    // Return instant cached results if available
    const cached = this.searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.searchCacheTTL)) {
      return cached.data;
    }

    let spotifyResults;
    // 1. Try Spotify Official API if credentials are provided
    if (clientId && clientSecret) {
      try {
        const token = await this.getClientCredentialsToken(clientId, clientSecret);
        const encoded = encodeURIComponent(cleanQuery);

        const options = {
          hostname: 'api.spotify.com',
          port: 443,
          path: `/v1/search?q=${encoded}&type=track,album,playlist&limit=10`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'SnapMusic/1.0'
          }
        };

        const res = await this.makeHttpRequest(options);

        const tracks = (res.tracks?.items || []).map((t) => {
          const artists = (t.artists || []).map((a) => a.name).join(', ');
          return {
            id: t.id,
            name: t.name,
            artists: artists || 'Desconocido',
            album: t.album?.name || '',
            duration_ms: t.duration_ms || 0,
            duration_str: this.formatDuration(t.duration_ms),
            cover_url: t.album?.images?.[0]?.url || null,
            preview_url: null, // Always prioritize full audio stream resolver
            spotify_url: t.external_urls?.spotify || '',
            // Only real measure of which recording people actually listen to.
            popularity: typeof t.popularity === 'number' ? t.popularity : undefined
          };
        });

        const albums = (res.albums?.items || []).map((a) => ({
          id: a.id,
          name: a.name,
          artists: (a.artists || []).map((art) => art.name).join(', '),
          cover_url: a.images?.[0]?.url || null,
          total_tracks: a.total_tracks || 0,
          release_date: a.release_date || '',
          spotify_url: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`
        }));

        const playlists = (res.playlists?.items || []).filter((p) => p !== null).map((p) => ({
          id: p.id,
          name: p.name,
          owner: p.owner?.display_name || 'Spotify',
          cover_url: p.images?.[0]?.url || null,
          total_tracks: p.tracks?.total || 0,
          description: p.description || '',
          spotify_url: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`
        }));

        const resultData = { tracks, albums, playlists, recommendations: [] };

        // Cache in memory for instant reuse
        if (this.searchCache.size > 200) {
          const firstKey = this.searchCache.keys().next().value;
          this.searchCache.delete(firstKey);
        }
        if (tracks.length >= 10) {
          this.searchCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
          return resultData;
        }
        spotifyResults = resultData;
      } catch (err) {
        console.warn('Spotify catalog search error, falling back to public iTunes search:', err.message);
      }
    }

    // 2. Seamless Public Search Fallback via iTunes Search API (Zero-config)
    try {
      const encoded = encodeURIComponent(cleanQuery);
      const [songRes, albumRes] = await Promise.all([
        fetch(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=50`),
        fetch(`https://itunes.apple.com/search?term=${encoded}&entity=album&limit=20`)
      ]);

      const songData = songRes.ok ? await songRes.json() : { results: [] };
      const albumData = albumRes.ok ? await albumRes.json() : { results: [] };

      const allTracks = (songData.results || []).map((t, idx) => ({
        id: String(t.trackId || `itunes-${idx}`),
        name: t.trackName || 'Pista',
        artists: t.artistName || 'Desconocido',
        album: t.collectionName || '',
        duration_ms: t.trackTimeMillis || 0,
        duration_str: this.formatDuration(t.trackTimeMillis),
        cover_url: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : null,
        preview_url: null, // Always resolve full audio stream
        spotify_url: ''
      }));

      const merged = [...(spotifyResults?.tracks || []), ...allTracks.slice(0, 35)].filter((track, index, all) =>
        all.findIndex(other => `${other.name}|${other.artists}`.toLowerCase() === `${track.name}|${track.artists}`.toLowerCase()) === index);
      const tracks = this.rankSearchResults(query, merged);
      const recommendations = allTracks.slice(35, 50);

      const albums = (albumData.results || []).map((a, idx) => ({
        id: String(a.collectionId || `album-${idx}`),
        name: a.collectionName || 'Álbum',
        artists: a.artistName || 'Desconocido',
        cover_url: a.artworkUrl100 ? a.artworkUrl100.replace('100x100bb', '600x600bb') : null,
        total_tracks: a.trackCount || 0,
        release_date: a.releaseDate ? a.releaseDate.split('T')[0] : '',
        spotify_url: a.collectionViewUrl || ''
      }));

      return { tracks, albums, playlists: [], recommendations };
    } catch (err) {
      console.error('All catalog search providers failed:', err);
      return spotifyResults || { tracks: [], albums: [], playlists: [], recommendations: [] };
    }
  }

  async getAlbumTracks(albumId, albumName = 'Álbum', albumCover = null) {
    if (!albumId) return { success: false, error: 'ID de álbum no proporcionado' };

    // 1. If numeric iTunes collection ID
    if (/^\d+$/.test(String(albumId))) {
      try {
        const res = await fetch(`https://itunes.apple.com/lookup?id=${albumId}&entity=song&limit=200`);
        if (res.ok) {
          const data = await res.json();
          const collection = data.results.find(r => r.wrapperType === 'collection') || {};
          const trackResults = data.results.filter(r => r.wrapperType === 'track');
          const cover = collection.artworkUrl100
            ? collection.artworkUrl100.replace('100x100bb', '600x600bb')
            : (albumCover || null);

          const tracks = trackResults.map((t, idx) => ({
            id: String(t.trackId || `album-track-${idx}`),
            name: t.trackName || 'Pista',
            artists: t.artistName || collection.artistName || 'Desconocido',
            album: collection.collectionName || albumName || '',
            duration_ms: t.trackTimeMillis || 0,
            duration_str: this.formatDuration(t.trackTimeMillis),
            cover_url: cover,
            preview_url: null, // Always resolve full audio stream
            track_number: t.trackNumber || (idx + 1)
          }));

          return {
            success: true,
            data: {
              type: 'album',
              name: collection.collectionName || albumName,
              owner: collection.artistName || 'Artista',
              cover_url: cover,
              total_tracks: tracks.length,
              release_date: collection.releaseDate ? collection.releaseDate.split('T')[0] : '',
              tracks: tracks
            }
          };
        }
      } catch (e) {
        console.warn('iTunes album lookup error:', e);
      }
    }

    // 2. Fallback to Spotify embed or URL
    try {
      const url = String(albumId).startsWith('http')
        ? albumId
        : `https://open.spotify.com/album/${albumId}`;
      return await this.fetchPlaylistOrAlbum(url);
    } catch (e) {
      return { success: false, error: 'No se pudieron cargar las pistas del álbum: ' + e.message };
    }
  }
}

module.exports = new SpotifyService();
