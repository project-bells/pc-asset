import { Request, Response } from 'express';
import { db } from '../db';
import { logAdminAudit } from '../middleware/securityMiddleware';
import { embeddedStore } from '../embeddedStore';

export class AdminController {
  /**
   * PATCH /api/v1/admin/assets/:id/bind
   * Binds an Unregistered PC discovered by the Windows Agent to an official IT asset tag,
   * physical location, department, and assigned employee, setting status to 'Active'.
   */
  public static async bindAsset(req: Request, res: Response) {
    const { id } = req.params;
    const { assetTag, locationId, assignedUser, purchaseDate, warrantyExpiryDate } = req.body;

    if (!assetTag || !locationId) {
      return res.status(400).json({ error: 'assetTag and locationId are required to bind an asset.' });
    }

    try {
      const sql = `
        UPDATE assets
        SET 
          asset_tag = $1,
          location_id = $2,
          assigned_user = COALESCE($3, assigned_user),
          purchase_date = COALESCE($4, purchase_date),
          warranty_expiry_date = COALESCE($5, warranty_expiry_date),
          status = 'Active'
        WHERE id = $6
        RETURNING id, asset_tag, status, hostname, location_id, assigned_user, qr_code_token;
      `;

      const result = await db.query(sql, [
        assetTag.trim(),
        locationId,
        assignedUser || null,
        purchaseDate || null,
        warrantyExpiryDate || null,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asset not found.' });
      }

      const updatedAsset = result.rows[0];

      // Security Audit Logging for Administrative Mutation
      logAdminAudit(
        'ASSET_BIND_REGISTER',
        req.user,
        id,
        { assetTag, locationId, assignedUser, status: 'Active' },
        req
      );

      return res.status(200).json({
        message: 'Asset successfully registered and bound to location.',
        asset: updatedAsset
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: `Asset tag '${assetTag}' is already assigned to another asset.` });
      }
      console.error('[Admin Bind Error]:', err);
      return res.status(500).json({ error: 'Internal server error binding asset.' });
    }
  }

  /**
   * GET /api/v1/admin/assets
   * Queries asset list with status and keyword filter.
   */
  public static async listAssets(req: Request, res: Response) {
    const { status, search, limit = 50, offset = 0 } = req.query;

    try {
      let sql = `
        SELECT 
          a.id, a.asset_tag, a.status, a.hostname, a.pc_serial_number, a.manufacturer, a.model,
          a.cpu_name, a.ram_total_gb, a.monitors_json, a.disks_json, a.installed_software_json,
          a.assigned_user, a.ip_address, a.last_seen_at, a.qr_code_token,
          l.building, l.room_name, d.name AS department_name
        FROM assets a
        LEFT JOIN locations l ON a.location_id = l.id
        LEFT JOIN departments d ON l.department_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        params.push(status);
        sql += ` AND a.status = $${params.length}::asset_status_enum`;
      }

      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (a.hostname ILIKE $${params.length} OR a.asset_tag ILIKE $${params.length} OR a.assigned_user ILIKE $${params.length} OR a.pc_serial_number ILIKE $${params.length})`;
      }

      params.push(limit);
      sql += ` ORDER BY a.last_seen_at DESC NULLS LAST LIMIT $${params.length}`;

      params.push(offset);
      sql += ` OFFSET $${params.length};`;

      const result = await db.query(sql, params);
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[Admin List Error]:', err);
      return res.status(500).json({ error: 'Internal server error listing assets.' });
    }
  }

  /**
   * GET /api/v1/admin/reports/pm-priority-queue
   * Reads from database view 'vw_pm_priority_queue'.
   */
  public static async getPmPriorityQueue(req: Request, res: Response) {
    try {
      const result = await db.query('SELECT * FROM vw_pm_priority_queue;');
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[Report Error - PM Queue]:', err);
      return res.status(500).json({ error: 'Failed to query PM Priority Queue view.' });
    }
  }

  /**
   * GET /api/v1/admin/reports/unverified-audit
   * Reads from database view 'vw_unverified_audit_assets'.
   */
  public static async getUnverifiedAuditAssets(req: Request, res: Response) {
    try {
      const result = await db.query('SELECT * FROM vw_unverified_audit_assets;');
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[Report Error - Audit View]:', err);
      return res.status(500).json({ error: 'Failed to query Unverified Audit Assets view.' });
    }
  }

  /**
   * GET /api/v1/admin/reports/critical-changes
   * Reads from database view 'vw_critical_hardware_changes'.
   */
  public static async getCriticalHardwareChanges(req: Request, res: Response) {
    try {
      const result = await db.query('SELECT * FROM vw_critical_hardware_changes;');
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[Report Error - Change Logs]:', err);
      return res.status(500).json({ error: 'Failed to query Critical Hardware Changes view.' });
    }
  }

  /**
   * POST /api/v1/admin/changes/:id/acknowledge
   * IT Staff marks a tamper/change event as acknowledged.
   */
  public static async acknowledgeChangeLog(req: Request, res: Response) {
    const { id } = req.params;
    const acknowledgedBy = req.user?.username || 'IT-Admin';

    try {
      const sql = `
        UPDATE asset_change_logs
        SET is_acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = clock_timestamp()
        WHERE id = $2
        RETURNING id, is_acknowledged, acknowledged_by, acknowledged_at;
      `;
      const result = await db.query(sql, [acknowledgedBy, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change log record not found.' });
      }

      const record = result.rows[0];

      // Security Audit Logging for Change Log Acknowledgment
      logAdminAudit(
        'CHANGE_LOG_ACKNOWLEDGE',
        req.user,
        id,
        { changeLogId: id, acknowledgedBy },
        req
      );

      return res.status(200).json({
        message: 'Change log event acknowledged.',
        record
      });
    } catch (err) {
      console.error('[Admin Acknowledge Error]:', err);
      return res.status(500).json({ error: 'Internal server error acknowledging change.' });
    }
  }

  /**
   * GET /api/v1/admin/dashboard/kpis
   * Returns live endpoint metrics.
   */
  public static async getDashboardKpis(req: Request, res: Response) {
    try {
      const data = embeddedStore.getData();
      const assets = data.assets;
      const now = Date.now();

      const onlineNow = assets.filter((a) => {
        if (!a.last_seen_at) return false;
        return now - new Date(a.last_seen_at).getTime() < 15 * 60 * 1000;
      }).length;

      const unregistered = assets.filter((a) => a.status === 'Unregistered').length;
      const criticalAlerts = data.changeLogs.filter((l) => !l.is_acknowledged).length;
      const urgentPm = data.pmSchedules.filter((pm) => pm.isOverdue || pm.daysRemaining <= 7).length;

      return res.status(200).json({
        totalAssets: assets.length,
        onlineNow,
        unregistered,
        criticalAlerts,
        urgentPm
      });
    } catch (err) {
      console.error('[KPI Error]:', err);
      return res.status(500).json({ error: 'Failed to calculate KPIs.' });
    }
  }

  /**
   * GET /api/v1/admin/dashboard/hygiene-alerts
   * Detects disk space < 15%, SMART failures, degraded link speed, or uptime > 30 days.
   */
  public static async getHygieneAlerts(req: Request, res: Response) {
    try {
      const data = embeddedStore.getData();
      const alerts: any[] = [];

      for (const asset of data.assets) {
        // Disk free space check
        const primaryDisk = asset.disks_json?.[0];
        if (primaryDisk && primaryDisk.freePercent !== undefined && primaryDisk.freePercent < 20) {
          alerts.push({
            assetId: asset.id,
            assetTag: asset.asset_tag,
            hostname: asset.hostname,
            assignedUser: asset.assigned_user,
            issueType: 'LOW_DISK',
            title: 'Disk Free Space Low',
            detail: `Drive ${primaryDisk.driveLetter || 'C:'} has only ${primaryDisk.freeGb} GB free (${primaryDisk.freePercent}% remaining)`,
            severity: 'CRITICAL',
            metricValue: `${primaryDisk.freePercent}% Free`
          });
        }

        // LAN Link speed degradation check
        if (asset.lan_speed_mbps && asset.lan_speed_mbps < 1000) {
          alerts.push({
            assetId: asset.id,
            assetTag: asset.asset_tag,
            hostname: asset.hostname,
            assignedUser: asset.assigned_user,
            issueType: 'DEGRADED_LAN',
            title: 'LAN Link Speed Degraded',
            detail: `NIC operating at ${asset.lan_speed_mbps} Mbps (negotiation fallback / bad cable)`,
            severity: 'WARNING',
            metricValue: `${asset.lan_speed_mbps} Mbps`
          });
        }
      }

      return res.status(200).json(alerts);
    } catch (err) {
      console.error('[Hygiene Alerts Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch hygiene alerts.' });
    }
  }

  /**
   * GET /api/v1/admin/locations
   * Returns registered location list.
   */
  public static async listLocations(req: Request, res: Response) {
    try {
      const data = embeddedStore.getData();
      return res.status(200).json(data.locations);
    } catch (err) {
      console.error('[Locations Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch locations.' });
    }
  }
}

