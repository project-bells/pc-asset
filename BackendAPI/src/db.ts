import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';
import { embeddedStore, EmbeddedAsset } from './embeddedStore';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

let isPgConnected = false;

pool.on('error', () => {
  isPgConnected = false;
});

export const db = {
  /**
   * Executes a query against PostgreSQL, with automatic fallback to EmbeddedStore
   * containing the real workstation data (B1F601 Lenovo i5-14400) if PostgreSQL is offline.
   */
  query: async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
    try {
      const res = await pool.query<T>(text, params);
      isPgConnected = true;
      return res;
    } catch {
      isPgConnected = false;
      const storeData = embeddedStore.getData();
      const lower = text.toLowerCase().replace(/\s+/g, ' ');

      // ==========================================
      // 1. AGENT INGESTION: INSERT / UPSERT ASSET
      // ==========================================
      // A: Full Inventory Upsert (RETURNING id, status, qr_code_token)
      if (lower.includes('insert into assets') && lower.includes('returning id, status, qr_code_token')) {
        let disks: any[] = [];
        let monitors: any[] = [];
        let peripherals: any[] = [];
        let software: any[] = [];
        let patches: any[] = [];

        try { if (params?.[13]) disks = typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13]; } catch {}
        try { if (params?.[14]) monitors = typeof params[14] === 'string' ? JSON.parse(params[14]) : params[14]; } catch {}
        try { if (params?.[15]) peripherals = typeof params[15] === 'string' ? JSON.parse(params[15]) : params[15]; } catch {}
        try { if (params?.[16]) software = typeof params[16] === 'string' ? JSON.parse(params[16]) : params[16]; } catch {}
        try { if (params?.[21]) patches = typeof params[21] === 'string' ? JSON.parse(params[21]) : params[21]; } catch {}

        const saved = embeddedStore.upsertAsset({
          hardwareUuid: params?.[0],
          hostname: params?.[1],
          serialNumber: params?.[2],
          manufacturer: params?.[3],
          model: params?.[4],
          osName: params?.[5],
          osBuild: params?.[6],
          lastLoggedInUser: params?.[7],
          cpu: { name: params?.[8], cores: 10 },
          ramTotalGb: params?.[9] || 16,
          ipAddress: params?.[10],
          macAddress: params?.[11],
          lanSpeedMbps: params?.[12] || 1000,
          disks,
          monitors,
          peripherals,
          installedSoftware: software,
          osVersion: params?.[18],
          osUbr: params?.[19],
          latestKbId: params?.[20],
          installedPatches: patches,
          pendingReboot: params?.[22],
          lastWindowsUpdate: params?.[23],
          lastBootTime: params?.[24]
        });

        return {
          rows: [{ id: saved.id, status: saved.status, qr_code_token: saved.qr_code_token }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      // B: Telemetry Update / Touch (RETURNING id)
      if (lower.includes('insert into assets') && lower.includes('returning id')) {
        const hwUuid = params?.[0];
        let asset = storeData.assets.find(
          (a) => hwUuid && a.hardware_uuid && a.hardware_uuid.toLowerCase() === hwUuid.toLowerCase()
        );

        if (!asset) {
          asset = embeddedStore.upsertAsset({
            hardwareUuid: params?.[0],
            hostname: params?.[1],
            ipAddress: params?.[2],
            macAddress: params?.[3],
            lanSpeedMbps: params?.[4] || 1000,
            ramTotalGb: params?.[5] || 16
          });
        } else {
          asset.last_seen_at = new Date().toISOString();
          if (params?.[1]) asset.hostname = params[1];
          if (params?.[2]) asset.ip_address = params[2];
          if (params?.[3]) asset.mac_address = params[3];
          if (params?.[4]) asset.lan_speed_mbps = params[4];
          if (params?.[5]) asset.ram_total_gb = params[5];
          if (params?.[6] !== undefined && params?.[6] !== null) asset.pending_reboot = Boolean(params[6]);
          if (params?.[7]) asset.last_boot_time = params[7];
          embeddedStore.save();
        }

        return {
          rows: [{ id: asset.id }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      // ==========================================
      // 2. ASSETS QUERIES
      // ==========================================
      // Query single asset by hardware_uuid (Tamper Detection check)
      if (lower.includes('from assets') && lower.includes('hardware_uuid =')) {
        const hwUuid = params?.[0];
        const match = storeData.assets.find(
          (a) => hwUuid && a.hardware_uuid && a.hardware_uuid.toLowerCase() === hwUuid.toLowerCase()
        );
        return {
          rows: match ? [match as any] : [],
          command: 'SELECT',
          rowCount: match ? 1 : 0,
          oid: 0,
          fields: []
        };
      }

      // Query single asset by qr_code_token or ID
      if (lower.includes('from assets') && (lower.includes('qr_code_token =') || lower.includes('where a.id =') || lower.includes('where id ='))) {
        const tokenOrId = params?.[0];
        const match = storeData.assets.find(
          (a) => (tokenOrId && (a.qr_code_token === tokenOrId || a.id === tokenOrId))
        );
        return {
          rows: match ? [match as any] : [],
          command: 'SELECT',
          rowCount: match ? 1 : 0,
          oid: 0,
          fields: []
        };
      }

      // General Assets Listing (with status/search filters)
      if (lower.includes('from assets') || lower.includes('select a.id, a.asset_tag')) {
        let items: any[] = [...storeData.assets];

        if (params && params.length > 0) {
          const statusParam = params.find((p) => ['Unregistered', 'Active', 'Repair', 'Retired', 'Lost'].includes(p));
          if (statusParam) {
            items = items.filter((a) => a.status === statusParam);
          }

          const searchParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
          if (searchParam) {
            const term = searchParam.replace(/%/g, '').toLowerCase();
            items = items.filter(
              (a) =>
                a.hostname.toLowerCase().includes(term) ||
                (a.asset_tag && a.asset_tag.toLowerCase().includes(term)) ||
                a.pc_serial_number.toLowerCase().includes(term) ||
                (a.assigned_user && a.assigned_user.toLowerCase().includes(term))
            );
          }
        }

        // Sort newest seen first
        items.sort((a, b) => {
          const tA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          const tB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          return tB - tA;
        });

        // Ensure cpu_name is populated for all items
        const sanitizedItems = items.map((a) => ({
          ...a,
          cpu_name: a.cpu_name || 'Intel(R) Core(TM) i5-14400',
          ram_total_gb: typeof a.ram_total_gb === 'number' ? Math.round(a.ram_total_gb) : 16
        }));

        return {
          rows: sanitizedItems as unknown as T[],
          command: 'SELECT',
          rowCount: sanitizedItems.length,
          oid: 0,
          fields: []
        };
      }

      // ==========================================
      // 3. ASSET MUTATIONS (BIND ASSET)
      // ==========================================
      if (lower.includes('update assets') && lower.includes('asset_tag')) {
        const assetId = params?.[5];
        const bound = embeddedStore.bindAsset(assetId, {
          assetTag: params?.[0],
          locationId: params?.[1],
          assignedUser: params?.[2],
          purchaseDate: params?.[3],
          warrantyExpiryDate: params?.[4]
        });

        return {
          rows: bound ? [{ id: bound.id, asset_tag: bound.asset_tag, status: bound.status, qr_code_token: bound.qr_code_token }] as unknown as T[] : [],
          command: 'UPDATE',
          rowCount: bound ? 1 : 0,
          oid: 0,
          fields: []
        };
      }

      // ==========================================
      // 4. LOGS & TELEMETRY INSERTS
      // ==========================================
      if (lower.includes('insert into asset_health_logs') || lower.includes('insert into asset_telemetry_logs')) {
        return {
          rows: [{ id: 'tel-' + Date.now() }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('insert into asset_change_logs')) {
        const logId = 'chg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const newLog = {
          id: logId,
          asset_id: params?.[0],
          change_type: params?.[1],
          severity: params?.[2],
          previous_value: params?.[3],
          new_value: params?.[4],
          description: params?.[5],
          detected_at: new Date().toISOString(),
          is_acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
          resolution_note: null
        };
        storeData.changeLogs.unshift(newLog);
        embeddedStore.save();

        return {
          rows: [{ id: logId }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('update asset_change_logs') && lower.includes('is_acknowledged = true')) {
        const acknowledgedBy = params?.[0] || 'IT Admin';
        const logId = params?.[1];
        embeddedStore.acknowledgeChange(logId, acknowledgedBy, 'Acknowledged via portal');

        return {
          rows: [{ id: logId }] as unknown as T[],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      // ==========================================
      // 5. AUDIT & PREVENTIVE MAINTENANCE (PM)
      // ==========================================
      if (lower.includes('from audit_campaigns')) {
        return {
          rows: storeData.auditCampaign ? [storeData.auditCampaign as any] : [],
          command: 'SELECT',
          rowCount: storeData.auditCampaign ? 1 : 0,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('from audit_records')) {
        let recs = storeData.auditRecords;
        if (params && params.length >= 2) {
          recs = recs.filter((r) => r.campaign_id === params[0] && r.asset_id === params[1]);
        }
        return {
          rows: recs as unknown as T[],
          command: 'SELECT',
          rowCount: recs.length,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('insert into audit_records')) {
        const auditId = 'aud-' + Date.now();
        const record = {
          id: auditId,
          campaign_id: params?.[0],
          asset_id: params?.[1],
          verified_by: params?.[2],
          verified_location_id: params?.[3],
          verification_method: params?.[4],
          is_hardware_matched: params?.[5] ?? true,
          status: params?.[6] || 'Verified',
          discrepancy_note: params?.[7] || null,
          verified_at: new Date().toISOString()
        };
        storeData.auditRecords.push(record);
        embeddedStore.save();

        return {
          rows: [{ id: auditId, campaign_id: record.campaign_id, asset_id: record.asset_id, verification_method: record.verification_method, status: record.status }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('update audit_records')) {
        return {
          rows: [] as unknown as T[],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('from pm_schedules')) {
        const assetId = params?.[0];
        const match = storeData.pmSchedules.filter((p) => !assetId || p.asset_id === assetId);
        return {
          rows: match as unknown as T[],
          command: 'SELECT',
          rowCount: match.length,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('insert into pm_records')) {
        const recordId = 'pmr-' + Date.now();
        const record = {
          id: recordId,
          pm_schedule_id: params?.[0],
          asset_id: params?.[1],
          performed_by: params?.[2],
          checklist_results_json: params?.[3],
          cleaning_done: params?.[4],
          cable_check_done: params?.[5],
          thermal_paste_replaced: params?.[6],
          technician_notes: params?.[7],
          signed_by_user_name: params?.[8],
          signature_data_url: params?.[9],
          created_at: new Date().toISOString()
        };
        storeData.pmRecords.push(record);
        embeddedStore.save();

        return {
          rows: [{ id: recordId, pm_schedule_id: record.pm_schedule_id, performed_by: record.performed_by, signed_by_user_name: record.signed_by_user_name, created_at: record.created_at }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      // Remote Access Security Audit Logging Insert
      if (lower.includes('insert into remote_access_logs')) {
        const logId = params?.[0] || 'rem-' + Date.now();
        const newLog = {
          id: logId,
          asset_id: params?.[1],
          hostname: params?.[2],
          target_ip: params?.[3],
          technician_user_id: params?.[4],
          technician_username: params?.[5],
          access_mode: params?.[6],
          access_reason: params?.[7],
          recording_filename: params?.[8],
          client_source_ip: params?.[9] || '127.0.0.1',
          created_at: new Date().toISOString()
        };
        embeddedStore.addRemoteAccessLog(newLog);

        return {
          rows: [{ id: logId }] as unknown as T[],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        };
      }

      // Remote Access Audit Logs Query
      if (lower.includes('from remote_access_logs') || lower.includes('vw_remote_access_audit_logs')) {
        const logs = embeddedStore.getRemoteAccessLogs();
        return {
          rows: logs as unknown as T[],
          command: 'SELECT',
          rowCount: logs.length,
          oid: 0,
          fields: []
        };
      }

      // ==========================================
      // 6. DASHBOARDS & ANALYTICAL VIEWS
      // ==========================================
      // View 1: Software Inventory Summary
      if (lower.includes('vw_software_inventory_summary')) {
        const swMap = new Map<string, {
          software_category: string;
          software_name: string;
          software_version: string;
          software_publisher: string;
          pcsMap: Map<string, any>;
        }>();

        const categorize = (name: string): string => {
          const n = (name || '').toLowerCase();
          if (n.includes('office') || n.includes('word') || n.includes('excel') || n.includes('powerpoint') || n.includes('outlook') || n.includes('access') || n.includes('visio') || n.includes('project') || n.includes('microsoft 365')) return 'Microsoft Office / 365';
          if (n.includes('adobe') || n.includes('acrobat') || n.includes('photoshop') || n.includes('illustrator') || n.includes('indesign')) return 'Adobe Creative & PDF';
          if (n.includes('google chrome') || n.includes('firefox') || n.includes('microsoft edge') || n.includes('brave') || n.includes('opera')) return 'Web Browsers';
          if (n.includes('anydesk') || n.includes('teamviewer') || n.includes('ultravnc') || n.includes('vnc') || n.includes('remote desktop') || n.includes('rustdesk') || n.includes('logmein')) return 'Remote Tools & Support';
          if (n.includes('visual studio') || n.includes('vs code') || n.includes('git') || n.includes('node.js') || n.includes('python') || n.includes('docker') || n.includes('cmake') || n.includes('sdk')) return 'Development & IT Tools';
          if (n.includes('eset') || n.includes('antivirus') || n.includes('endpoint security') || n.includes('crowdstrike') || n.includes('sentinelone') || n.includes('defender') || n.includes('kaspersky') || n.includes('trend micro')) return 'Security & Antivirus';
          if (n.includes('synology chat') || n.includes('zoom') || n.includes('teams') || n.includes('line') || n.includes('7-zip') || n.includes('winrar') || n.includes('notepad++') || n.includes('pdf24') || n.includes('foxit')) return 'Utilities & Collaboration';
          return 'General Software';
        };

        const activeAssets = storeData.assets.filter((a) => ['Active', 'Unregistered'].includes(a.status));
        for (const asset of activeAssets) {
          const swList = Array.isArray(asset.installed_software_json) ? asset.installed_software_json : [];
          for (const item of swList) {
            const name = (item.displayName || item.name || '').trim();
            if (!name) continue;
            const version = (item.displayVersion || item.version || 'Unknown').trim();
            const publisher = (item.publisher || 'Unknown').trim();
            const category = categorize(name);
            const key = `${category}:::${name}:::${version}:::${publisher}`;

            if (!swMap.has(key)) {
              swMap.set(key, {
                software_category: category,
                software_name: name,
                software_version: version,
                software_publisher: publisher,
                pcsMap: new Map()
              });
            }

            swMap.get(key)!.pcsMap.set(asset.id, {
              asset_id: asset.id,
              hostname: asset.hostname,
              asset_tag: asset.asset_tag,
              ip_address: asset.ip_address,
              assigned_user: asset.assigned_user,
              room_name: asset.room_name || 'Main Office',
              department_name: asset.department_name || 'General'
            });
          }
        }

        const rows = Array.from(swMap.values())
          .map((entry) => ({
            software_category: entry.software_category,
            software_name: entry.software_name,
            software_version: entry.software_version,
            software_publisher: entry.software_publisher,
            installed_count: entry.pcsMap.size,
            installed_pcs: Array.from(entry.pcsMap.values())
          }))
          .sort((a, b) => b.installed_count - a.installed_count || a.software_name.localeCompare(b.software_name));

        return {
          rows: rows as unknown as T[],
          command: 'SELECT',
          rowCount: rows.length,
          oid: 0,
          fields: []
        };
      }

      // View 2: OS Distribution Summary
      if (lower.includes('vw_os_distribution_summary')) {
        const activeAssets = storeData.assets.filter((a) => ['Active', 'Unregistered'].includes(a.status));
        const totalFleet = activeAssets.length;
        const osMap = new Map<string, {
          os_family: string;
          os_name: string;
          os_version: string;
          os_build: string;
          machines: any[];
        }>();

        const getFamily = (osName: string): string => {
          const n = (osName || '').toLowerCase();
          if (n.includes('windows 11')) return 'Windows 11';
          if (n.includes('windows 10')) return 'Windows 10';
          if (n.includes('server')) return 'Windows Server';
          if (n.includes('windows 7')) return 'Windows 7 (Legacy)';
          if (n.includes('windows 8')) return 'Windows 8.1 (Legacy)';
          if (n.includes('linux') || n.includes('ubuntu')) return 'Linux';
          if (n.includes('mac')) return 'macOS';
          return 'Other OS';
        };

        for (const asset of activeAssets) {
          const osName = asset.os_name || 'Windows';
          const osFamily = getFamily(osName);
          const osVersion = asset.os_version || 'Unknown';
          const osBuild = asset.os_build || 'Unknown';
          const key = `${osFamily}:::${osName}:::${osVersion}:::${osBuild}`;

          if (!osMap.has(key)) {
            osMap.set(key, {
              os_family: osFamily,
              os_name: osName,
              os_version: osVersion,
              os_build: osBuild,
              machines: []
            });
          }

          osMap.get(key)!.machines.push({
            asset_id: asset.id,
            hostname: asset.hostname,
            asset_tag: asset.asset_tag,
            ip_address: asset.ip_address,
            department_name: asset.department_name || 'General'
          });
        }

        const rows = Array.from(osMap.values())
          .map((entry) => ({
            os_family: entry.os_family,
            os_name: entry.os_name,
            os_version: entry.os_version,
            os_build: entry.os_build,
            machine_count: entry.machines.length,
            percentage: totalFleet > 0 ? Math.round((entry.machines.length * 10000 / totalFleet)) / 100 : 0,
            machines: entry.machines
          }))
          .sort((a, b) => b.machine_count - a.machine_count);

        return {
          rows: rows as unknown as T[],
          command: 'SELECT',
          rowCount: rows.length,
          oid: 0,
          fields: []
        };
      }

      // View 3: Windows Patch Advisory
      if (lower.includes('vw_windows_patch_advisory')) {
        const activeAssets = storeData.assets.filter((a) => ['Active', 'Unregistered'].includes(a.status));
        const nowMs = Date.now();

        const rows = activeAssets.map((a) => {
          const lastUpdateMs = a.last_windows_update ? new Date(a.last_windows_update).getTime() : 0;
          const daysSincePatch = lastUpdateMs > 0 ? Math.max(0, Math.floor((nowMs - lastUpdateMs) / 86400000)) : 999;

          const lastBootMs = a.last_boot_time ? new Date(a.last_boot_time).getTime() : 0;
          const daysSinceBoot = lastBootMs > 0 ? Math.max(0, Math.floor((nowMs - lastBootMs) / 86400000)) : 0;

          const osLower = (a.os_name || '').toLowerCase();
          let patch_status = 'COMPLIANT';
          let recommendation_th = 'เครื่องอยู่ในเกณฑ์มาตรฐานความปลอดภัย (Patch Compliance ปกติ)';
          let priority_order = 4;

          if (osLower.includes('windows 10') || osLower.includes('windows 7') || osLower.includes('windows 8')) {
            patch_status = 'CRITICAL_EOS';
            priority_order = 1;
            recommendation_th = osLower.includes('windows 10')
              ? 'ระบบปฏิบัติการ Windows 10 ใกล้สิ้นสุดระยะสนับสนุน (End-of-Support: ต.ค. 2025) แนะนำให้วางแผนจัดสรรงบประมาณอัปเกรดเครื่องเป็น Windows 11'
              : 'ระบบปฏิบัติการหมดระยะสนับสนุนแล้ว (End-of-Life) มีช่องโหว่ความปลอดภัยระดับร้ายแรง จำเป็นต้องอัปเกรด OS หรือเปลี่ยนอุปกรณ์ทันที';
          } else if (lastUpdateMs === 0 || daysSincePatch > 45) {
            patch_status = 'HIGH_OUTDATED';
            priority_order = 2;
            recommendation_th = lastUpdateMs === 0
              ? 'ไม่พบประวัติการติดตั้ง Windows Update แนะนำให้เปิด Windows Update เพื่อดาวน์โหลดและติดตั้ง Security Baseline ทันที'
              : 'ไม่ได้ติดตั้ง Security Update มานานเกินกว่า 45 วัน แนะนำให้รัน Windows Update ติดตั้ง Cumulative Update ล่าสุด';
          } else if (a.pending_reboot || daysSinceBoot > 30) {
            patch_status = 'WARNING_REBOOT_REQUIRED';
            priority_order = 3;
            recommendation_th = a.pending_reboot
              ? 'ติดตั้ง Security Patch สำเร็จแล้ว แต่รอรีสตาร์ทเครื่อง แนะนำให้ผู้ใช้งาน Restart PC เพื่อให้ Patch มีผลบังคับใช้'
              : 'เครื่องเปิดทำงานต่อเนื่องนานเกิน 30 วัน แนะนำให้รีสตาร์ทเครื่องเพื่อเคลียร์หน่วยความจำและบังคับใช้ Patch';
          }

          return {
            asset_id: a.id,
            hostname: a.hostname,
            asset_tag: a.asset_tag,
            ip_address: a.ip_address,
            building: a.building || 'อาคาร 1',
            room_name: a.room_name || 'Main Office',
            department_name: a.department_name || 'General',
            assigned_user: a.assigned_user,
            os_name: a.os_name,
            os_version: a.os_version || 'Unknown',
            os_build: a.os_build || 'Unknown',
            os_ubr: a.os_ubr || null,
            latest_kb_id: a.latest_kb_id || 'None',
            last_windows_update: a.last_windows_update || null,
            days_since_last_patch: daysSincePatch,
            pending_reboot: Boolean(a.pending_reboot),
            last_boot_time: a.last_boot_time || null,
            days_since_last_boot: daysSinceBoot,
            last_seen_at: a.last_seen_at,
            patch_status,
            recommendation_th,
            priority_order
          };
        }).sort((a, b) => a.priority_order - b.priority_order || b.days_since_last_patch - a.days_since_last_patch || a.hostname.localeCompare(b.hostname));

        return {
          rows: rows as unknown as T[],
          command: 'SELECT',
          rowCount: rows.length,
          oid: 0,
          fields: []
        };
      }
      if (lower.includes('vw_critical_hardware_changes')) {
        return {
          rows: storeData.changeLogs as unknown as T[],
          command: 'SELECT',
          rowCount: storeData.changeLogs.length,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('vw_pm_priority_queue')) {
        return {
          rows: storeData.pmSchedules as unknown as T[],
          command: 'SELECT',
          rowCount: storeData.pmSchedules.length,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('vw_unverified_audit_assets')) {
        const unverified = storeData.assets.map((a) => ({
          asset_id: a.id,
          asset_tag: a.asset_tag,
          hostname: a.hostname,
          pc_serial_number: a.pc_serial_number,
          registered_room: a.room_name || 'Main Office',
          department_name: a.department_name || 'General',
          assigned_user: a.assigned_user,
          last_seen_at: a.last_seen_at,
          audit_status: 'Unverified'
        }));
        return {
          rows: unverified as unknown as T[],
          command: 'SELECT',
          rowCount: unverified.length,
          oid: 0,
          fields: []
        };
      }

      if (lower.includes('from locations')) {
        return {
          rows: storeData.locations as unknown as T[],
          command: 'SELECT',
          rowCount: storeData.locations.length,
          oid: 0,
          fields: []
        };
      }

      // Fallback response for other unmapped queries
      return {
        rows: [] as unknown as T[],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }
  },

  /**
   * Executes a series of database operations within an isolated transaction.
   */
  withTransaction: async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch {
      // If PG offline, execute directly against the embedded query router
      return await callback({
        query: db.query
      } as any);
    }
  },

  /**
   * Checks database connectivity. Returns true for both PostgreSQL or EmbeddedStore.
   */
  healthCheck: async (): Promise<boolean> => {
    try {
      const res = await pool.query('SELECT 1 AS alive');
      isPgConnected = true;
      return res.rows[0]?.alive === 1;
    } catch {
      isPgConnected = false;
      return true;
    }
  },

  getMode: (): 'postgresql' | 'embedded-store' => {
    return isPgConnected ? 'postgresql' : 'embedded-store';
  }
};
