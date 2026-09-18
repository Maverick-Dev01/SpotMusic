const { execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class LicenseService {
  constructor() {
    this.masterSecret = 'SNAPMUSIC-MASTER-KEY-2026-X99';
    this.cachedMachineId = null;
    const userData = (app && typeof app.getPath === 'function')
      ? app.getPath('userData')
      : path.join(os.homedir(), '.snapmusic');
    
    if (!fs.existsSync(userData)) {
      try { fs.mkdirSync(userData, { recursive: true }); } catch (e) {}
    }

    this.licenseFile = path.join(userData, 'snapmusic-license.json');
    this.supabaseUrl = 'https://ekxbhsztryixtstksmiw.supabase.co';
    this.supabaseAnonKey = 'sb_publishable__6pHi1TcS0HVmW-XryfCnQ_r5MqzPG9';
    this.lastOnlineCheck = 0;
    this.cachedCloudStatus = null;
  }

  getMachineId() {
    if (this.cachedMachineId) return this.cachedMachineId;

    try {
      if (process.platform === 'darwin') {
        const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8' });
        const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
          this.cachedMachineId = match[1].trim().toUpperCase();
          return this.cachedMachineId;
        }
      } else if (process.platform === 'win32') {
        try {
          const out = execSync('powershell -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8' });
          const cleaned = out.trim().toUpperCase();
          if (cleaned && cleaned.length > 8) {
            this.cachedMachineId = cleaned;
            return this.cachedMachineId;
          }
        } catch (winErr) {
          const wmicOut = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
          const lines = wmicOut.trim().split('\n');
          if (lines.length > 1 && lines[1].trim()) {
            this.cachedMachineId = lines[1].trim().toUpperCase();
            return this.cachedMachineId;
          }
        }
      }
    } catch (err) {
      console.warn('Hardware ID detection fallback:', err.message);
    }

    // Fallback: stable hash from machine parameters
    const raw = `${os.hostname()}-${os.cpus()[0]?.model || 'cpu'}-${os.platform()}-${os.arch()}`;
    this.cachedMachineId = crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32).toUpperCase();
    return this.cachedMachineId;
  }

  verifyToken(token, customSecret = null) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { valid: false, error: 'Formato de token inválido' };
    }

    const secret = customSecret || this.masterSecret;
    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Estructura de clave incorrecta' };
    }

    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');

    if (signature !== expectedSig) {
      return { valid: false, error: 'Firma de licencia inválida o clave no autorizada' };
    }

    let payload;
    try {
      const decoded = Buffer.from(payloadB64, 'base64url').toString('utf8');
      payload = JSON.parse(decoded);
    } catch (e) {
      return { valid: false, error: 'No se pudo decodificar la información de la licencia' };
    }

    // Validate Machine ID
    const currentMachineId = this.getMachineId();
    if (payload.machineId !== currentMachineId) {
      return {
        valid: false,
        error: `Esta licencia no corresponde a este equipo. (Asignada a: ${payload.machineId.substring(0, 8)}..., Tu equipo: ${currentMachineId.substring(0, 8)}...)`
      };
    }

    // Validate Expiration
    if (payload.expiresAt !== -1) {
      const now = Date.now();
      if (now > payload.expiresAt) {
        const expiredDate = new Date(payload.expiresAt).toLocaleDateString();
        return {
          valid: false,
          expired: true,
          error: `La licencia expiró el ${expiredDate}. Por favor solicita una renovación.`
        };
      }
    }

    const remainingMs = payload.expiresAt === -1 ? null : Math.max(0, payload.expiresAt - Date.now());
    const remainingDays = remainingMs ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24)) : 'Permanente';

    return {
      valid: true,
      clientName: payload.clientName || 'Usuario',
      expiresAt: payload.expiresAt,
      isPermanent: payload.expiresAt === -1,
      remainingDays: remainingDays,
      issuedAt: payload.issuedAt,
      machineId: currentMachineId
    };
  }

  async checkOnlineStatus(token, machineId) {
    if (!token) return { valid: false, error: 'Token no proporcionado' };

    const hwId = machineId || this.getMachineId();

    // 1. Check directly via Supabase RPC check_license
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/check_license`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseAnonKey,
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_token: token.trim(),
          p_machine_id: hwId
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (data.status === 'revoked') {
            return {
              valid: false,
              revoked: true,
              status: 'revoked',
              reason: 'REVOKED',
              error: data.message || 'Esta licencia ha sido REVOCADA por el administrador en KeyForge Pro.'
            };
          }
          if (data.status === 'not_found') {
            return {
              valid: false,
              notFound: true,
              status: 'not_found',
              reason: 'NOT_FOUND',
              error: 'Esta licencia fue eliminada del servidor de licencias.'
            };
          }
          if (data.valid === false) {
            return {
              valid: false,
              status: data.status || 'invalid',
              reason: data.reason || 'INVALID',
              error: data.message || 'Licencia rechazada por el servidor.'
            };
          }
          if (data.valid === true) {
            return {
              valid: true,
              onlineVerified: true,
              status: 'active',
              clientName: data.clientName,
              expiresAt: data.expiresAt,
              isPermanent: data.isPermanent
            };
          }
        }
      }
    } catch (rpcErr) {
      // Network timeout or RPC not yet deployed in Supabase
    }

    // 2. Fallback: Check KeyForge verify API if available
    const apiEndpoints = [
      'https://license-eight-ruby.vercel.app/api/verify',
      'https://license-dwtlltjib-lamb-dev.vercel.app/api/verify',
      'http://localhost:3000/api/verify'
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.trim(),
            machineId: hwId,
            secretKey: this.masterSecret
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const result = await res.json();
          if (result.reason === 'REVOKED') {
            return {
              valid: false,
              revoked: true,
              status: 'revoked',
              reason: 'REVOKED',
              error: result.message || 'Esta licencia ha sido REVOCADA por el administrador.'
            };
          }
          if (result.valid) {
            return { valid: true, onlineVerified: true, ...result };
          }
        }
      } catch (e) {}
    }

    // If completely offline, report offline but don't block if local signature is mathematically sound
    return { valid: true, offline: true };
  }

  async saveLicense(token) {
    const localCheck = this.verifyToken(token);
    if (!localCheck.valid) {
      return { ...localCheck, machineId: this.getMachineId() };
    }

    // Real-time online verification before activating
    const machineId = this.getMachineId();
    const onlineCheck = await this.checkOnlineStatus(token, machineId);
    if (!onlineCheck.valid) {
      return {
        valid: false,
        revoked: onlineCheck.revoked || false,
        machineId,
        error: onlineCheck.error || 'La licencia no es válida en el servidor.'
      };
    }

    try {
      fs.writeFileSync(
        this.licenseFile,
        JSON.stringify({ token, savedAt: Date.now(), lastOnlineCheck: Date.now() }, null, 2),
        'utf8'
      );
      this.lastOnlineCheck = Date.now();
      return { ...localCheck, machineId, onlineVerified: true, success: true };
    } catch (err) {
      return { valid: false, machineId, error: 'Error al guardar la licencia: ' + err.message };
    }
  }

  async getCurrentLicense(forceOnline = false) {
    const machineId = this.getMachineId();
    try {
      if (fs.existsSync(this.licenseFile)) {
        const data = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
        if (data && data.token) {
          const localStatus = this.verifyToken(data.token);
          if (!localStatus.valid) {
            return {
              ...localStatus,
              token: data.token,
              hasLicense: true,
              machineId
            };
          }

          // Check online if forced, or cache older than 15 seconds, or if currently marked revoked
          const now = Date.now();
          const shouldCheckOnline = forceOnline || data.revoked || (now - this.lastOnlineCheck > 15000);

          if (shouldCheckOnline) {
            const cloudCheck = await this.checkOnlineStatus(data.token, machineId);
            this.lastOnlineCheck = now;

            if (cloudCheck.revoked) {
              // Update local file to record revoked state
              try {
                fs.writeFileSync(
                  this.licenseFile,
                  JSON.stringify({
                    ...data,
                    revoked: true,
                    revokedAt: now,
                    revocationReason: cloudCheck.error
                  }, null, 2),
                  'utf8'
                );
              } catch (e) {}

              return {
                valid: false,
                revoked: true,
                hasLicense: true,
                token: data.token,
                machineId,
                error: cloudCheck.error
              };
            }

            if (cloudCheck.notFound) {
              return {
                valid: false,
                notFound: true,
                hasLicense: true,
                token: data.token,
                machineId,
                error: cloudCheck.error
              };
            }

            if (cloudCheck.onlineVerified || cloudCheck.valid) {
              // LICENSE IS ACTIVE / REACTIVATED! Clear any revoked flags
              if (data.revoked) {
                delete data.revoked;
                delete data.revokedAt;
                delete data.revocationReason;
                try {
                  fs.writeFileSync(
                    this.licenseFile,
                    JSON.stringify({
                      token: data.token,
                      savedAt: data.savedAt || now,
                      lastOnlineCheck: now
                    }, null, 2),
                    'utf8'
                  );
                } catch (e) {}
              }

              return {
                ...localStatus,
                token: data.token,
                hasLicense: true,
                onlineVerified: true,
                machineId
              };
            }
          }

          // If offline or cache still fresh and local file is marked revoked
          if (data.revoked) {
            return {
              valid: false,
              revoked: true,
              hasLicense: true,
              token: data.token,
              machineId,
              error: data.revocationReason || 'Esta licencia fue REVOCADA por el administrador en KeyForge Pro.'
            };
          }

          return {
            ...localStatus,
            token: data.token,
            hasLicense: true,
            machineId
          };
        }
      }
    } catch (e) {
      console.warn('Error reading license file:', e);
    }

    return {
      valid: false,
      hasLicense: false,
      machineId
    };
  }

  removeLicense() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        fs.unlinkSync(this.licenseFile);
      }
      this.lastOnlineCheck = 0;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = new LicenseService();
