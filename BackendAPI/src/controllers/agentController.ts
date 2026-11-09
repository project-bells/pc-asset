import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';
import { TamperDetectionService } from '../services/tamperDetectionService';
import { embeddedStore } from '../embeddedStore';

export class AgentController {
  /**
   * POST /api/v1/agent/inventory
   * Receives 12-hour hardware and software inventory snapshot from Windows Agent.
   * Performs Automated Tamper Detection and triggers Auto-Audit Verification hooks.
   */
  public static async syncInventory(req: Request, res: Response) {
    const payload = req.body;

    if (!payload?.system?.hardwareUuid) {
      return res.status(400).json({ error: 'Malformed inventory payload: hardwareUuid is required.' });
    }

    const hardwareUuid = payload.system.hardwareUuid;

    try {
      const result = await db.withTransaction(async (client) => {
        // 1. Query for existing asset
        const existingQuery = `
          SELECT id, pc_serial_number, ram_total_gb, monitors_json, disks_json, installed_software_json
          FROM assets
          WHERE hardware_uuid = $1
          FOR UPDATE;
        `;
        const existingRes = await client.query(existingQuery, [hardwareUuid]);
        const existing = existingRes.rows[0];

        let hasCriticalChanges = false;
        let changesCount = 0;

        // 2. Perform Tamper Detection Engine if asset already exists in database
        if (existing) {
          const detection = await TamperDetectionService.detectAndLogChanges(client, existing, payload);
          hasCriticalChanges = detection.hasCriticalChanges;
          changesCount = detection.changesCount;
        }

        // Calculate metrics
        const totalRamGb = payload.memoryModules?.reduce(
          (acc: number, m: any) => acc + (m.capacityGb || 0),
          0
        ) || 0;

        const primaryNet = payload.networkAdapters?.find((n: any) => Boolean(n.ipv4Address)) 
          || payload.networkAdapters?.[0];

        const ip = primaryNet?.ipv4Address || null;
        const mac = primaryNet?.macAddress || null;
        const linkSpeed = primaryNet?.linkSpeedMbps || 0;

        const combinedDisks = [
          ...(payload.logicalDisks || []),
          ...(payload.physicalDisks || [])
        ];

        const disksJson = JSON.stringify(combinedDisks);
        const monitorsJson = JSON.stringify(payload.monitors || []);
        const peripheralsJson = JSON.stringify(payload.peripherals || []);
        const softwareJson = JSON.stringify(payload.installedSoftware || []);

        const inventoryHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex');

        // 3. Upsert Asset Record
        const upsertSql = `
          INSERT INTO assets (
            hardware_uuid, hostname, pc_serial_number, manufacturer, model,
            os_name, os_build, last_logged_in_user, cpu_model, ram_total_gb,
            ip_address, mac_address, link_speed_mbps,
            disks_json, monitors_json, peripherals_json, installed_software_json,
            inventory_hash, status, qr_code_token, last_inventory_at, last_seen_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13,
            $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
            $18, 'Unregistered', encode(gen_random_bytes(16), 'hex'), clock_timestamp(), clock_timestamp()
          )
          ON CONFLICT (hardware_uuid) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            pc_serial_number = EXCLUDED.pc_serial_number,
            manufacturer = EXCLUDED.manufacturer,
            model = EXCLUDED.model,
            os_name = EXCLUDED.os_name,
            os_build = EXCLUDED.os_build,
            last_logged_in_user = EXCLUDED.last_logged_in_user,
            cpu_model = EXCLUDED.cpu_model,
            ram_total_gb = EXCLUDED.ram_total_gb,
            ip_address = COALESCE(EXCLUDED.ip_address, assets.ip_address),
            mac_address = COALESCE(EXCLUDED.mac_address, assets.mac_address),
            link_speed_mbps = EXCLUDED.link_speed_mbps,
            disks_json = EXCLUDED.disks_json,
            monitors_json = EXCLUDED.monitors_json,
            peripherals_json = EXCLUDED.peripherals_json,
            installed_software_json = EXCLUDED.installed_software_json,
            inventory_hash = EXCLUDED.inventory_hash,
            last_inventory_at = clock_timestamp(),
            last_seen_at = clock_timestamp()
          RETURNING id, status, qr_code_token;
        `;

        const upsertRes = await client.query(upsertSql, [
          hardwareUuid,
          payload.system.hostname,
          payload.system.biosSerialNumber,
          payload.system.manufacturer,
          payload.system.model,
          payload.system.osName,
          payload.system.osBuild,
          payload.system.currentLoggedInUser,
          payload.cpu?.model,
          totalRamGb,
          ip,
          mac,
          linkSpeed,
          disksJson,
          monitorsJson,
          peripheralsJson,
          softwareJson,
          inventoryHash
        ]);

        const assetId = upsertRes.rows[0].id;

        // 4. Auto-Audit Hook: Check for Active Campaign and Auto-Verify Hardware
        const activeCampaignRes = await client.query(`
          SELECT id FROM audit_campaigns 
          WHERE status = 'In_Progress' 
          ORDER BY start_date DESC 
          LIMIT 1;
        `);

        if (activeCampaignRes.rows.length > 0) {
          const campaignId = activeCampaignRes.rows[0].id;

          const auditRecordQuery = `
            SELECT id, verification_method, is_hardware_matched 
            FROM audit_records 
            WHERE campaign_id = $1 AND asset_id = $2;
          `;
          const auditRec = await client.query(auditRecordQuery, [campaignId, assetId]);

          if (auditRec.rows.length > 0 && auditRec.rows[0].verification_method === 'Pending') {
            const isHwMatched = !hasCriticalChanges;
            const updateAuditSql = `
              UPDATE audit_records 
              SET 
                verification_method = 'Agent_Auto_Verified',
                is_hardware_matched = $1,
                verified_at = clock_timestamp(),
                discrepancy_note = CASE 
                  WHEN $1 = FALSE THEN 'Automated audit flagged critical hardware tamper during inventory sync'
                  ELSE discrepancy_note
                END
              WHERE id = $2;
            `;
            await client.query(updateAuditSql, [isHwMatched, auditRec.rows[0].id]);
          }
        }

        // Sync to embedded local store for zero-config persistence
        embeddedStore.upsertAsset({
          hardwareUuid: payload.system.hardwareUuid,
          hostname: payload.system.hostname,
          serialNumber: payload.system.biosSerialNumber,
          manufacturer: payload.system.manufacturer,
          model: payload.system.model,
          osName: payload.system.osName,
          osBuild: payload.system.osBuild,
          lastLoggedInUser: payload.system.currentLoggedInUser,
          cpu: { name: payload.cpu?.model, cores: payload.cpu?.physicalCores },
          ramTotalGb: totalRamGb,
          ipAddress: ip,
          macAddress: mac,
          lanSpeedMbps: linkSpeed,
          monitors: payload.monitors,
          disks: combinedDisks,
          installedSoftware: payload.installedSoftware?.map((s: any) => ({
            name: s.displayName,
            version: s.displayVersion,
            publisher: s.publisher
          }))
        });

        return {
          assetId,
          changesDetected: changesCount,
          hasCriticalChanges
        };
      });

      return res.status(200).json({
        status: 'ok',
        inventorySynchronized: true,
        ...result
      });
    } catch (err) {
      console.error('[Agent Ingestion Error - syncInventory]:', err);
      return res.status(500).json({ error: 'Internal server error processing inventory sync.' });
    }
  }

  /**
   * POST /api/v1/agent/telemetry
   * Receives 5-minute lightweight health telemetry (CPU, RAM, Disks, Network).
   */
  public static async recordTelemetry(req: Request, res: Response) {
    const payload = req.body;

    if (!payload?.hardwareUuid) {
      return res.status(400).json({ error: 'hardwareUuid is required for telemetry recording.' });
    }

    try {
      await db.withTransaction(async (client) => {
        const primaryNet = payload.networkAdapters?.find((n: any) => n.isConnected) 
          || payload.networkAdapters?.[0];

        const ip = primaryNet?.ipv4Address || null;
        const mac = primaryNet?.macAddress || null;
        const linkSpeed = primaryNet?.linkSpeedMbps || 0;

        // 1. Update Asset last_seen_at and active IP
        const updateAssetSql = `
          INSERT INTO assets (
            hardware_uuid, hostname, ip_address, mac_address, link_speed_mbps, 
            ram_total_gb, last_seen_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
          ON CONFLICT (hardware_uuid) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            ip_address = COALESCE(EXCLUDED.ip_address, assets.ip_address),
            mac_address = COALESCE(EXCLUDED.mac_address, assets.mac_address),
            link_speed_mbps = EXCLUDED.link_speed_mbps,
            ram_total_gb = COALESCE(EXCLUDED.ram_total_gb, assets.ram_total_gb),
            last_seen_at = clock_timestamp()
          RETURNING id;
        `;

        const assetRes = await client.query(updateAssetSql, [
          payload.hardwareUuid,
          payload.hostname,
          ip,
          mac,
          linkSpeed,
          payload.ramTotalGb
        ]);

        const assetId = assetRes.rows[0].id;

        // 2. Insert Time-Series Health Metric
        const insertHealthSql = `
          INSERT INTO asset_health_logs (
            asset_id, cpu_load_percent, ram_available_gb, disks_free_json, 
            link_speed_mbps, recorded_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, clock_timestamp());
        `;

        const disksFreeJson = JSON.stringify(payload.disks || []);

        await client.query(insertHealthSql, [
          assetId,
          payload.cpuLoadPercent,
          payload.ramAvailableGb,
          disksFreeJson,
          linkSpeed
        ]);

        embeddedStore.updateTelemetry(payload);
      });

      // Respond with empty pending commands (or pending directives if any queued)
      return res.status(200).json({
        status: 'ok',
        pendingCommands: []
      });
    } catch (err) {
      console.error('[Agent Ingestion Error - recordTelemetry]:', err);
      return res.status(500).json({ error: 'Internal server error recording telemetry.' });
    }
  }

  /**
   * GET /api/v1/agent/version
   * Serves current agent version manifest for Windows Service self-updating loop.
   */
  public static async getAgentVersion(req: Request, res: Response) {
    return res.status(200).json({
      latestVersion: config.agentRelease.latestVersion,
      downloadUrl: config.agentRelease.downloadUrl,
      sha256: config.agentRelease.sha256
    });
  }

  /**
   * POST /api/v1/agent/commands/receipt
   * Receives command execution receipts from the Agent.
   */
  public static async receiveCommandReceipt(req: Request, res: Response) {
    const { commandId, status, output } = req.body;
    console.log(`[Agent Command Receipt]: Command ${commandId} finished with status '${status}': ${output}`);
    return res.status(200).json({ status: 'acknowledged' });
  }
}

