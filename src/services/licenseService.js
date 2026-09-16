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

  generateToken(payload, customSecret = null) {
    const secret = customSecret || this.masterSecret;
    const jsonStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    return `${payloadB64}.${signature}`;
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
      issuedAt: payload.issuedAt
    };
  }

  saveLicense(token) {
    const check = this.verifyToken(token);
    if (!check.valid) {
      return check;
    }

    try {
      fs.writeFileSync(this.licenseFile, JSON.stringify({ token, savedAt: Date.now() }, null, 2), 'utf8');
      return { ...check, success: true };
    } catch (err) {
      return { valid: false, error: 'Error al guardar la licencia: ' + err.message };
    }
  }

  getCurrentLicense() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        const data = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
        if (data && data.token) {
          const status = this.verifyToken(data.token);
          return {
            ...status,
            token: data.token,
            hasLicense: true
          };
        }
      }
    } catch (e) {
      console.warn('Error reading license file:', e);
    }

    return {
      valid: false,
      hasLicense: false,
      machineId: this.getMachineId()
    };
  }

  removeLicense() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        fs.unlinkSync(this.licenseFile);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = new LicenseService();
