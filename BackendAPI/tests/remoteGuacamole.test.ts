import assert from 'assert';
import http from 'http';
import express from 'express';
import { GuacamoleCryptoService } from '../src/services/guacamoleCryptoService';
import adminRoutes from '../src/routes/adminRoutes';

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);

let server: http.Server;
let port: number;

function request(path: string, options: http.RequestOptions & { body?: any } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payloadStr = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(payloadStr ? { 'Content-Length': Buffer.byteLength(payloadStr) } : {}),
          ...(options.headers || {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 0,
              body: data ? JSON.parse(data) : {}
            });
          } catch {
            resolve({
              status: res.statusCode || 0,
              body: data
            });
          }
        });
      }
    );
    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

async function runGuacamoleTests() {
  console.log('====================================================');
  console.log('🔐 Starting Apache Guacamole auth-json Cryptographic Tests');
  console.log('====================================================\n');

  server = app.listen(0);
  const addr = server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Guacamole Payload Construction & 60-Second Ephemeral Expiration
    // -------------------------------------------------------------------------
    console.log('Test 1: Payload Construction & 60s Expiration');
    const samplePayload = GuacamoleCryptoService.buildGuacamolePayload({
      technicianUsername: 'it-technician-01',
      targetHostname: 'B1F601',
      targetIp: '192.168.27.145',
      vncPort: 5900,
      vncPassword: 'UltraVncSecretPassword',
      accessMode: 'FULL_CONTROL',
      auditLogId: 'audit-test-123'
    });

    assert.strictEqual(samplePayload.username, 'it-technician-01');
    assert(samplePayload.expires > Date.now(), 'Expires must be in the future');
    assert(samplePayload.expires <= Date.now() + 61000, 'Expires must not exceed 60 seconds');

    const connKey = 'B1F601 (192.168.27.145)';
    assert(samplePayload.connections[connKey], 'Connection entry must exist');
    assert.strictEqual(samplePayload.connections[connKey].protocol, 'vnc');
    assert.strictEqual(samplePayload.connections[connKey].parameters.hostname, '192.168.27.145');
    assert.strictEqual(samplePayload.connections[connKey].parameters.port, '5900');
    assert.strictEqual(samplePayload.connections[connKey].parameters['read-only'], 'false');
    console.log('  ✅ [PASS] Payload structure and expiration validated.\n');

    // -------------------------------------------------------------------------
    // Test 2: Cryptographic Encryption (HMAC-SHA256 + AES-128-CBC with Zero IV)
    // -------------------------------------------------------------------------
    console.log('Test 2: guacamole-auth-json Encryption & Decryption Round-Trip');
    const secretKeyHex = '0123456789abcdef0123456789abcdef'; // Exactly 16 bytes = 32 hex chars
    const encryptedBase64 = GuacamoleCryptoService.encryptAuthToken(samplePayload, secretKeyHex);

    assert(typeof encryptedBase64 === 'string', 'Encrypted token must be a string');
    assert(encryptedBase64.length > 50, 'Encrypted token must not be empty');

    // Decrypt and verify
    const decryptedPayload = GuacamoleCryptoService.decryptAuthToken(encryptedBase64, secretKeyHex);
    assert.strictEqual(decryptedPayload.username, samplePayload.username);
    assert.strictEqual(
      decryptedPayload.connections[connKey].parameters.password,
      'UltraVncSecretPassword'
    );
    console.log('  ✅ [PASS] Encrypted Base64 decrypted and HMAC verified.\n');

    // -------------------------------------------------------------------------
    // Test 3: Anti-Tampering & Invalid Signature Detection
    // -------------------------------------------------------------------------
    console.log('Test 3: Anti-Tamper & Signature Verification');
    const tokenBuffer = Buffer.from(encryptedBase64, 'base64');
    tokenBuffer[20] ^= 0xff; // Corrupt a byte
    const tamperedBase64 = tokenBuffer.toString('base64');

    assert.throws(
      () => GuacamoleCryptoService.decryptAuthToken(tamperedBase64, secretKeyHex),
      /signature verification failed|bad decrypt/i,
      'Tampered payload must be rejected'
    );
    console.log('  ✅ [PASS] Tampered token successfully rejected.\n');

    // -------------------------------------------------------------------------
    // Test 4: VNC Password AES-256-GCM Encryption / Decryption
    // -------------------------------------------------------------------------
    console.log('Test 4: VNC Password Encryption with AES-256-GCM');
    const vncPass = 'Hospital@SecureVnc2026!';
    const encryptedVnc = GuacamoleCryptoService.encryptVncPassword(vncPass);
    assert.notStrictEqual(encryptedVnc, vncPass);
    assert(encryptedVnc.includes(':'), 'Encrypted string must contain iv:tag:data');

    const decryptedVnc = GuacamoleCryptoService.decryptVncPassword(encryptedVnc);
    assert.strictEqual(decryptedVnc, vncPass);
    console.log('  ✅ [PASS] AES-256-GCM password round-trip succeeded.\n');

    // -------------------------------------------------------------------------
    // Test 5: POST /api/v1/admin/assets/:id/remote-session API
    // -------------------------------------------------------------------------
    console.log('Test 5: POST /api/v1/admin/assets/:id/remote-session Endpoint');
    const sessionRes = await request(
      '/api/v1/admin/assets/70658300-54b5-11f0-8aa1-445eb2a83c00/remote-session',
      {
        method: 'POST',
        body: {
          accessReason: 'แก้ไขปัญหาตามแจ้งซ่อม: ผู้ใช้งานแจ้งพิมพ์เอกสารไม่ออก',
          accessMode: 'FULL_CONTROL'
        }
      }
    );

    assert.strictEqual(sessionRes.status, 200, `Expected 200 OK, got ${sessionRes.status}`);
    assert.strictEqual(sessionRes.body.success, true);
    assert(sessionRes.body.auditLogId, 'Must return auditLogId');
    assert(sessionRes.body.launchUrl, 'Must return launchUrl');
    assert.strictEqual(sessionRes.body.targetHostname, 'B1F601');
    assert.strictEqual(sessionRes.body.accessMode, 'FULL_CONTROL');
    assert.strictEqual(sessionRes.body.expiresInSeconds, 60);
    console.log('  Audit Log ID:', sessionRes.body.auditLogId);
    console.log('  Launch URL:', sessionRes.body.launchUrl.slice(0, 60) + '...');
    console.log('  ✅ [PASS] Remote session initialization succeeded.\n');

    // -------------------------------------------------------------------------
    // Test 6: GET /api/v1/admin/remote/logs Audit Trail API
    // -------------------------------------------------------------------------
    console.log('Test 6: GET /api/v1/admin/remote/logs Audit Log API');
    const logsRes = await request('/api/v1/admin/remote/logs');
    assert.strictEqual(logsRes.status, 200);
    assert(Array.isArray(logsRes.body.logs), 'Logs must be an array');
    assert(logsRes.body.logs.length >= 1, 'Should contain at least 1 audit record');

    const recorded = logsRes.body.logs.find((l: any) => l.id === sessionRes.body.auditLogId);
    assert(recorded, 'The created remote session must be in the audit logs');
    assert.strictEqual(recorded.hostname, 'B1F601');
    assert.strictEqual(recorded.access_mode, 'FULL_CONTROL');
    console.log('  Verified recorded audit record:', recorded.id, '-', recorded.access_reason);
    console.log('  ✅ [PASS] Audit log inquiry succeeded.\n');

    console.log('====================================================');
    console.log('🎉 All Apache Guacamole & VNC Tests Passed!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runGuacamoleTests().catch((err) => {
  console.error('❌ Guacamole test error:', err);
  process.exit(1);
});

