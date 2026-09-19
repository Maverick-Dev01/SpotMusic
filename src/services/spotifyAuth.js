const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, shell, safeStorage } = require('electron');
const redirectUri = 'spotmusic-login://callback';
class SpotifyAuth {
  constructor() { this.tokens = null; this.pending = null; }
  get file() { return path.join(app.getPath('userData'), 'spotify-session.enc'); }
  async connect(clientId) {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const state = crypto.randomBytes(24).toString('base64url');
    this.pending = { verifier, state, clientId, created: Date.now() };
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
      scope: 'playlist-read-private playlist-read-collaborative', state,
      code_challenge_method: 'S256', code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url') });
    await shell.openExternal('https://accounts.spotify.com/authorize?' + params);
  }
  async request(params) {
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error('Spotify no autorizó la sesión. Vuelve a vincular tu cuenta.');
    return data;
  }
  save(data, clientId) {
    this.tokens = { ...this.tokens, ...data, clientId, expiresAt: Date.now() + data.expires_in * 1000 };
    if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(this.file, safeStorage.encryptString(JSON.stringify(this.tokens)), { mode: 0o600 });
  }
  async callback(value) {
    const url = new URL(value);
    const pending = this.pending;
    if (url.protocol !== 'spotmusic-login:' || url.hostname !== 'callback' || !pending ||
        Date.now() - pending.created > 600000 || url.searchParams.get('state') !== pending.state) throw new Error('Respuesta de Spotify no válida o vencida.');
    this.pending = null;
    if (!url.searchParams.get('code')) throw new Error('Conexión con Spotify cancelada.');
    const tokens = await this.request({ client_id: pending.clientId, grant_type: 'authorization_code',
      code: url.searchParams.get('code'), redirect_uri: redirectUri, code_verifier: pending.verifier });
    this.save(tokens, pending.clientId);
  }
  async accessToken() {
    if (!this.tokens && safeStorage.isEncryptionAvailable() && fs.existsSync(this.file)) {
      try { this.tokens = JSON.parse(safeStorage.decryptString(fs.readFileSync(this.file))); } catch { return ''; }
    }
    if (!this.tokens) return '';
    if (this.tokens.expiresAt > Date.now() + 30000) return this.tokens.access_token;
    if (!this.tokens.refresh_token) return '';
    const data = await this.request({ client_id: this.tokens.clientId, grant_type: 'refresh_token', refresh_token: this.tokens.refresh_token });
    this.save(data, this.tokens.clientId);
    return this.tokens.access_token;
  }
  disconnect() { this.tokens = null; this.pending = null; if (fs.existsSync(this.file)) fs.unlinkSync(this.file); }
}
module.exports = new SpotifyAuth();
