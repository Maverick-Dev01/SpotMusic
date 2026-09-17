// SnapMusic - Renderer Controller (PRO Edition with Licensing, Search, and Audio Player)
document.addEventListener('DOMContentLoaded', async () => {
  // State
  const state = {
    settings: {},
    license: null,
    playlist: null,
    selectedIds: new Set(),
    downloads: new Map(), // trackId -> { track, status, percent, speed, eta, message, error }
    filterText: '',
    currentView: 'search-view',
    currentPlayingTrack: null,
    currentPlayingBtn: null,
    catalogResults: null,
    lastSearchQuery: '',
    lastCatalogTab: 'tab-tracks'
  };

  // Audio Player Instance
  const audio = new Audio();
  audio.volume = 0.8;

  // DOM Elements - Navigation & Views
  const navSearch = document.getElementById('nav-search');
  const navDownloads = document.getElementById('nav-downloads');
  const navLicense = document.getElementById('nav-license');
  const navSettings = document.getElementById('nav-settings');
  const searchView = document.getElementById('search-view');
  const downloadsView = document.getElementById('downloads-view');
  const badgeActiveDownloads = document.getElementById('badge-active-downloads');
  const badgeLicensePill = document.getElementById('badge-license-pill');
  const btnOpenDir = document.getElementById('btn-open-dir');

  // DOM Elements - Search Bar & Suggestions
  const inputPlaylistUrl = document.getElementById('input-playlist-url');
  const btnSearchPlaylist = document.getElementById('btn-search-playlist');
  const searchBtnText = document.getElementById('search-btn-text');
  const searchSpinner = document.getElementById('search-spinner');
  const btnPasteSearch = document.getElementById('btn-paste-search');
  const btnPasteEmpty = document.getElementById('btn-paste-empty');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const searchSuggestionsDropdown = document.getElementById('search-suggestions-dropdown');
  const suggestionsList = document.getElementById('suggestions-list');
  const btnCloseSuggestions = document.getElementById('btn-close-suggestions');

  // DOM Elements - Quick Root Folder Bar
  const rootFolderPathDisplay = document.getElementById('root-folder-path-display');
  const btnChangeRootFolder = document.getElementById('btn-change-root-folder');
  const btnRevealRootFolder = document.getElementById('btn-reveal-root-folder');

  // DOM Elements - Views Containers
  const emptyStateView = document.getElementById('empty-state-view');
  const playlistResultsContainer = document.getElementById('playlist-results-container');
  const catalogResultsContainer = document.getElementById('catalog-results-container');
  const catalogQueryDisplay = document.getElementById('catalog-query-display');
  const catalogBackNav = document.getElementById('catalog-back-nav');
  const btnBackToCatalog = document.getElementById('btn-back-to-catalog');
  const catalogBackQueryText = document.getElementById('catalog-back-query-text');

  // DOM Elements - Direct Search Tabs
  const tabBtnTracks = document.getElementById('tab-btn-tracks');
  const tabBtnAlbums = document.getElementById('tab-btn-albums');
  const tabBtnPlaylists = document.getElementById('tab-btn-playlists');
  const tabBtnRecommendations = document.getElementById('tab-btn-recommendations');
  const countTracks = document.getElementById('count-tracks');
  const countAlbums = document.getElementById('count-albums');
  const countPlaylists = document.getElementById('count-playlists');
  const countRecommendations = document.getElementById('count-recommendations');
  const tabTracks = document.getElementById('tab-tracks');
  const tabAlbums = document.getElementById('tab-albums');
  const tabPlaylists = document.getElementById('tab-playlists');
  const tabRecommendations = document.getElementById('tab-recommendations');
  const catalogTracksTbody = document.getElementById('catalog-tracks-tbody');
  const catalogAlbumsGrid = document.getElementById('catalog-albums-grid');
  const catalogPlaylistsGrid = document.getElementById('catalog-playlists-grid');
  const catalogRecommendationsTbody = document.getElementById('catalog-recommendations-tbody');

  // DOM Elements - Playlist View Hero
  const heroCover = document.getElementById('hero-cover');
  const heroTitle = document.getElementById('hero-title');
  const heroDesc = document.getElementById('hero-desc');
  const heroOwner = document.getElementById('hero-owner');
  const heroTrackCount = document.getElementById('hero-track-count');
  const heroTotalDuration = document.getElementById('hero-total-duration');
  const selectFormat = document.getElementById('select-format');
  const selectConcurrency = document.getElementById('select-concurrency');
  const btnDownloadAll = document.getElementById('btn-download-all');
  const btnDownloadSelected = document.getElementById('btn-download-selected');
  const allCountBtn = document.getElementById('all-count-btn');
  const selectedCountBtn = document.getElementById('selected-count-btn');
  const checkAllTracks = document.getElementById('check-all-tracks');
  const selectionSummary = document.getElementById('selection-summary');
  const filterTracksInput = document.getElementById('filter-tracks-input');
  const tracksTbody = document.getElementById('tracks-tbody');

  // DOM Elements - Downloads View
  const statTotal = document.getElementById('stat-total');
  const statProgress = document.getElementById('stat-progress');
  const statCompleted = document.getElementById('stat-completed');
  const statFailed = document.getElementById('stat-failed');
  const activeDownloadsContainer = document.getElementById('active-downloads-container');
  const emptyDownloadsState = document.getElementById('empty-downloads-state');
  const btnOpenDestFolder = document.getElementById('btn-open-dest-folder');
  const btnCancelAllDownloads = document.getElementById('btn-cancel-all-downloads');
  const downloadsDirPreview = document.getElementById('downloads-dir-preview');

  // DOM Elements - Bottom Music Player
  const bottomPlayer = document.getElementById('bottom-player');
  const playerTrackCover = document.getElementById('player-track-cover');
  const playerTrackTitle = document.getElementById('player-track-title');
  const playerTrackArtist = document.getElementById('player-track-artist');
  const btnPlayerToggle = document.getElementById('btn-player-toggle');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const playerTimeCurrent = document.getElementById('player-time-current');
  const playerTimeTotal = document.getElementById('player-time-total');
  const playerSeek = document.getElementById('player-seek');
  const playerVolume = document.getElementById('player-volume');
  const btnPlayerMute = document.getElementById('btn-player-mute');

  // DOM Elements - Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const settingClientId = document.getElementById('setting-client-id');
  const settingClientSecret = document.getElementById('setting-client-secret');
  const btnToggleSecret = document.getElementById('btn-toggle-secret');
  const btnTestApi = document.getElementById('btn-test-api');
  const testApiStatus = document.getElementById('test-api-status');
  const settingDownloadDir = document.getElementById('setting-download-dir');
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  const settingDefaultFormat = document.getElementById('setting-default-format');
  const sysYtdlpStatus = document.getElementById('sys-ytdlp-status');
  const sysFfmpegStatus = document.getElementById('sys-ffmpeg-status');
  const statusEngineDot = document.getElementById('status-engine-dot');
  const statusEngineText = document.getElementById('status-engine-text');
  const linkSpotifyDash = document.getElementById('link-spotify-dash');

  // DOM Elements - License Modal
  const licenseModal = document.getElementById('license-modal');
  const btnCloseLicense = document.getElementById('btn-close-license');
  const btnCancelLicense = document.getElementById('btn-cancel-license');
  const btnActivateLicense = document.getElementById('btn-activate-license');
  const licenseMachineId = document.getElementById('license-machine-id');
  const btnCopyMachineId = document.getElementById('btn-copy-machine-id');
  const licenseTokenInput = document.getElementById('license-token-input');
  const licenseInfoState = document.getElementById('license-info-state');
  const licenseInfoClient = document.getElementById('license-info-client');
  const licenseInfoExpiry = document.getElementById('license-info-expiry');

  // Toast Notification
  function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // 1. Initialize License
  async function refreshLicenseUI() {
    try {
      const lic = await window.snapAPI.getLicenseStatus();
      state.license = lic;
      licenseMachineId.value = lic.machineId || 'DESCONOCIDO';

      if (lic.valid) {
        badgeLicensePill.className = 'license-pill active';
        badgeLicensePill.textContent = lic.isPermanent ? 'Vitalicia' : `${lic.remainingDays}d`;
        licenseInfoState.textContent = 'ACTIVA ✓';
        licenseInfoState.style.color = '#1db954';
        licenseInfoClient.textContent = lic.clientName || 'Usuario';
        licenseInfoExpiry.textContent = lic.isPermanent ? 'Permanente (Sin vencimiento)' : new Date(lic.expiresAt).toLocaleDateString();
      } else {
        badgeLicensePill.className = 'license-pill expired';
        badgeLicensePill.textContent = lic.expired ? 'Expirada' : 'Inactiva';
        licenseInfoState.textContent = lic.expired ? 'EXPIRADA ✗' : 'NO ACTIVADA ✗';
        licenseInfoState.style.color = '#e91429';
        licenseInfoClient.textContent = '-';
        licenseInfoExpiry.textContent = lic.error || 'Requiere clave de activación';
      }
    } catch (e) {
      console.warn('License check error:', e);
    }
  }

  btnCopyMachineId.addEventListener('click', () => {
    navigator.clipboard.writeText(licenseMachineId.value);
    showToast('¡Machine ID copiado al portapapeles!');
  });

  btnActivateLicense.addEventListener('click', async () => {
    const token = licenseTokenInput.value.trim();
    if (!token) return showToast('Ingresa el token de activación', true);

    const res = await window.snapAPI.activateLicense(token);
    if (res.valid && res.success) {
      showToast('¡SnapMusic ha sido activado con éxito!');
      licenseModal.classList.remove('open');
      licenseTokenInput.value = '';
      refreshLicenseUI();
    } else {
      showToast(res.error || 'Clave de activación inválida', true);
    }
  });

  // 2. Initialize App Settings and Dependencies
  async function init() {
    try {
      if (window.snapAPI.platform !== 'darwin') {
        document.body.classList.add('platform-not-mac');
      }

      state.settings = await window.snapAPI.getSettings();
      settingClientId.value = state.settings.spotifyClientId || '';
      settingClientSecret.value = state.settings.spotifyClientSecret || '';
      settingDownloadDir.value = state.settings.downloadDir || '';
      settingDefaultFormat.value = state.settings.defaultFormat || 'mp3-320';
      selectFormat.value = state.settings.defaultFormat || 'mp3-320';
      selectConcurrency.value = String(state.settings.concurrency || 3);
      downloadsDirPreview.textContent = `Destino: ${state.settings.downloadDir}`;
      if (rootFolderPathDisplay) {
        rootFolderPathDisplay.textContent = state.settings.downloadDir || 'No seleccionada';
      }

      // Check yt-dlp & ffmpeg
      const deps = await window.snapAPI.checkDependencies();
      if (deps.ytDlp.available && deps.ffmpeg.available) {
        statusEngineDot.className = 'status-dot online';
        statusEngineText.textContent = 'Motor yt-dlp listo';
        sysYtdlpStatus.textContent = 'Instalado ✓';
        sysYtdlpStatus.style.color = '#1db954';
        sysFfmpegStatus.textContent = 'Instalado ✓';
        sysFfmpegStatus.style.color = '#1db954';
      } else {
        statusEngineDot.className = 'status-dot';
        statusEngineDot.style.backgroundColor = '#e91429';
        statusEngineText.textContent = 'Faltan dependencias';
        sysYtdlpStatus.textContent = deps.ytDlp.available ? 'Instalado ✓' : 'No encontrado ✗';
        sysYtdlpStatus.style.color = deps.ytDlp.available ? '#1db954' : '#e91429';
        sysFfmpegStatus.textContent = deps.ffmpeg.available ? 'Instalado ✓' : 'No encontrado ✗';
        sysFfmpegStatus.style.color = deps.ffmpeg.available ? '#1db954' : '#e91429';
      }

      await refreshLicenseUI();
    } catch (e) {
      console.error('Init error:', e);
    }
  }

  // 3. Navigation
  function switchView(viewId) {
    state.currentView = viewId;
    if (viewId === 'search-view') {
      navSearch.classList.add('active');
      navDownloads.classList.remove('active');
      searchView.classList.add('active');
      downloadsView.classList.remove('active');
    } else {
      navSearch.classList.remove('active');
      navDownloads.classList.add('active');
      searchView.classList.remove('active');
      downloadsView.classList.add('active');
      renderDownloadsView();
    }
  }

  navSearch.addEventListener('click', () => switchView('search-view'));
  navDownloads.addEventListener('click', () => switchView('downloads-view'));

  // Modals
  navSettings.addEventListener('click', () => settingsModal.classList.add('open'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.remove('open'));
  btnCancelSettings.addEventListener('click', () => settingsModal.classList.remove('open'));

  navLicense.addEventListener('click', () => {
    refreshLicenseUI();
    licenseModal.classList.add('open');
  });
  btnCloseLicense.addEventListener('click', () => licenseModal.classList.remove('open'));
  btnCancelLicense.addEventListener('click', () => licenseModal.classList.remove('open'));

  btnToggleSecret.addEventListener('click', () => {
    if (settingClientSecret.type === 'password') {
      settingClientSecret.type = 'text';
      btnToggleSecret.textContent = 'Ocultar';
    } else {
      settingClientSecret.type = 'password';
      btnToggleSecret.textContent = 'Mostrar';
    }
  });

  btnBrowseFolder.addEventListener('click', async () => {
    const selected = await window.snapAPI.selectFolder();
    if (selected) settingDownloadDir.value = selected;
  });

  btnOpenDir.addEventListener('click', () => window.snapAPI.openFolder(state.settings.downloadDir));
  btnOpenDestFolder.addEventListener('click', () => window.snapAPI.openFolder(state.settings.downloadDir));

  // Quick Root Folder Bar Actions
  if (btnChangeRootFolder) {
    btnChangeRootFolder.addEventListener('click', async () => {
      const selected = await window.snapAPI.selectFolder();
      if (selected) {
        const updated = {
          ...state.settings,
          downloadDir: selected
        };
        const res = await window.snapAPI.saveSettings(updated);
        if (res.success) {
          state.settings = res.settings;
          settingDownloadDir.value = selected;
          if (rootFolderPathDisplay) rootFolderPathDisplay.textContent = selected;
          downloadsDirPreview.textContent = `Destino: ${selected}`;
          showToast(`Carpeta raíz actualizada: ${selected}`);
        }
      }
    });
  }

  if (btnRevealRootFolder) {
    btnRevealRootFolder.addEventListener('click', () => {
      if (state.settings.downloadDir) {
        window.snapAPI.openFolder(state.settings.downloadDir);
      }
    });
  }

  linkSpotifyDash.addEventListener('click', (e) => {
    e.preventDefault();
    window.snapAPI.openFolder('https://developer.spotify.com/dashboard');
  });

  btnTestApi.addEventListener('click', async () => {
    const id = settingClientId.value.trim();
    const secret = settingClientSecret.value.trim();
    if (!id || !secret) {
      testApiStatus.textContent = 'Ingresa Client ID y Secret';
      testApiStatus.style.color = '#e91429';
      return;
    }
    testApiStatus.textContent = 'Probando conexión...';
    testApiStatus.style.color = '#ffa42b';
    const res = await window.snapAPI.testSpotifyCredentials(id, secret);
    if (res.success) {
      testApiStatus.textContent = '¡Conexión exitosa! ✓';
      testApiStatus.style.color = '#1db954';
    } else {
      testApiStatus.textContent = `Error: ${res.error}`;
      testApiStatus.style.color = '#e91429';
    }
  });

  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      spotifyClientId: settingClientId.value.trim(),
      spotifyClientSecret: settingClientSecret.value.trim(),
      downloadDir: settingDownloadDir.value.trim(),
      defaultFormat: settingDefaultFormat.value
    };

    const res = await window.snapAPI.saveSettings(updated);
    if (res.success) {
      state.settings = res.settings;
      downloadsDirPreview.textContent = `Destino: ${state.settings.downloadDir}`;
      if (rootFolderPathDisplay) rootFolderPathDisplay.textContent = state.settings.downloadDir;
      settingsModal.classList.remove('open');
      showToast('Ajustes guardados correctamente');
    } else {
      showToast('Error al guardar ajustes', true);
    }
  });

  // 4. Search Handler: Direct Search OR URL Parsing
  async function handleSearch() {
    hideSuggestions();
    const query = inputPlaylistUrl.value.trim();
    if (!query) {
      return showToast('Escribe el nombre de un artista, canción o pega un enlace de Spotify', true);
    }

    // UI Loading state
    btnSearchPlaylist.disabled = true;
    searchBtnText.style.display = 'none';
    searchSpinner.style.display = 'inline-block';

    const isUrl = query.startsWith('http://') || query.startsWith('https://') || query.startsWith('spotify:');

    try {
      if (isUrl) {
        // Load Playlist / Album / Track directly
        const response = await window.snapAPI.fetchPlaylist(query);
        if (response.success && response.data) {
          state.playlist = response.data;
          state.selectedIds = new Set(response.data.tracks.map((t) => t.id));
          catalogResultsContainer.style.display = 'none';

          // If catalog search was active, show back navigation bar
          if (state.catalogResults && catalogBackNav) {
            catalogBackNav.style.display = 'flex';
            if (catalogBackQueryText) {
              catalogBackQueryText.textContent = `Resultados para: "${state.lastSearchQuery}"`;
            }
          } else if (catalogBackNav) {
            catalogBackNav.style.display = 'none';
          }

          renderPlaylist(response.data);
          showToast(`Cargada: ${response.data.name} (${response.data.tracks.length} canciones)`);
        } else {
          showToast(response.error || 'No se pudo cargar la playlist', true);
        }
      } else {
        // Direct Catalog Search
        const response = await window.snapAPI.searchCatalog(query);
        if (response.success && response.data) {
          state.catalogResults = response.data;
          state.lastSearchQuery = query;
          playlistResultsContainer.style.display = 'none';
          emptyStateView.style.display = 'none';
          if (catalogBackNav) catalogBackNav.style.display = 'none';
          renderCatalogResults(response.data, query);
          showToast(`Búsqueda: ${response.data.tracks.length} pistas, ${response.data.albums.length} álbumes, ${response.data.playlists.length} playlists`);
        } else {
          showToast(response.error || 'Error en la búsqueda', true);
        }
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, true);
    } finally {
      btnSearchPlaylist.disabled = false;
      searchBtnText.style.display = 'inline-block';
      searchSpinner.style.display = 'none';
    }
  }

  btnSearchPlaylist.addEventListener('click', handleSearch);
  inputPlaylistUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  async function pasteAndSearch() {
    try {
      const text = window.snapAPI.readClipboard ? window.snapAPI.readClipboard() : '';
      if (text) {
        inputPlaylistUrl.value = text.trim();
        handleSearch();
      } else {
        showToast('El portapapeles está vacío. Copia el enlace o texto y vuelve a pulsar.', true);
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  }

  if (btnPasteSearch) btnPasteSearch.addEventListener('click', pasteAndSearch);
  if (btnPasteEmpty) btnPasteEmpty.addEventListener('click', pasteAndSearch);

  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', () => {
      inputPlaylistUrl.value = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
      handleSearch();
    });
  }

  // Live Suggestions Engine (Autocomplete + 30s Preview Player)
  let suggestionDebounceTimer = null;

  function hideSuggestions() {
    if (searchSuggestionsDropdown) {
      searchSuggestionsDropdown.style.display = 'none';
    }
  }

  if (btnCloseSuggestions) {
    btnCloseSuggestions.addEventListener('click', hideSuggestions);
  }

  document.addEventListener('click', (e) => {
    if (searchSuggestionsDropdown && !searchSuggestionsDropdown.contains(e.target) && e.target !== inputPlaylistUrl) {
      hideSuggestions();
    }
  });

  inputPlaylistUrl.addEventListener('input', () => {
    clearTimeout(suggestionDebounceTimer);
    const query = inputPlaylistUrl.value.trim();

    const isUrl = query.startsWith('http://') || query.startsWith('https://') || query.startsWith('spotify:');
    if (!query || query.length < 3 || isUrl) {
      hideSuggestions();
      return;
    }

    suggestionDebounceTimer = setTimeout(async () => {
      try {
        const res = await window.snapAPI.searchCatalog(query);
        if (res.success && res.data && res.data.tracks && res.data.tracks.length > 0) {
          renderSuggestions(res.data.tracks.slice(0, 6));
        } else {
          hideSuggestions();
        }
      } catch (err) {
        console.warn('Autocomplete search failed:', err.message);
        hideSuggestions();
      }
    }, 350);
  });

  function renderSuggestions(tracks) {
    if (!suggestionsList || !searchSuggestionsDropdown) return;
    suggestionsList.innerHTML = '';

    tracks.forEach(track => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';

      item.innerHTML = `
        <img class="suggestion-thumb" src="${track.cover_url || ''}" alt="Cover" onerror="this.style.display='none'" />
        <div class="suggestion-info">
          <span class="suggestion-title" title="${track.name}">${track.name}</span>
          <span class="suggestion-artist" title="${track.artists}">${track.artists}</span>
        </div>
        <div class="suggestion-actions">
          <button class="btn-suggestion-play" title="Preescuchar (30s)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <button class="btn-suggestion-download" title="Descargar pista">
            Descargar
          </button>
        </div>
      `;

      const playBtn = item.querySelector('.btn-suggestion-play');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio(track, playBtn);
      });

      const dlBtn = item.querySelector('.btn-suggestion-download');
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideSuggestions();
        triggerBatchDownload([track]);
      });

      item.addEventListener('click', () => {
        hideSuggestions();
        inputPlaylistUrl.value = `${track.name} - ${track.artists}`;
        handleSearch();
      });

      suggestionsList.appendChild(item);
    });

    searchSuggestionsDropdown.style.display = 'block';
  }

  // 5. Render Direct Catalog Search Results
  function renderCatalogResults(data, query) {
    state.catalogResults = data;
    catalogResultsContainer.style.display = 'block';
    
    if (catalogQueryDisplay) {
      catalogQueryDisplay.textContent = query || state.lastSearchQuery || '';
    }

    countTracks.textContent = data.tracks.length;
    countAlbums.textContent = data.albums.length;
    countPlaylists.textContent = data.playlists.length;
    if (countRecommendations) {
      countRecommendations.textContent = (data.recommendations || []).length;
    }

    // Render Tracks Tab
    catalogTracksTbody.innerHTML = '';
    data.tracks.forEach((track, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'track-row';
      tr.innerHTML = `
        <td class="col-num">${idx + 1}</td>
        <td>
          <button class="btn-play-row btn-play-track" data-id="${track.id}" title="Reproducir Preview">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        </td>
        <td>
          <div class="col-title">
            <img class="track-thumb" src="${track.cover_url || ''}" alt="Cover" onerror="this.style.display='none'" />
            <div class="track-info">
              <span class="track-name" title="${track.name}">${track.name}</span>
              <span class="track-artist" title="${track.artists}">${track.artists}</span>
            </div>
          </div>
        </td>
        <td class="col-album">${track.album || '-'}</td>
        <td class="col-time">${track.duration_str}</td>
        <td style="text-align: right;">
          <button class="btn btn-primary btn-sm btn-download-single" data-id="${track.id}">
            Descargar
          </button>
        </td>
      `;

      const playBtn = tr.querySelector('.btn-play-track');
      playBtn.addEventListener('click', () => playAudio(track, playBtn));
      tr.querySelector('.btn-download-single').addEventListener('click', () => triggerBatchDownload([track]));
      catalogTracksTbody.appendChild(tr);
    });

    // Render Albums Tab
    catalogAlbumsGrid.innerHTML = '';
    data.albums.forEach(album => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <div class="media-card-img-wrap">
          <img class="media-card-img" src="${album.cover_url || ''}" alt="${album.name}" />
        </div>
        <div class="media-card-title" title="${album.name}">${album.name}</div>
        <div class="media-card-desc">${album.artists} • ${album.total_tracks} pistas</div>
      `;
      card.addEventListener('click', () => {
        inputPlaylistUrl.value = album.spotify_url;
        handleSearch();
      });
      catalogAlbumsGrid.appendChild(card);
    });

    // Render Playlists Tab
    catalogPlaylistsGrid.innerHTML = '';
    data.playlists.forEach(playlist => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <div class="media-card-img-wrap">
          <img class="media-card-img" src="${playlist.cover_url || ''}" alt="${playlist.name}" />
        </div>
        <div class="media-card-title" title="${playlist.name}">${playlist.name}</div>
        <div class="media-card-desc">Por ${playlist.owner} • ${playlist.total_tracks} pistas</div>
      `;
      card.addEventListener('click', () => {
        inputPlaylistUrl.value = playlist.spotify_url;
        handleSearch();
      });
      catalogPlaylistsGrid.appendChild(card);
    });

    // Render Recommendations Tab
    if (catalogRecommendationsTbody) {
      catalogRecommendationsTbody.innerHTML = '';
      const recs = data.recommendations || [];
      if (recs.length === 0) {
        catalogRecommendationsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No hay recomendaciones adicionales disponibles.</td></tr>';
      } else {
        recs.forEach((track, idx) => {
          const tr = document.createElement('tr');
          tr.className = 'track-row';
          tr.innerHTML = `
            <td class="col-num">${idx + 1}</td>
            <td>
              <button class="btn-play-row btn-play-track" data-id="${track.id}" title="Reproducir Preview">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
            </td>
            <td>
              <div class="col-title">
                <img class="track-thumb" src="${track.cover_url || ''}" alt="Cover" onerror="this.style.display='none'" />
                <div class="track-info">
                  <span class="track-name" title="${track.name}">${track.name}</span>
                  <span class="track-artist" title="${track.artists}">${track.artists}</span>
                </div>
              </div>
            </td>
            <td class="col-album">${track.album || '-'}</td>
            <td class="col-time">${track.duration_str}</td>
            <td style="text-align: right;">
              <button class="btn btn-primary btn-sm btn-download-single" data-id="${track.id}">
                Descargar
              </button>
            </td>
          `;

          const playBtn = tr.querySelector('.btn-play-track');
          playBtn.addEventListener('click', () => playAudio(track, playBtn));
          tr.querySelector('.btn-download-single').addEventListener('click', () => triggerBatchDownload([track]));
          catalogRecommendationsTbody.appendChild(tr);
        });
      }
    }
  }

  // Catalog Tabs switching
  function switchCatalogTab(tabId) {
    state.lastCatalogTab = tabId;
    [tabBtnTracks, tabBtnAlbums, tabBtnPlaylists, tabBtnRecommendations].forEach(btn => btn && btn.classList.remove('active'));
    [tabTracks, tabAlbums, tabPlaylists, tabRecommendations].forEach(el => { if (el) el.style.display = 'none'; });

    if (tabId === 'tab-tracks') {
      tabBtnTracks.classList.add('active');
      tabTracks.style.display = 'block';
    } else if (tabId === 'tab-albums') {
      tabBtnAlbums.classList.add('active');
      tabAlbums.style.display = 'block';
    } else if (tabId === 'tab-recommendations') {
      if (tabBtnRecommendations) tabBtnRecommendations.classList.add('active');
      if (tabRecommendations) tabRecommendations.style.display = 'block';
    } else {
      tabBtnPlaylists.classList.add('active');
      tabPlaylists.style.display = 'block';
    }
  }

  tabBtnTracks.addEventListener('click', () => switchCatalogTab('tab-tracks'));
  tabBtnAlbums.addEventListener('click', () => switchCatalogTab('tab-albums'));
  tabBtnPlaylists.addEventListener('click', () => switchCatalogTab('tab-playlists'));
  if (tabBtnRecommendations) {
    tabBtnRecommendations.addEventListener('click', () => switchCatalogTab('tab-recommendations'));
  }

  // Back to Catalog Search Results Button
  if (btnBackToCatalog) {
    btnBackToCatalog.addEventListener('click', () => {
      playlistResultsContainer.style.display = 'none';
      catalogResultsContainer.style.display = 'block';
      if (catalogBackNav) catalogBackNav.style.display = 'none';
      if (state.catalogResults) {
        renderCatalogResults(state.catalogResults, state.lastSearchQuery);
      }
      switchCatalogTab(state.lastCatalogTab || 'tab-tracks');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 6. Render Playlist Hero and Tracks Table
  function renderPlaylist(playlist) {
    emptyStateView.style.display = 'none';
    catalogResultsContainer.style.display = 'none';
    playlistResultsContainer.style.display = 'block';

    heroTitle.textContent = playlist.name || 'Playlist de Spotify';
    heroDesc.textContent = playlist.description || '';
    heroOwner.textContent = playlist.owner || 'Spotify';
    heroTrackCount.textContent = `${playlist.tracks.length} canciones`;

    if (playlist.cover_url) {
      heroCover.src = playlist.cover_url;
      heroCover.style.display = 'block';
    } else {
      heroCover.style.display = 'none';
    }

    const totalMs = playlist.tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
    const totalMin = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    heroTotalDuration.textContent = hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;

    allCountBtn.textContent = playlist.tracks.length;
    updateSelectionUI();
    renderTracksTable();
  }

  function updateSelectionUI() {
    const total = state.playlist ? state.playlist.tracks.length : 0;
    const selected = state.selectedIds.size;
    selectedCountBtn.textContent = selected;
    selectionSummary.textContent = `${selected} seleccionadas de ${total} canciones`;
    checkAllTracks.checked = selected === total && total > 0;
    checkAllTracks.indeterminate = selected > 0 && selected < total;
    btnDownloadSelected.disabled = selected === 0;
  }

  checkAllTracks.addEventListener('change', () => {
    if (checkAllTracks.checked) {
      state.playlist.tracks.forEach(t => state.selectedIds.add(t.id));
    } else {
      state.selectedIds.clear();
    }
    updateSelectionUI();
    renderTracksTable();
  });

  filterTracksInput.addEventListener('input', (e) => {
    state.filterText = e.target.value.toLowerCase().trim();
    renderTracksTable();
  });

  function renderTracksTable() {
    if (!state.playlist) return;
    tracksTbody.innerHTML = '';

    const filter = state.filterText;
    const filteredTracks = state.playlist.tracks.filter(t => {
      if (!filter) return true;
      return t.name.toLowerCase().includes(filter) ||
             t.artists.toLowerCase().includes(filter) ||
             (t.album && t.album.toLowerCase().includes(filter));
    });

    filteredTracks.forEach((track, index) => {
      const tr = document.createElement('tr');
      tr.className = 'track-row';
      tr.id = `row-track-${track.id}`;

      const isChecked = state.selectedIds.has(track.id);
      const downloadState = state.downloads.get(track.id);

      tr.innerHTML = `
        <td class="col-num">${index + 1}</td>
        <td class="col-check">
          <input type="checkbox" class="custom-checkbox track-checkbox" data-id="${track.id}" ${isChecked ? 'checked' : ''} />
        </td>
        <td>
          <div class="col-title">
            <button class="btn-play-row btn-play-track" data-id="${track.id}" title="Reproducir Preview">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <img class="track-thumb" src="${track.cover_url || ''}" alt="Cover" onerror="this.style.display='none'" />
            <div class="track-info">
              <span class="track-name" title="${track.name}">${track.name}</span>
              <span class="track-artist" title="${track.artists}">${track.artists}</span>
            </div>
          </div>
        </td>
        <td class="col-album" title="${track.album || ''}">${track.album || '-'}</td>
        <td class="col-time">${track.duration_str || '0:00'}</td>
        <td class="col-status" id="status-cell-${track.id}">
          ${getTrackStatusBadgeHTML(downloadState)}
        </td>
      `;

      tr.querySelector('.track-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) state.selectedIds.add(track.id);
        else state.selectedIds.delete(track.id);
        updateSelectionUI();
      });

      const playBtn = tr.querySelector('.btn-play-track');
      playBtn.addEventListener('click', () => playAudio(track, playBtn));

      tracksTbody.appendChild(tr);
    });
  }

  function getTrackStatusBadgeHTML(item) {
    if (!item) return `<span class="badge-status badge-pending">Pendiente</span>`;
    if (item.status === 'queued') return `<span class="badge-status badge-queued">En cola...</span>`;
    if (item.status === 'searching') return `<span class="badge-status badge-downloading">Buscando...</span>`;
    if (item.status === 'downloading' || item.status === 'converting') {
      return `
        <div class="row-progress-wrap">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${item.percent || 10}%;"></div>
          </div>
          <div class="progress-info">
            <span>${item.message || 'Procesando...'}</span>
            <span>${item.speed || ''}</span>
          </div>
        </div>
      `;
    }
    if (item.status === 'completed') {
      return `
        <span class="badge-status badge-completed">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Listo
        </span>
      `;
    }
    if (item.status === 'error') {
      return `<span class="badge-status badge-error" title="${item.error || 'Error'}">Error</span>`;
    }
    if (item.status === 'cancelled') return `<span class="badge-status badge-pending">Cancelado</span>`;
    return `<span class="badge-status badge-pending">Pendiente</span>`;
  }

  // 7. Audio Player Engine
  async function playAudio(track, triggerBtn = null) {
    if (!track) return;

    // If clicking the track that is already playing, toggle pause/play
    if (state.currentPlayingTrack && state.currentPlayingTrack.id === track.id) {
      if (audio.paused) {
        audio.play().catch(e => console.warn('Audio resume error:', e));
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
        if (triggerBtn) triggerBtn.classList.add('playing');
      } else {
        audio.pause();
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
        if (triggerBtn) triggerBtn.classList.remove('playing');
      }
      return;
    }

    // Reset previous button
    if (state.currentPlayingBtn) {
      state.currentPlayingBtn.classList.remove('playing', 'loading');
      state.currentPlayingBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }

    // Indicate loading on current button
    if (triggerBtn) {
      triggerBtn.classList.add('loading');
      triggerBtn.innerHTML = '<svg class="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path></svg>';
    }

    bottomPlayer.style.display = 'flex';
    playerTrackCover.src = track.cover_url || '';
    playerTrackTitle.textContent = track.name;
    playerTrackArtist.textContent = `${track.artists} (Cargando audio...)`;

    try {
      // Resolve audio using multi-tier resolver (Spotify -> iTunes -> yt-dlp)
      const res = await window.snapAPI.getTrackAudio(track);
      if (!res.success || !res.url) {
        throw new Error(res.error || 'No se pudo obtener el audio');
      }

      state.currentPlayingTrack = track;
      state.currentPlayingBtn = triggerBtn;

      audio.src = res.url;
      await audio.play();

      playerTrackArtist.textContent = track.artists;
      if (triggerBtn) {
        triggerBtn.classList.remove('loading');
        triggerBtn.classList.add('playing');
        triggerBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      }
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    } catch (err) {
      console.error('Audio playback error:', err);
      showToast(`No se pudo reproducir "${track.name}". Puedes descargarla directamente.`, true);
      if (triggerBtn) {
        triggerBtn.classList.remove('loading', 'playing');
        triggerBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
      playerTrackArtist.textContent = track.artists;
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
  }

  btnPlayerToggle.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(e => console.warn('Play failed:', e));
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      if (state.currentPlayingBtn) state.currentPlayingBtn.classList.add('playing');
    } else {
      audio.pause();
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      if (state.currentPlayingBtn) state.currentPlayingBtn.classList.remove('playing');
    }
  });

  audio.addEventListener('play', () => {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    if (state.currentPlayingBtn) {
      state.currentPlayingBtn.classList.remove('loading');
      state.currentPlayingBtn.classList.add('playing');
      state.currentPlayingBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    }
  });

  audio.addEventListener('pause', () => {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    if (state.currentPlayingBtn) {
      state.currentPlayingBtn.classList.remove('playing');
      state.currentPlayingBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      playerSeek.value = percent;
      const curM = Math.floor(audio.currentTime / 60);
      const curS = Math.floor(audio.currentTime % 60);
      playerTimeCurrent.textContent = `${curM}:${curS.toString().padStart(2, '0')}`;
      const totM = Math.floor(audio.duration / 60);
      const totS = Math.floor(audio.duration % 60);
      playerTimeTotal.textContent = `${totM}:${totS.toString().padStart(2, '0')}`;
    }
  });

  audio.addEventListener('ended', () => {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    playerSeek.value = 0;
    if (state.currentPlayingBtn) {
      state.currentPlayingBtn.classList.remove('playing', 'loading');
      state.currentPlayingBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
  });

  audio.addEventListener('error', (e) => {
    console.warn('Audio stream error event:', e);
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    if (state.currentPlayingBtn) {
      state.currentPlayingBtn.classList.remove('playing', 'loading');
      state.currentPlayingBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
  });

  playerSeek.addEventListener('input', (e) => {
    if (audio.duration) {
      audio.currentTime = (e.target.value / 100) * audio.duration;
    }
  });

  playerVolume.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
  });

  btnPlayerMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
  });

  // 8. Downloads Trigger & Batch Management with License Verification
  async function triggerBatchDownload(tracksToDownload) {
    if (!tracksToDownload || tracksToDownload.length === 0) {
      return showToast('Selecciona al menos una canción para descargar', true);
    }

    // License Check
    const lic = await window.snapAPI.getLicenseStatus();
    if (!lic.valid) {
      showToast('⚠️ Se requiere una licencia activa para descargar música.', true);
      refreshLicenseUI();
      licenseModal.classList.add('open');
      return;
    }

    const format = selectFormat.value;
    const concurrency = parseInt(selectConcurrency.value, 10) || 3;
    const downloadDir = state.settings.downloadDir;

    tracksToDownload.forEach(t => {
      state.downloads.set(t.id, {
        track: t,
        status: 'queued',
        percent: 0,
        message: 'En cola...',
        speed: '',
        eta: ''
      });
      const cell = document.getElementById(`status-cell-${t.id}`);
      if (cell) cell.innerHTML = getTrackStatusBadgeHTML(state.downloads.get(t.id));
    });

    updateDownloadStats();
    showToast(`Iniciando descarga de ${tracksToDownload.length} canciones...`);

    const res = await window.snapAPI.startBatchDownload({
      tracks: tracksToDownload,
      format,
      concurrency,
      downloadDir
    });

    if (!res.success) {
      showToast(res.error || 'Error al iniciar descarga', true);
    } else {
      switchView('downloads-view');
    }
  }

  btnDownloadSelected.addEventListener('click', () => {
    if (!state.playlist) return;
    const selectedTracks = state.playlist.tracks.filter(t => state.selectedIds.has(t.id));
    triggerBatchDownload(selectedTracks);
  });

  btnDownloadAll.addEventListener('click', () => {
    if (!state.playlist) return;
    triggerBatchDownload(state.playlist.tracks);
  });

  // 9. Real-Time Download Progress Listener
  window.snapAPI.onDownloadProgress((data) => {
    const { trackId, status, percent, speed, eta, message, error } = data;
    const existing = state.downloads.get(trackId);

    if (existing) {
      existing.status = status;
      existing.percent = percent || existing.percent;
      existing.speed = speed || existing.speed;
      existing.eta = eta || existing.eta;
      existing.message = message || existing.message;
      existing.error = error || existing.error;
    } else {
      const trackObj = state.playlist ? state.playlist.tracks.find(t => t.id === trackId) : null;
      state.downloads.set(trackId, {
        track: trackObj || { id: trackId, name: 'Canción', artists: '' },
        status,
        percent: percent || 0,
        speed: speed || '',
        eta: eta || '',
        message: message || '',
        error: error || ''
      });
    }

    const cell = document.getElementById(`status-cell-${trackId}`);
    if (cell) cell.innerHTML = getTrackStatusBadgeHTML(state.downloads.get(trackId));

    updateDownloadStats();
    renderDownloadsView();
  });

  function updateDownloadStats() {
    let total = state.downloads.size;
    let progress = 0;
    let completed = 0;
    let failed = 0;

    for (const item of state.downloads.values()) {
      if (item.status === 'downloading' || item.status === 'converting' || item.status === 'searching' || item.status === 'queued') {
        progress++;
      } else if (item.status === 'completed') {
        completed++;
      } else if (item.status === 'error') {
        failed++;
      }
    }

    statTotal.textContent = total;
    statProgress.textContent = progress;
    statCompleted.textContent = completed;
    statFailed.textContent = failed;

    if (progress > 0) {
      badgeActiveDownloads.textContent = progress;
      badgeActiveDownloads.classList.add('show');
    } else {
      badgeActiveDownloads.classList.remove('show');
    }
  }

  function renderDownloadsView() {
    if (state.currentView !== 'downloads-view') return;

    if (state.downloads.size === 0) {
      emptyDownloadsState.style.display = 'block';
      activeDownloadsContainer.innerHTML = '';
      activeDownloadsContainer.appendChild(emptyDownloadsState);
      return;
    }

    emptyDownloadsState.style.display = 'none';
    activeDownloadsContainer.innerHTML = '';

    const sortedItems = Array.from(state.downloads.values()).reverse();

    sortedItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'download-item-card';

      card.innerHTML = `
        <img class="track-thumb" src="${item.track.cover_url || ''}" alt="Cover" onerror="this.style.display='none'" />
        <div class="download-item-info">
          <span class="download-item-title">${item.track.name}</span>
          <span class="download-item-artist">${item.track.artists}</span>
        </div>
        <div class="download-item-progress-section">
          ${getTrackStatusBadgeHTML(item)}
        </div>
        <div>
          ${(item.status === 'downloading' || item.status === 'queued' || item.status === 'searching') ? `
            <button class="btn btn-danger btn-sm btn-icon-only btn-cancel-item" data-id="${item.track.id}" title="Cancelar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          ` : ''}
        </div>
      `;

      const cancelBtn = card.querySelector('.btn-cancel-item');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => window.snapAPI.cancelTrack(item.track.id));
      }

      activeDownloadsContainer.appendChild(card);
    });
  }

  btnCancelAllDownloads.addEventListener('click', async () => {
    await window.snapAPI.cancelAll();
    showToast('Todas las descargas han sido canceladas');
  });

  // Start initialization
  await init();
});
