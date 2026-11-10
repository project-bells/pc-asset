import crypto from 'crypto';
import { config } from '../config';

export interface GuacamoleConnectionParameters {
  hostname: string;
  port: string;
  password?: string;
  'color-depth'?: string;
  encodings?: string;
  'swap-red-blue'?: string;
  'read-only'?: string;
  'recording-path'?: string;
  'recording-name'?: string;
  [key: string]: string | undefined;
}

export interface GuacamoleConnection {
  protocol: 'vnc' | 'rdp' | 'ssh';
  parameters: GuacamoleConnectionParameters;
}

export interface GuacamoleAuthPayload {
  username: string;
  expires: number;
  connections: Record<string, GuacamoleConnection>;
}

export interface CreateRemoteSessionOptions {
  technicianUsername: string;
  targetHostname: string;
  targetIp: string;
  vncPort?: number;
  vncPassword?: string;
  accessMode: 'VIEW_ONLY' | 'FULL_CONTROL';
  auditLogId: string;
}

export class GuacamoleCryptoService {
  /**
   * Generates standard Guacamole JSON payload according to guacamole-auth-json spec.
   * Enforces 60-second strict ephemeral expiration to prevent token replay or bookmarking.
   */
  public static buildGuacamolePayload(opts: CreateRemoteSessionOptions): GuacamoleAuthPayload {
    const connectionKey = `${opts.targetHostname} (${opts.targetIp})`;
    const timestamp = Date.now();
    const expires = timestamp + 60 * 1000; // 60 seconds TTL

    const recordingName = `${opts.auditLogId}_${opts.targetHostname.replace(/[^a-zA-Z0-9_-]/g, '')}_${timestamp}.guac`;

    return {
      username: opts.technicianUsername,
      expires,
      connections: {
        [connectionKey]: {
          protocol: 'vnc',
          parameters: {
            hostname: opts.targetIp,
            port: String(opts.vncPort || 5900),
            password: opts.vncPassword || config.guacamole.defaultVncPassword,
            'color-depth': '24',
            encodings: 'zrle tight copyrect hextile raw',
            'swap-red-blue': 'false',
            'read-only': opts.accessMode === 'VIEW_ONLY' ? 'true' : 'false',
            'recording-path': config.guacamole.recordingPath,
            'recording-name': recordingName
          }
        }
      }
    };
  }

  /**
   * Encrypts the payload according to Apache Guacamole's guacamole-auth-json specification:
   * 1. jsonBytes = UTF-8 Buffer of JSON
   * 2. hmac = HMAC-SHA256(jsonBytes, key) [32 bytes]
   * 3. signedPayload = Buffer.concat([hmac, jsonBytes])
   * 4. Encrypt with AES-128-CBC using 16-byte key and 16-byte zero IV (Buffer.alloc(16, 0)) + PKCS#7 padding
   * 5. Encode output as Base64 string
   */
  public static encryptAuthToken(payload: GuacamoleAuthPayload, secretKeyHex?: string): string {
    const keyHex = (secretKeyHex || config.guacamole.jsonSecretKeyHex).trim();
    const key = Buffer.from(keyHex, 'hex');

    if (key.length !== 16) {
      throw new Error(`Guacamole secret key must be exactly 16 bytes (32 hex characters). Provided: ${key.length} bytes.`);
    }

    const jsonString = JSON.stringify(payload);
    const jsonBytes = Buffer.from(jsonString, 'utf8');

    // 1. Compute 32-byte HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', key).update(jsonBytes).digest();

    // 2. Prepend HMAC signature to the JSON buffer
    const signedPayload = Buffer.concat([hmac, jsonBytes]);

    // 3. Encrypt using AES-128-CBC with 16-byte zero IV
    const zeroIv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, zeroIv);
    cipher.setAutoPadding(true); // PKCS#7

    const encrypted = Buffer.concat([cipher.update(signedPayload), cipher.final()]);

    // 4. Return as standard Base64
    return encrypted.toString('base64');
  }

  /**
   * Decrypts and verifies a guacamole-auth-json token.
   * Useful for unit testing, token verification, and reverse authentication.
   */
  public static decryptAuthToken(base64Token: string, secretKeyHex?: string): GuacamoleAuthPayload {
    const keyHex = (secretKeyHex || config.guacamole.jsonSecretKeyHex).trim();
    const key = Buffer.from(keyHex, 'hex');

    if (key.length !== 16) {
      throw new Error(`Guacamole secret key must be exactly 16 bytes (32 hex characters).`);
    }

    const encryptedBytes = Buffer.from(base64Token, 'base64');
    const zeroIv = Buffer.alloc(16, 0);

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, zeroIv);
    decipher.setAutoPadding(true);

    const decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);

    if (decrypted.length < 32) {
      throw new Error('Malformed decrypted payload: buffer is smaller than 32-byte HMAC signature.');
    }

    const receivedHmac = decrypted.subarray(0, 32);
    const jsonBytes = decrypted.subarray(32);

    // Verify HMAC-SHA256 signature using constant-time comparison
    const expectedHmac = crypto.createHmac('sha256', key).update(jsonBytes).digest();
    if (!crypto.timingSafeEqual(receivedHmac, expectedHmac)) {
      throw new Error('Guacamole signature verification failed: payload has been tampered with or key is invalid.');
    }

    const jsonString = jsonBytes.toString('utf8');
    const parsed: GuacamoleAuthPayload = JSON.parse(jsonString);

    // Check expiration
    if (parsed.expires < Date.now()) {
      throw new Error(`Guacamole token has expired at ${new Date(parsed.expires).toISOString()}`);
    }

    return parsed;
  }

  // ===========================================================================
  // Per-PC VNC Password Encryption (AES-256-GCM)
  // ===========================================================================

  private static getMasterGcmKey(): Buffer {
    // Derive a 32-byte key from JWT secret for localized database credential encryption
    return crypto.createHash('sha256').update(config.jwtSecret).digest();
  }

  public static encryptVncPassword(plainText: string): string {
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const key = this.getMasterGcmKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted (hex encoded)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public static decryptVncPassword(cipherText: string): string {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted password format: expected iv:tag:ciphertext');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');

    const key = this.getMasterGcmKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Exchanges the encrypted base64 payload with Guacamole REST API to generate an active authToken,
   * or builds the direct client launch URL.
   */
  public static async exchangeOrBuildLaunchUrl(
    encryptedBase64: string,
    targetHostname: string,
    targetIp: string
  ): Promise<{ launchUrl: string; authToken?: string; directTokenParam: string }> {
    const connectionKey = `${targetHostname} (${targetIp})`;
    const guacPublicUrl = config.guacamole.publicUrl.replace(/\/$/, '');
    const directTokenParam = encodeURIComponent(encryptedBase64);

    try {
      // Optional: Exchange with Guacamole server if available
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${config.guacamole.internalUrl.replace(/\/$/, '')}/api/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${directTokenParam}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as any;
        if (data.authToken) {
          const clientIdentifier = encodeURIComponent(btoa(`${connectionKey}\0c\0json`));
          return {
            launchUrl: `${guacPublicUrl}/#/?token=${data.authToken}`,
            authToken: data.authToken,
            directTokenParam
          };
        }
      }
    } catch {
      // If Guacamole is starting or separate container, fallback to direct JSON data parameter launch URL
    }

    // Direct token launch URL handled natively by guacamole-auth-json
    // The web browser submits or renders Guacamole with the auth token in hash
    const launchUrl = `${guacPublicUrl}/#/?data=${directTokenParam}`;
    return {
      launchUrl,
      directTokenParam
    };
  }
}

