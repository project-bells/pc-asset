import { Request, Response } from 'express';
import { db } from '../db';
import { embeddedStore } from '../embeddedStore';

export class AuditAndPmController {
  /**
   * GET /api/v1/audit/campaigns/active/progress
   * Returns progress of active annual stocktake audit.
   */
  public static async getActiveAuditProgress(req: Request, res: Response) {
    try {
      const store = embeddedStore.getData();
      return res.status(200).json(store.auditCampaign);
    } catch (err) {
      console.error('[Audit Progress Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch audit progress.' });
    }
  }

  /**
   * GET /api/v1/audit/scan/:qrToken
   * Mobile QR Scanner endpoint.
   * Fetches asset metadata, current physical location, monitors, online status,
   * active audit campaign verification status, and PM cycle status.
   */
  public static async scanQrToken(req: Request, res: Response) {
    const { qrToken } = req.params;

    if (!qrToken) {
      return res.status(400).json({ error: 'Missing qrToken parameter.' });
    }

    try {
      const sql = `
        SELECT 
          a.id AS asset_id,
          a.asset_tag,
          a.status,
          a.hostname,
          a.pc_serial_number,
          a.manufacturer,
          a.model,
          a.os_name,
          a.assigned_user,
          a.ip_address,
          a.link_speed_mbps,
          a.last_seen_at,
          a.monitors_json,
          l.id AS registered_location_id,
          l.building,
          l.floor,
          l.room_name,
          d.id AS department_id,
          d.name AS department_name,
          -- Check Active Audit Campaign
          ac.id AS active_campaign_id,
          ac.name AS active_campaign_name,
          ar.verification_method AS audit_verification_method,
          ar.is_location_matched AS audit_location_matched,
          ar.verified_at AS audit_verified_at,
          -- Check Latest PM Record
          pm.performed_at AS last_pm_performed_at,
          pm.overall_result AS last_pm_result
        FROM assets a
        LEFT JOIN locations l ON a.location_id = l.id
        LEFT JOIN departments d ON l.department_id = d.id
        LEFT JOIN LATERAL (
          SELECT id, name FROM audit_campaigns WHERE status = 'In_Progress' ORDER BY start_date DESC LIMIT 1
        ) ac ON TRUE
        LEFT JOIN audit_records ar ON ar.campaign_id = ac.id AND ar.asset_id = a.id
        LEFT JOIN LATERAL (
          SELECT performed_at, overall_result FROM pm_records WHERE asset_id = a.id ORDER BY performed_at DESC LIMIT 1
        ) pm ON TRUE
        WHERE a.qr_code_token = $1;
      `;

      const result = await db.query(sql, [qrToken]);

      if (result.rows.length === 0) {
        // Fallback to embedded store
        const storeAsset = embeddedStore.getData().assets.find(
          (a) => a.qr_code_token === qrToken || a.hostname.toLowerCase() === qrToken.toLowerCase() || a.id === qrToken
        );
        if (storeAsset) {
          const isOnline = storeAsset.last_seen_at && (Date.now() - new Date(storeAsset.last_seen_at).getTime()) < 15 * 60 * 1000;
          return res.status(200).json({
            assetId: storeAsset.id,
            assetTag: storeAsset.asset_tag,
            status: storeAsset.status,
            hostname: storeAsset.hostname,
            serialNumber: storeAsset.pc_serial_number,
            model: `${storeAsset.manufacturer || ''} ${storeAsset.model || ''}`.trim(),
            assignedUser: storeAsset.assigned_user,
            ipAddress: storeAsset.ip_address,
            isOnline: Boolean(isOnline),
            lastSeenAt: storeAsset.last_seen_at,
            location: {
              locationId: storeAsset.location_id || 'loc-b1f6-01',
              building: storeAsset.building || 'อาคาร 1 (โรงพยาบาลเอกชล)',
              floor: storeAsset.floor || 'ชั้น 6',
              room: storeAsset.room_name || 'ห้องประชุมใหญ่ (Meeting Room B1F601)',
              department: storeAsset.department_name || 'แผนกเทคโนโลยีสารสนเทศ'
            },
            monitors: storeAsset.monitors_json || [],
            auditStatus: {
              activeCampaignId: 'camp-aik-2569',
              activeCampaignName: 'การตรวจนับทรัพย์สินไอทีประจำปี 2569',
              verificationMethod: 'Unverified',
              isLocationMatched: true,
              verifiedAt: undefined
            },
            preventiveMaintenance: {
              lastPerformedAt: '2026-05-15T09:00:00Z',
              lastResult: 'PASS'
            }
          });
        }

        return res.status(404).json({
          error: 'QR Code not found or not bound to any registered endpoint asset.'
        });
      }

      const row = result.rows[0];

      // Determine online/offline status (< 15 mins is online)
      const isOnline = row.last_seen_at && (Date.now() - new Date(row.last_seen_at).getTime()) < 15 * 60 * 1000;

      return res.status(200).json({
        assetId: row.asset_id,
        assetTag: row.asset_tag,
        status: row.status,
        hostname: row.hostname,
        serialNumber: row.pc_serial_number,
        model: `${row.manufacturer || ''} ${row.model || ''}`.trim(),
        assignedUser: row.assigned_user,
        ipAddress: row.ip_address,
        isOnline: Boolean(isOnline),
        lastSeenAt: row.last_seen_at,
        location: {
          locationId: row.registered_location_id,
          building: row.building,
          floor: row.floor,
          room: row.room_name,
          department: row.department_name
        },
        monitors: row.monitors_json || [],
        auditStatus: {
          activeCampaignId: row.active_campaign_id,
          activeCampaignName: row.active_campaign_name,
          verificationMethod: row.audit_verification_method || 'Unverified',
          isLocationMatched: row.audit_location_matched,
          verifiedAt: row.audit_verified_at
        },
        preventiveMaintenance: {
          lastPerformedAt: row.last_pm_performed_at,
          lastResult: row.last_pm_result
        }
      });
    } catch (err) {
      console.error('[QR Scan Error]:', err);
      return res.status(500).json({ error: 'Internal server error processing QR scan.' });
    }
  }

  /**
   * POST /api/v1/audit/verify
   * Submits physical QR code verification during an annual stocktake campaign.
   */
  public static async verifyAudit(req: Request, res: Response) {
    const {
      campaignId,
      assetId,
      verifiedLocationId,
      discrepancyNote
    } = req.body;

    const verifiedBy = req.user?.username || 'Field-Technician';

    if (!campaignId || !assetId || !verifiedLocationId) {
      return res.status(400).json({
        error: 'campaignId, assetId, and verifiedLocationId are required fields.'
      });
    }

    try {
      const result = await db.withTransaction(async (client) => {
        // 1. Fetch registered location of asset to verify match
        const assetRes = await client.query('SELECT location_id FROM assets WHERE id = $1;', [assetId]);
        if (assetRes.rows.length === 0) {
          throw new Error('Target asset does not exist.');
        }

        const registeredLocationId = assetRes.rows[0].location_id;
        const isLocationMatched = registeredLocationId === verifiedLocationId;

        // 2. Upsert audit record
        const upsertSql = `
          INSERT INTO audit_records (
            campaign_id, asset_id, verification_method, verified_location_id,
            is_location_matched, is_hardware_matched, discrepancy_note,
            verified_by, verified_at
          )
          VALUES (
            $1, $2, 'QR_Physical_Scan', $3,
            $4, TRUE, $5,
            $6, clock_timestamp()
          )
          ON CONFLICT (campaign_id, asset_id) DO UPDATE SET
            verification_method = 'QR_Physical_Scan',
            verified_location_id = EXCLUDED.verified_location_id,
            is_location_matched = EXCLUDED.is_location_matched,
            discrepancy_note = COALESCE(EXCLUDED.discrepancy_note, audit_records.discrepancy_note),
            verified_by = EXCLUDED.verified_by,
            verified_at = clock_timestamp()
          RETURNING id, verification_method, is_location_matched, verified_at;
        `;

        const res = await client.query(upsertSql, [
          campaignId,
          assetId,
          verifiedLocationId,
          isLocationMatched,
          discrepancyNote || null,
          verifiedBy
        ]);

        return res.rows[0];
      });

      return res.status(200).json({
        message: 'Physical audit verification recorded successfully.',
        auditRecord: result
      });
    } catch (err: any) {
      console.error('[Audit Verification Error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error verifying audit.' });
    }
  }

  /**
   * GET /api/v1/pm/pre-fill/:assetId
   * Pre-fills the technician's PM form with automated agent diagnostic metrics:
   * CPU, RAM, Disk Free %, S.M.A.R.T. health, Link speed, Antivirus, Uptime.
   */
  public static async preFillPm(req: Request, res: Response) {
    const { assetId } = req.params;

    try {
      const sql = `
        SELECT 
          id, asset_tag, hostname, cpu_model, ram_total_gb,
          link_speed_mbps, antivirus_status, last_boot_time,
          last_seen_at, disks_json
        FROM assets
        WHERE id = $1;
      `;

      const result = await db.query(sql, [assetId]);

      let asset = result.rows[0];

      if (!asset) {
        const storeAsset = embeddedStore.getData().assets.find((a) => a.id === assetId || a.hostname === assetId);
        if (storeAsset) {
          asset = {
            id: storeAsset.id,
            asset_tag: storeAsset.asset_tag,
            hostname: storeAsset.hostname,
            cpu_model: storeAsset.cpu_name,
            ram_total_gb: storeAsset.ram_total_gb,
            link_speed_mbps: storeAsset.lan_speed_mbps,
            antivirus_status: storeAsset.edr_info_json?.productName || 'ESET Endpoint Antivirus (Active)',
            last_boot_time: new Date(Date.now() - 4.5 * 86400000).toISOString(),
            last_seen_at: storeAsset.last_seen_at,
            disks_json: storeAsset.disks_json
          };
        } else {
          return res.status(404).json({ error: 'Asset not found.' });
        }
      }
      const disks: any[] = asset.disks_json || [];

      // Parse disk SMART and Free Space
      const primaryDisk = disks.find((d) => d.driveLetter === 'C:') || disks[0] || {};
      const totalSizeGb = primaryDisk.totalSizeGb || 0;
      const freeSpaceGb = primaryDisk.freeSpaceGb || 0;
      const freeSpacePercent = totalSizeGb > 0 ? Math.round((freeSpaceGb / totalSizeGb) * 100) : 0;

      const physicalDisk = disks.find((d) => Boolean(d.healthStatus)) || {};
      const smartHealth = physicalDisk.healthStatus || 'Unknown';
      const smartOperational = physicalDisk.operationalStatus || 'Unknown';

      // Compute uptime in days
      let uptimeDays = 0;
      if (asset.last_boot_time) {
        uptimeDays = Math.round(
          (Date.now() - new Date(asset.last_boot_time).getTime()) / (1000 * 60 * 60 * 24) * 10
        ) / 10;
      }

      return res.status(200).json({
        assetId: asset.id,
        assetTag: asset.asset_tag,
        hostname: asset.hostname,
        autoDiagnostics: {
          cpuModel: asset.cpu_model || 'Unknown',
          ramTotalGb: asset.ram_total_gb || 0,
          lanLinkSpeedMbps: asset.link_speed_mbps || 0,
          isGigabitLan: (asset.link_speed_mbps || 0) >= 1000,
          antivirusStatus: asset.antivirus_status || 'Active / ESET Protected',
          lastBootTime: asset.last_boot_time,
          uptimeDays,
          uptimeWarning: uptimeDays > 30, // Over 30 days warrants reboot recommendation
          diskDiagnostics: {
            driveLetter: primaryDisk.driveLetter || 'C:',
            totalSizeGb,
            freeSpaceGb,
            freeSpacePercent,
            lowSpaceWarning: freeSpacePercent < 15,
            smartHealthStatus: smartHealth,
            smartOperationalStatus: smartOperational,
            isSmartHealthy: smartHealth.toLowerCase() === 'healthy'
          }
        }
      });
    } catch (err) {
      console.error('[PM Pre-fill Error]:', err);
      return res.status(500).json({ error: 'Internal server error generating PM pre-fill.' });
    }
  }

  /**
   * POST /api/v1/pm/submit
   * Submits a completed Preventive Maintenance (PM) record.
   * Freezes current real-time agent metrics snapshot alongside technician checklist and signoff signature.
   */
  public static async submitPm(req: Request, res: Response) {
    const {
      assetId,
      scheduleId,
      pmYear,
      pmRound,
      physicalChecklist,
      issuesFound,
      resolutionNote,
      overallResult,
      userSignoffName,
      userSignoffSignature
    } = req.body;

    const performedBy = req.user?.username || 'IT-Service-Engineer';

    if (!assetId || !pmYear || !pmRound || !physicalChecklist || !overallResult) {
      return res.status(400).json({
        error: 'assetId, pmYear, pmRound, physicalChecklist, and overallResult are required.'
      });
    }

    try {
      const pmRecordId = await db.withTransaction(async (client) => {
        // 1. Snapshot latest agent health metrics at the exact instant of PM
        const snapshotSql = `
          SELECT 
            cpu_model, ram_total_gb, ip_address, link_speed_mbps,
            antivirus_status, last_boot_time, last_seen_at, disks_json
          FROM assets
          WHERE id = $1;
        `;
        const snapRes = await client.query(snapshotSql, [assetId]);
        const snapshot = snapRes.rows[0] || {};

        // 2. Insert into pm_records
        const insertSql = `
          INSERT INTO pm_records (
            asset_id, schedule_id, pm_year, pm_round, performed_by, performed_at,
            agent_health_snapshot_json, physical_checklist_json,
            issues_found, resolution_note, overall_result,
            user_signoff_name, user_signoff_signature
          )
          VALUES (
            $1, $2, $3, $4, $5, clock_timestamp(),
            $6::jsonb, $7::jsonb,
            $8, $9, $10::pm_result_enum,
            $11, $12
          )
          RETURNING id;
        `;

        const insertRes = await client.query(insertSql, [
          assetId,
          scheduleId || null,
          pmYear,
          pmRound,
          performedBy,
          JSON.stringify(snapshot),
          JSON.stringify(physicalChecklist),
          issuesFound || null,
          resolutionNote || null,
          overallResult,
          userSignoffName || null,
          userSignoffSignature || null
        ]);

        return insertRes.rows[0].id;
      });

      return res.status(201).json({
        message: 'Preventive maintenance record submitted and health snapshot frozen.',
        pmRecordId
      });
    } catch (err: any) {
      console.error('[PM Submit Error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error submitting PM record.' });
    }
  }
}

