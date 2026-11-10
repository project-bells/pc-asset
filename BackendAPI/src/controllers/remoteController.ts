import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { GuacamoleCryptoService } from '../services/guacamoleCryptoService';
import { logAdminAudit } from '../middleware/securityMiddleware';

export class RemoteController {
  /**
   * POST /api/v1/admin/assets/:id/remote-session
   * Generates an encrypted, 60-second ephemeral Guacamole token using guacamole-auth-json.
   * Creates an immutable ISO 27001/PDPA security audit log entry.
   */
  public static async createRemoteSession(req: Request, res: Response) {
    const { id } = req.params;
    const { accessReason, accessMode } = req.body as {
      accessReason: string;
      accessMode: 'VIEW_ONLY' | 'FULL_CONTROL';
    };

    try {
      // 1. Fetch target asset details
      const assetQuery = `
        SELECT id, hostname, ip_address, vnc_port, vnc_status, vnc_password_encrypted, last_seen_at
        FROM assets
        WHERE id = $1;
      `;
      const assetRes = await db.query(assetQuery, [id]);

      if (assetRes.rows.length === 0) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'The requested computer asset does not exist in inventory.'
        });
      }

      const asset = assetRes.rows[0];

      // 2. Validate IP connectivity
      if (!asset.ip_address) {
        return res.status(400).json({
          error: 'MissingIpAddress',
          message: `Workstation ${asset.hostname} does not have an active IP address reported.`
        });
      }

      // 3. Online Check (Warn/Log if seen > 15 minutes ago)
      const nowMs = Date.now();
      const lastSeenMs = asset.last_seen_at ? new Date(asset.last_seen_at).getTime() : 0;
      const isOnline = lastSeenMs > 0 && nowMs - lastSeenMs <= 15 * 60 * 1000;

      // 4. Resolve UltraVNC Password & Port
      let vncPassword: string | undefined;
      if (asset.vnc_password_encrypted) {
        try {
          vncPassword = GuacamoleCryptoService.decryptVncPassword(asset.vnc_password_encrypted);
        } catch (e) {
          console.warn(`[RemoteController] Failed decrypting custom VNC password for ${asset.hostname}, using global fallback.`, e);
        }
      }

      const vncPort = asset.vnc_port || 5900;
      const auditLogId = 'rem-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const timestamp = Date.now();
      const recordingFilename = `${auditLogId}_${asset.hostname.replace(/[^a-zA-Z0-9_-]/g, '')}_${timestamp}.guac`;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const techUserId = req.user?.userId || 'usr-tech-01';
      const techUsername = req.user?.username || 'technician';

      // 5. Insert Immutable Security Audit Log (Audit-First principle)
      const insertAuditSql = `
        INSERT INTO remote_access_logs (
          id, asset_id, hostname, target_ip, technician_user_id, technician_username,
          access_mode, access_reason, recording_filename, client_source_ip, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, clock_timestamp())
        RETURNING id;
      `;

      await db.query(insertAuditSql, [
        auditLogId,
        asset.id,
        asset.hostname,
        asset.ip_address,
        techUserId,
        techUsername,
        accessMode,
        accessReason,
        recordingFilename,
        clientIp
      ]);

      // 6. Build and Encrypt Guacamole Payload
      const guacPayload = GuacamoleCryptoService.buildGuacamolePayload({
        technicianUsername: techUsername,
        targetHostname: asset.hostname,
        targetIp: asset.ip_address,
        vncPort,
        vncPassword,
        accessMode,
        auditLogId
      });

      const encryptedBase64Token = GuacamoleCryptoService.encryptAuthToken(guacPayload);

      // 7. Exchange with Guacamole or construct direct launch URL
      const launchResult = await GuacamoleCryptoService.exchangeOrBuildLaunchUrl(
        encryptedBase64Token,
        asset.hostname,
        asset.ip_address
      );

      // 8. Admin Security Audit Log
      logAdminAudit(
        'REMOTE_VNC_LAUNCH',
        req.user,
        asset.id,
        {
          auditLogId,
          targetHostname: asset.hostname,
          targetIp: asset.ip_address,
          accessMode,
          accessReason,
          isOnline
        },
        req
      );

      return res.status(200).json({
        success: true,
        auditLogId,
        launchUrl: launchResult.launchUrl,
        directTokenParam: launchResult.directTokenParam,
        targetHostname: asset.hostname,
        targetIp: asset.ip_address,
        vncPort,
        accessMode,
        isOnline,
        expiresInSeconds: 60,
        sessionRecording: recordingFilename
      });
    } catch (err: any) {
      console.error('[RemoteController] createRemoteSession error:', err);
      return res.status(500).json({
        error: 'RemoteSessionError',
        message: 'Failed to initiate remote Guacamole session.'
      });
    }
  }

  /**
   * GET /api/v1/admin/remote/logs
   * Retrieves paginated remote access audit history for security reviews.
   */
  public static async listRemoteAccessLogs(req: Request, res: Response) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
      const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || 50), 10)));
      const offset = (page - 1) * limit;

      let sql = 'SELECT * FROM vw_remote_access_audit_logs';
      let countSql = 'SELECT COUNT(*) as total FROM remote_access_logs';
      const params: any[] = [];

      if (search) {
        sql += ' WHERE hostname ILIKE $1 OR technician_username ILIKE $1 OR target_ip ILIKE $1 OR access_reason ILIKE $1';
        countSql += ' WHERE hostname ILIKE $1 OR technician_username ILIKE $1 OR target_ip ILIKE $1 OR access_reason ILIKE $1';
        params.push(`%${search}%`);
      }

      sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset};`;

      const [dataRes, countRes] = await Promise.all([
        db.query(sql, params),
        db.query(countSql, params)
      ]);

      const logs = dataRes.rows || [];
      const total = parseInt(countRes.rows?.[0]?.total || logs.length.toString(), 10);

      return res.status(200).json({
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err: any) {
      console.error('[RemoteController] listRemoteAccessLogs error:', err);
      return res.status(500).json({
        error: 'RemoteLogsError',
        message: 'Failed to retrieve remote access audit logs.'
      });
    }
  }
}
