import { PoolClient } from 'pg';

export interface MonitorItem {
  manufacturer: string;
  model: string;
  serialNumber: string;
}

export interface ExistingAssetRecord {
  id: string;
  pc_serial_number: string | null;
  ram_total_gb: number | null;
  monitors_json: MonitorItem[] | null;
  disks_json: any[] | null;
  installed_software_json: any[] | null;
}

export interface IncomingInventoryPayload {
  system: {
    hardwareUuid: string;
    biosSerialNumber: string;
    manufacturer: string;
    model: string;
    hostname: string;
  };
  memoryModules: Array<{
    capacityGb: number;
    manufacturer: string;
    serialNumber: string;
  }>;
  monitors: MonitorItem[];
  physicalDisks: Array<{
    friendlyName: string;
    serialNumber: string;
    healthStatus: string;
  }>;
}

export interface TamperDetectionResult {
  hasCriticalChanges: boolean;
  changesCount: number;
}

export class TamperDetectionService {
  /**
   * Compares incoming agent hardware inventory against the last persisted DB state.
   * Automatically detects and writes tamper events to 'asset_change_logs'.
   */
  public static async detectAndLogChanges(
    client: PoolClient,
    existing: ExistingAssetRecord,
    incoming: IncomingInventoryPayload
  ): Promise<TamperDetectionResult> {
    const assetId = existing.id;
    let hasCriticalChanges = false;
    let changesCount = 0;

    const logChange = async (
      changeType: 'RAM_CHANGED' | 'MONITOR_SWAPPED' | 'DISK_CHANGED' | 'SERIAL_MISMATCH' | 'IP_CHANGED' | 'SOFTWARE_CHANGED',
      severity: 'INFO' | 'WARNING' | 'CRITICAL',
      oldValue: Record<string, any>,
      newValue: Record<string, any>
    ) => {
      changesCount++;
      if (severity === 'CRITICAL') {
        hasCriticalChanges = true;
      }

      const sql = `
        INSERT INTO asset_change_logs (
          asset_id, change_type, severity, old_value, new_value, is_acknowledged, detected_at
        )
        VALUES (
          $1, $2, $3, $4::jsonb, $5::jsonb, FALSE, clock_timestamp()
        );
      `;

      await client.query(sql, [
        assetId,
        changeType,
        severity,
        JSON.stringify(oldValue),
        JSON.stringify(newValue)
      ]);
    };

    // 1. RAM Reduction Detection (Physical Module Removed or Faulty)
    const currentTotalRam = incoming.memoryModules.reduce((acc, m) => acc + (m.capacityGb || 0), 0);
    const previousRam = existing.ram_total_gb ? Number(existing.ram_total_gb) : null;

    if (previousRam !== null && currentTotalRam < previousRam) {
      await logChange(
        'RAM_CHANGED',
        'CRITICAL',
        { ramTotalGb: previousRam, note: 'Previous physical RAM capacity' },
        { ramTotalGb: currentTotalRam, note: 'RAM reduced (Potential theft or stick failure)' }
      );
    }

    // 2. Motherboard / BIOS Serial Number Mismatch
    const incomingSerial = incoming.system.biosSerialNumber?.trim();
    const previousSerial = existing.pc_serial_number?.trim();

    if (previousSerial && incomingSerial && previousSerial !== incomingSerial) {
      await logChange(
        'SERIAL_MISMATCH',
        'CRITICAL',
        { biosSerialNumber: previousSerial },
        { biosSerialNumber: incomingSerial, note: 'Motherboard replaced or UUID spoofing detected' }
      );
    }

    // 3. Monitor Serial Number Swap or Disappearance Detection
    const previousMonitors = Array.isArray(existing.monitors_json) ? existing.monitors_json : [];
    const incomingMonitors = Array.isArray(incoming.monitors) ? incoming.monitors : [];

    // Filter out monitors without valid serial numbers
    const prevSerials = new Set(
      previousMonitors
        .map((m) => m.serialNumber?.trim())
        .filter((s): s is string => Boolean(s && s !== 'None' && s !== '0' && s !== '1'))
    );

    const incomingSerials = new Set(
      incomingMonitors
        .map((m) => m.serialNumber?.trim())
        .filter((s): s is string => Boolean(s && s !== 'None' && s !== '0' && s !== '1'))
    );

    // Check if any previously registered monitor serial is missing from incoming report
    const missingMonitors = [...prevSerials].filter((s) => !incomingSerials.has(s));
    const addedMonitors = [...incomingSerials].filter((s) => !prevSerials.has(s));

    if (missingMonitors.length > 0 || addedMonitors.length > 0) {
      await logChange(
        'MONITOR_SWAPPED',
        'WARNING',
        {
          previousMonitors,
          missingSerials: missingMonitors
        },
        {
          currentMonitors: incomingMonitors,
          newSerials: addedMonitors,
          note: 'Display peripheral hardware configuration changed'
        }
      );
    }

    return { hasCriticalChanges, changesCount };
  }
}

