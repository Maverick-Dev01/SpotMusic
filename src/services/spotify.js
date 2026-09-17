const https = require('https');

class SpotifyService {
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

  formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async makeHttpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
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
      return response.access_token;
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
                preview_url: t.audioPreview?.url || t.preview_url || null,
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
              tracks: tracks
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

  async getPlaylist(inputUrl, clientId = '', clientSecret = '') {
    const info = this.extractSpotifyInfo(inputUrl);
    if (!info) {
      throw new Error('El enlace ingresado no es válido. Debe ser un enlace de Spotify (ej: https://open.spotify.com/playlist/...)');
    }

    // Try embed extractor first (instant, works for public playlists without rate limit or 404 restrictions)
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
    let items = (playlist.tracks && playlist.tracks.items) || [];

    for (const item of items) {
      const t = item.track;
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
        preview_url: t.preview_url || null,
        spotify_url: t.external_urls?.spotify || ''
      });
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      cover_url: coverUrl,
      owner: (playlist.owner && playlist.owner.display_name) || 'Spotify',
      total_tracks: playlist.tracks ? playlist.tracks.total : tracks.length,
      tracks: tracks
    };
  }

  async searchCatalog(query, clientId, clientSecret) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { tracks: [], albums: [], playlists: [], recommendations: [] };
    }

    const cleanQuery = query.trim();

    // 1. Try Spotify Official API if credentials are provided
    if (clientId && clientSecret) {
      try {
        const token = await this.getClientCredentialsToken(clientId, clientSecret);
        const encoded = encodeURIComponent(cleanQuery);

        const options = {
          hostname: 'api.spotify.com',
          port: 443,
          path: `/v1/search?q=${encoded}&type=track,album,playlist&limit=20`,
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
            preview_url: t.preview_url || null,
            spotify_url: t.external_urls?.spotify || ''
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

        // Fetch top recommendations from primary artist
        let recommendations = [];
        if (res.tracks?.items?.length > 0 && res.tracks.items[0].artists?.[0]?.id) {
          try {
            const artistId = res.tracks.items[0].artists[0].id;
            const topTracksRes = await this.makeHttpRequest({
              hostname: 'api.spotify.com',
              port: 443,
              path: `/v1/artists/${artistId}/top-tracks?market=ES`,
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'SnapMusic/1.0'
              }
            });

            if (topTracksRes && topTracksRes.tracks) {
              recommendations = topTracksRes.tracks
                .filter((rt) => !tracks.some((tr) => tr.id === rt.id))
                .slice(0, 10)
                .map((t) => ({
                  id: t.id,
                  name: t.name,
                  artists: (t.artists || []).map((a) => a.name).join(', ') || 'Desconocido',
                  album: t.album?.name || '',
                  duration_ms: t.duration_ms || 0,
                  duration_str: this.formatDuration(t.duration_ms),
                  cover_url: t.album?.images?.[0]?.url || null,
                  preview_url: t.preview_url || null,
                  spotify_url: t.external_urls?.spotify || ''
                }));
            }
          } catch (e) {
            // Ignore recommendations error
          }
        }

        return { tracks, albums, playlists, recommendations };
      } catch (err) {
        console.warn('Spotify catalog search error, falling back to public iTunes search:', err.message);
      }
    }

    // 2. Seamless Public Search Fallback via iTunes Search API (Zero-config)
    try {
      const encoded = encodeURIComponent(cleanQuery);
      const [songRes, albumRes] = await Promise.all([
        fetch(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=25`),
        fetch(`https://itunes.apple.com/search?term=${encoded}&entity=album&limit=12`)
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
        preview_url: t.previewUrl || null,
        spotify_url: ''
      }));

      const tracks = allTracks.slice(0, 15);
      const recommendations = allTracks.slice(15, 25);

      const albums = (albumData.results || []).map((a, idx) => ({
        id: String(a.collectionId || `album-${idx}`),
        name: a.collectionName || 'Álbum',
        artists: a.artistName || 'Desconocido',
        cover_url: a.artworkUrl100 ? a.artworkUrl100.replace('100x100bb', '600x600bb') : null,
        total_tracks: a.trackCount || 0,
        release_date: a.releaseDate ? a.releaseDate.split('T')[0] : '',
        spotify_url: ''
      }));

      return { tracks, albums, playlists: [], recommendations };
    } catch (err) {
      console.error('All catalog search providers failed:', err);
      return { tracks: [], albums: [], playlists: [], recommendations: [] };
    }
  }
}

module.exports = new SpotifyService();
