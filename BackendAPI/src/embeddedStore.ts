import fs from 'fs';
import path from 'path';

export interface EmbeddedAsset {
  id: string;
  asset_tag: string | null;
  status: 'Unregistered' | 'Active' | 'Repair' | 'Retired' | 'Lost';
  location_id: string | null;
  building?: string;
  floor?: string;
  room_name?: string;
  department_name?: string;
  assigned_user: string | null;
  purchase_date: string | null;
  warranty_expiry_date: string | null;
  qr_code_token: string;
  hardware_uuid: string;
  hostname: string;
  pc_serial_number: string;
  manufacturer: string;
  model: string;
  os_name: string;
  os_build: string;
  last_logged_in_user: string | null;
  cpu_name: string;
  cpu_cores: number;
  ram_total_gb: number;
  ip_address: string | null;
  mac_address: string | null;
  lan_speed_mbps: number | null;
  wifi_ssid: string | null;
  wifi_signal_percent: number | null;
  agent_version: string | null;
  last_seen_at: string | null;
  os_version?: string | null;
  os_ubr?: number | null;
  latest_kb_id?: string | null;
  installed_patches_json?: any[];
  pending_reboot?: boolean;
  last_windows_update?: string | null;
  last_boot_time?: string | null;
  monitors_json: any[];
  disks_json: any[];
  installed_software_json: any[];
  edr_info_json: any;
  created_at: string;
  updated_at: string;
}

export interface EmbeddedStoreData {
  assets: EmbeddedAsset[];
  locations: any[];
  departments: any[];
  changeLogs: any[];
  auditCampaign: any;
  auditRecords: any[];
  pmSchedules: any[];
  pmRecords: any[];
}

const STORE_PATH = path.join(__dirname, '../data/embedded_db.json');

// REAL WORKSTATION DATA CAPTURED FROM AGENT INSPECTION
const initialData: EmbeddedStoreData = {
  departments: [
    { id: 'dept-01', code: 'IT', name: 'แผนกเทคโนโลยีสารสนเทศ (IT Department)' },
    { id: 'dept-02', code: 'FIN', name: 'แผนกการเงินและบัญชี (Finance & Accounting)' },
    { id: 'dept-03', code: 'OPD', name: 'แผนกผู้ป่วยนอก (OPD Clinic)' }
  ],
  locations: [
    {
      id: 'loc-b1f6-01',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 6',
      room_name: 'ห้องประชุมใหญ่ (Meeting Room B1F601)',
      department_id: 'dept-01',
      department_name: 'แผนกเทคโนโลยีสารสนเทศ (IT Department)'
    },
    {
      id: 'loc-b1f6-02',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 6',
      room_name: 'ศูนย์ควบคุมระบบ IT (NOC Room B1F602)',
      department_id: 'dept-01',
      department_name: 'แผนกเทคโนโลยีสารสนเทศ (IT Department)'
    },
    {
      id: 'loc-b1f1-01',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 1',
      room_name: 'แผนกต้อนรับส่วนหน้า (Main Lobby B1F101)',
      department_id: 'dept-03',
      department_name: 'แผนกผู้ป่วยนอก (OPD Clinic)'
    }
  ],
  assets: [
    {
      // 1. THIS ACTUAL LIVE MACHINE (B1F601)
      id: '70658300-54b5-11f0-8aa1-445eb2a83c00',
      asset_tag: 'AIK-WS-2567-001',
      status: 'Active',
      location_id: 'loc-b1f6-01',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 6',
      room_name: 'ห้องประชุมใหญ่ (Meeting Room B1F601)',
      department_name: 'แผนกเทคโนโลยีสารสนเทศ (IT Department)',
      assigned_user: 'AIKCHOL1\\meetingroom',
      purchase_date: '2024-05-15',
      warranty_expiry_date: '2027-05-15',
      qr_code_token: 'QR-B1F601-GM119Q7N',
      hardware_uuid: '70658300-54B5-11F0-8AA1-445EB2A83C00',
      hostname: 'B1F601',
      pc_serial_number: 'GM119Q7N',
      manufacturer: 'LENOVO',
      model: '12SKS3QV00 (ThinkCentre Neo 50s Gen 4)',
      os_name: 'Microsoft Windows 11 Pro',
      os_build: '26200.5040',
      os_version: '24H2',
      os_ubr: 5040,
      latest_kb_id: 'KB5044273',
      installed_patches_json: [
        { kbId: 'KB5044273', description: '2026-10 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems', installedOn: '2026-10-15' },
        { kbId: 'KB5044033', description: 'Security Update for Windows 11', installedOn: '2026-09-10' }
      ],
      pending_reboot: false,
      last_windows_update: new Date(Date.now() - 5 * 86400000).toISOString(),
      last_boot_time: new Date(Date.now() - 2 * 86400000).toISOString(),
      last_logged_in_user: 'AIKCHOL1\\meetingroom',
      cpu_name: 'Intel(R) Core(TM) i5-14400 (10 Cores, 16 Logical Processors)',
      cpu_cores: 10,
      ram_total_gb: 16,
      ip_address: '192.168.27.145',
      mac_address: '18:3D:2D:2D:3C:99',
      lan_speed_mbps: 1000,
      wifi_ssid: null,
      wifi_signal_percent: null,
      agent_version: '1.0.0.0',
      last_seen_at: new Date().toISOString(),
      monitors_json: [
        { manufacturer: 'LEN', model: 'LEN TCM-G5-BA', serialNumber: '1' }
      ],
      disks_json: [
        {
          driveLetter: 'C:',
          model: 'WD PC SN740 SDDQNQD-512G-1201',
          totalGb: 475,
          freeGb: 373,
          freePercent: 78.5,
          smartStatus: 'Healthy'
        }
      ],
      edr_info_json: {
        installed: true,
        productName: 'ESET Endpoint Antivirus / Security',
        engineVersion: '13.1.2036.0',
        realtimeProtection: true
      },
      installed_software_json: [
        { name: '7-Zip 23.01 (x64)', version: '23.01', publisher: 'Igor Pavlov' },
        { name: 'Adobe Acrobat (64-bit)', version: '26.003.22075', publisher: 'Adobe' },
        { name: 'Copilot', version: '152.0.4191.34', publisher: 'Microsoft Corporation' },
        { name: 'ESET Endpoint Antivirus', version: '13.1.2036.0', publisher: 'ESET, spol. s r.o.' },
        { name: 'ESET Management Agent', version: '13.2.1189.0', publisher: 'ESET, spol. s r.o.' },
        { name: 'Foxit Reader', version: '7.3.0.118', publisher: 'Foxit Software Inc.' },
        { name: 'Google Chrome', version: '156.0.8078.80', publisher: 'Google LLC' },
        { name: 'Intel(R) Integrated Sensor Solution', version: '3.10.100.4594', publisher: 'Intel Corporation' },
        { name: 'Lenovo Smart Meeting', version: '4.2.0.0908', publisher: 'Lenovo' },
        { name: 'Lenovo Speech', version: '2.1.0.90', publisher: 'Lenovo' },
        { name: 'Lenovo Vantage Service', version: '5.1.2606.17', publisher: 'Lenovo Group Ltd.' },
        { name: 'Microsoft Edge', version: '151.0.4129.93', publisher: 'Microsoft Corporation' },
        { name: 'Microsoft Office Professional Plus 2013', version: '15.0.4420.1017', publisher: 'Microsoft Corporation' },
        { name: 'Microsoft Power Query for Excel (x64)', version: '2.62.5222.701', publisher: 'Microsoft Corporation' },
        { name: 'Mozilla Firefox (x64 en-US)', version: '151.0.1', publisher: 'Mozilla' },
        { name: 'Notepad++ (64-bit x64)', version: '8.7.3', publisher: 'Notepad++ Team' },
        { name: 'PDF24 Creator 11.13.1', version: '11.13.1', publisher: 'PDF24.org' },
        { name: 'Realtek Audio Driver', version: '6.0.9573.1', publisher: 'Realtek Semiconductor Corp.' },
        { name: 'Synology Chat', version: '1.2.3-232', publisher: 'Synology' },
        { name: 'UltraVNC 1.0.8.2', version: '1.0.8.2', publisher: 'UltraVNC' }
      ],
      created_at: '2024-05-15T08:00:00Z',
      updated_at: new Date().toISOString()
    },
    {
      // 2. SUPPORTING ENDPOINT: IT ADMIN WORKSTATION
      id: '70658300-54b5-11f0-8aa1-445eb2a83c02',
      asset_tag: 'AIK-WS-2567-002',
      status: 'Active',
      location_id: 'loc-b1f6-02',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 6',
      room_name: 'ศูนย์ควบคุมระบบ IT (NOC Room B1F602)',
      department_name: 'แผนกเทคโนโลยีสารสนเทศ (IT Department)',
      assigned_user: 'AIKCHOL1\\it-admin',
      purchase_date: '2024-05-15',
      warranty_expiry_date: '2027-05-15',
      qr_code_token: 'QR-B1F602-GM119Q8A',
      hardware_uuid: '70658300-54B5-11F0-8AA1-445EB2A83C02',
      hostname: 'B1F602-ITNOC',
      pc_serial_number: 'GM119Q8A',
      manufacturer: 'LENOVO',
      model: '12SKS3QV00 (ThinkCentre Neo 50s Gen 4)',
      os_name: 'Microsoft Windows 11 Pro',
      os_build: '22631.3007',
      os_version: '23H2',
      os_ubr: 3007,
      latest_kb_id: 'KB5034441',
      installed_patches_json: [
        { kbId: 'KB5034441', description: 'Windows Recovery Environment update for Windows 11', installedOn: '2026-08-15' }
      ],
      pending_reboot: false,
      last_windows_update: new Date(Date.now() - 65 * 86400000).toISOString(),
      last_boot_time: new Date(Date.now() - 8 * 86400000).toISOString(),
      last_logged_in_user: 'AIKCHOL1\\it-admin',
      cpu_name: 'Intel(R) Core(TM) i5-14400',
      cpu_cores: 10,
      ram_total_gb: 16,
      ip_address: '192.168.27.146',
      mac_address: '18:3D:2D:2D:3C:9A',
      lan_speed_mbps: 1000,
      wifi_ssid: null,
      wifi_signal_percent: null,
      agent_version: '1.0.0.0',
      last_seen_at: new Date(Date.now() - 5 * 60000).toISOString(),
      monitors_json: [
        { manufacturer: 'DELL', model: 'P2422H', serialNumber: 'CN-0N9F7D-74261' }
      ],
      disks_json: [
        { driveLetter: 'C:', model: 'WD PC SN740 512GB', totalGb: 475, freeGb: 290, freePercent: 61, smartStatus: 'Healthy' }
      ],
      edr_info_json: {
        installed: true,
        productName: 'ESET Endpoint Antivirus',
        realtimeProtection: true
      },
      installed_software_json: [
        { name: 'Google Chrome', version: '156.0.8078.80', publisher: 'Google LLC' },
        { name: 'Notepad++', version: '8.7.3', publisher: 'Notepad++ Team' }
      ],
      created_at: '2024-05-15T08:00:00Z',
      updated_at: new Date().toISOString()
    },
    {
      // 3. UNREGISTERED MACHINE WAITING FOR ASSET TAG
      id: '70658300-54b5-11f0-8aa1-445eb2a83c99',
      asset_tag: null,
      status: 'Unregistered',
      location_id: 'loc-b1f1-01',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 1',
      room_name: 'แผนกต้อนรับส่วนหน้า (Main Lobby B1F101)',
      department_name: 'แผนกผู้ป่วยนอก (OPD Clinic)',
      assigned_user: 'AIKCHOL1\\reception',
      purchase_date: null,
      warranty_expiry_date: null,
      qr_code_token: 'QR-B1F101-NEW',
      hardware_uuid: 'A1B2C3D4-E5F6-7890-ABCD-EF0123456789',
      hostname: 'B1F101-RECEPT',
      pc_serial_number: 'MJ0911XA',
      manufacturer: 'HP',
      model: 'HP ProDesk 400 G7 SFF',
      os_name: 'Microsoft Windows 10 Pro',
      os_build: '19045.4894',
      os_version: '22H2',
      os_ubr: 4894,
      latest_kb_id: 'KB5043064',
      installed_patches_json: [
        { kbId: 'KB5043064', description: 'Cumulative Update for Windows 10 Version 22H2', installedOn: '2026-09-20' }
      ],
      pending_reboot: false,
      last_windows_update: new Date(Date.now() - 20 * 86400000).toISOString(),
      last_boot_time: new Date(Date.now() - 4 * 86400000).toISOString(),
      last_logged_in_user: 'AIKCHOL1\\reception',
      cpu_name: '12th Gen Intel(R) Core(TM) i5-12500',
      cpu_cores: 6,
      ram_total_gb: 16,
      ip_address: '192.168.27.188',
      mac_address: '70:85:C2:55:12:34',
      lan_speed_mbps: 1000,
      wifi_ssid: null,
      wifi_signal_percent: null,
      agent_version: '1.0.0.0',
      last_seen_at: new Date(Date.now() - 12 * 60000).toISOString(),
      monitors_json: [
        { manufacturer: 'HP', model: 'HP E24 G4', serialNumber: 'CN41290XYZ' }
      ],
      disks_json: [
        { driveLetter: 'C:', model: 'KIOXIA NVMe 256GB', totalGb: 256, freeGb: 198, freePercent: 77, smartStatus: 'Healthy' }
      ],
      edr_info_json: { installed: true, productName: 'ESET Endpoint Antivirus', realtimeProtection: true },
      installed_software_json: [
        { name: 'Google Chrome', version: '122.0.6261.129', publisher: 'Google LLC' }
      ],
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      // 4. FINANCE WORKSTATION (TEST CASE FOR REBOOT REQUIRED & SOFTWARE LICENSE DEDUPLICATION)
      id: '70658300-54b5-11f0-8aa1-445eb2a83c77',
      asset_tag: 'AIK-WS-2567-003',
      status: 'Active',
      location_id: 'loc-b1f6-01',
      building: 'อาคาร 1 (โรงพยาบาลเอกชล)',
      floor: 'ชั้น 6',
      room_name: 'ห้องฝ่ายการเงิน (Finance Office B1F603)',
      department_name: 'แผนกการเงินและบัญชี (Finance & Accounting)',
      assigned_user: 'AIKCHOL1\\fin-officer',
      purchase_date: '2024-06-01',
      warranty_expiry_date: '2027-06-01',
      qr_code_token: 'QR-B1F603-FIN01',
      hardware_uuid: '70658300-54B5-11F0-8AA1-445EB2A83C77',
      hostname: 'B1F603-FIN01',
      pc_serial_number: 'MJ0988KL',
      manufacturer: 'HP',
      model: 'HP ProDesk 400 G7 SFF',
      os_name: 'Microsoft Windows 11 Enterprise',
      os_build: '22631.4317',
      os_version: '23H2',
      os_ubr: 4317,
      latest_kb_id: 'KB5044284',
      installed_patches_json: [
        { kbId: 'KB5044284', description: '2026-10 Cumulative Update for Windows 11 Version 23H2', installedOn: '2026-10-28' }
      ],
      pending_reboot: true,
      last_windows_update: new Date(Date.now() - 2 * 86400000).toISOString(),
      last_boot_time: new Date(Date.now() - 35 * 86400000).toISOString(),
      last_logged_in_user: 'AIKCHOL1\\fin-officer',
      cpu_name: '12th Gen Intel(R) Core(TM) i5-12500',
      cpu_cores: 6,
      ram_total_gb: 16,
      ip_address: '192.168.27.150',
      mac_address: '70:85:C2:55:77:88',
      lan_speed_mbps: 1000,
      wifi_ssid: null,
      wifi_signal_percent: null,
      agent_version: '1.0.0.0',
      last_seen_at: new Date(Date.now() - 3 * 60000).toISOString(),
      monitors_json: [
        { manufacturer: 'HP', model: 'HP E24 G4', serialNumber: 'CN41290FIN' }
      ],
      disks_json: [
        { driveLetter: 'C:', model: 'KIOXIA NVMe 256GB', totalGb: 256, freeGb: 165, freePercent: 64, smartStatus: 'Healthy' }
      ],
      edr_info_json: { installed: true, productName: 'ESET Endpoint Antivirus', realtimeProtection: true },
      installed_software_json: [
        { name: 'Microsoft Office Professional Plus 2021', version: '16.0.14332.20721', publisher: 'Microsoft Corporation' },
        { name: 'Microsoft Word 2021', version: '16.0.14332.20721', publisher: 'Microsoft Corporation' },
        { name: 'Microsoft Excel 2021', version: '16.0.14332.20721', publisher: 'Microsoft Corporation' },
        { name: 'Microsoft Visio Professional 2021', version: '16.0.14332.20721', publisher: 'Microsoft Corporation' },
        { name: 'Adobe Acrobat Pro (64-bit)', version: '24.002.20895', publisher: 'Adobe' },
        { name: 'Google Chrome', version: '156.0.8078.80', publisher: 'Google LLC' },
        { name: 'ESET Endpoint Antivirus', version: '13.1.2036.0', publisher: 'ESET, spol. s r.o.' },
        { name: '7-Zip 23.01 (x64)', version: '23.01', publisher: 'Igor Pavlov' }
      ],
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  changeLogs: [
    {
      id: 'log-aik-001',
      asset_id: '70658300-54b5-11f0-8aa1-445eb2a83c00',
      change_type: 'MONITOR_SWAPPED',
      severity: 'WARNING',
      old_value: { model: 'Lenovo ThinkVision 27', serialNumber: 'V309ABCD-99' },
      new_value: { model: 'LEN TCM-G5-BA', serialNumber: '1' },
      description: 'WARNING: Connected display Serial Number changed to 1 (LEN TCM-G5-BA). Please verify display cable connection in meeting room B1F601.',
      is_acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
      resolution_note: null,
      created_at: new Date(Date.now() - 40 * 60000).toISOString(),
      asset_tag: 'AIK-WS-2567-001',
      hostname: 'B1F601',
      assigned_user: 'AIKCHOL1\\meetingroom',
      location: 'อาคาร 1 ชั้น 6 (ห้องประชุมใหญ่ B1F601)'
    }
  ],
  auditCampaign: {
    id: 'camp-aik-2569',
    name: 'การตรวจนับทรัพย์สินไอทีประจำปี 2569 (Annual Stocktake Audit FY2569)',
    year: 2569,
    status: 'IN_PROGRESS',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    totalAssets: 3,
    agentVerified: 2,
    qrScanned: 1,
    pending: 0,
    progressPercent: 100
  },
  auditRecords: [
    {
      id: 'rec-01',
      campaign_id: 'camp-aik-2569',
      asset_id: '70658300-54b5-11f0-8aa1-445eb2a83c00',
      verification_method: 'AGENT_AUTO',
      verified_location_id: 'loc-b1f6-01',
      is_location_matched: true,
      verified_by: 'System-Auto-Heartbeat',
      verified_at: new Date().toISOString()
    }
  ],
  pmSchedules: [
    {
      id: 'pm-b1f601',
      hostname: 'B1F601',
      assetTag: 'AIK-WS-2567-001',
      assignedUser: 'AIKCHOL1\\meetingroom',
      location: 'อาคาร 1 ชั้น 6 (ห้องประชุม B1F601)',
      frequencyMonths: 6,
      nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      daysRemaining: 7,
      isOverdue: false
    },
    {
      id: 'pm-b1f602',
      hostname: 'B1F602-ITNOC',
      assetTag: 'AIK-WS-2567-002',
      assignedUser: 'AIKCHOL1\\it-admin',
      location: 'อาคาร 1 ชั้น 6 (ศูนย์ควบคุมระบบ IT)',
      frequencyMonths: 6,
      nextDueDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      daysRemaining: -3,
      isOverdue: true
    }
  ],
  pmRecords: []
};

class EmbeddedStore {
  private data: EmbeddedStoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): EmbeddedStoreData {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const content = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed: EmbeddedStoreData = JSON.parse(content);
        
        // Ensure new demo workstations or missing patch fields are backfilled
        initialData.assets.forEach((initAsset) => {
          const found = parsed.assets.find((a) => a.id === initAsset.id || a.hostname === initAsset.hostname);
          if (!found) {
            parsed.assets.push(initAsset);
          } else {
            if (initAsset.hostname === 'B1F101-RECEPT') {
              found.os_name = initAsset.os_name;
              found.os_version = initAsset.os_version;
              found.os_build = initAsset.os_build;
            }
            if (!found.os_version && initAsset.os_version) found.os_version = initAsset.os_version;
            if (!found.os_ubr && initAsset.os_ubr) found.os_ubr = initAsset.os_ubr;
            if (!found.latest_kb_id && initAsset.latest_kb_id) found.latest_kb_id = initAsset.latest_kb_id;
            if (!found.installed_patches_json && initAsset.installed_patches_json) found.installed_patches_json = initAsset.installed_patches_json;
            if (found.pending_reboot === undefined) found.pending_reboot = initAsset.pending_reboot ?? false;
            if (!found.last_windows_update && initAsset.last_windows_update) found.last_windows_update = initAsset.last_windows_update;
            if (!found.last_boot_time && initAsset.last_boot_time) found.last_boot_time = initAsset.last_boot_time;
          }
        });

        // Ensure generic assets have reasonable defaults
        parsed.assets.forEach((a) => {
          if (!a.os_version) a.os_version = a.os_build?.startsWith('26') ? '24H2' : a.os_build?.startsWith('2263') ? '23H2' : '22H2';
          if (!a.installed_patches_json) a.installed_patches_json = [];
          if (a.pending_reboot === undefined) a.pending_reboot = false;
          if (!a.last_windows_update) a.last_windows_update = new Date(Date.now() - 10 * 86400000).toISOString();
          if (!a.last_boot_time) a.last_boot_time = new Date(Date.now() - 2 * 86400000).toISOString();
        });

        this.save(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('[EmbeddedStore] Failed reading existing store, initializing defaults:', e);
    }
    this.save(initialData);
    return initialData;
  }

  public save(dataToSave?: EmbeddedStoreData) {
    try {
      const data = dataToSave || this.data;
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[EmbeddedStore] Failed saving store to disk:', e);
    }
  }

  public getData(): EmbeddedStoreData {
    return this.data;
  }

  // Upsert Asset from Live Windows Agent
  public upsertAsset(incoming: any): EmbeddedAsset {
    const existingIndex = this.data.assets.findIndex(
      (a) => a.hardware_uuid === incoming.hardwareUuid || a.hostname === incoming.hostname
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = this.data.assets[existingIndex];
      const updated: EmbeddedAsset = {
        ...existing,
        hostname: incoming.hostname || existing.hostname,
        pc_serial_number: incoming.serialNumber || existing.pc_serial_number,
        manufacturer: incoming.manufacturer || existing.manufacturer,
        model: incoming.model || existing.model,
        os_name: incoming.osName || existing.os_name,
        os_build: incoming.osBuild || existing.os_build,
        os_version: incoming.osVersion || (incoming.osBuild?.startsWith('26') ? '24H2' : incoming.osBuild?.startsWith('2263') ? '23H2' : incoming.osBuild?.startsWith('2262') ? '22H2' : incoming.osBuild?.startsWith('1904') ? '22H2' : (existing.os_version || '23H2')),
        os_ubr: incoming.osUbr || (incoming.osBuild && incoming.osBuild.includes('.') ? parseInt(incoming.osBuild.split('.')[1], 10) : (existing.os_ubr || null)),
        latest_kb_id: incoming.latestKbId || existing.latest_kb_id || null,
        installed_patches_json: incoming.installedPatches || existing.installed_patches_json || [],
        pending_reboot: incoming.pendingReboot ?? existing.pending_reboot ?? false,
        last_windows_update: incoming.lastWindowsUpdate || existing.last_windows_update || null,
        last_boot_time: incoming.lastBootTime || existing.last_boot_time || null,
        last_logged_in_user: incoming.lastLoggedInUser || existing.last_logged_in_user,
        cpu_name: incoming.cpu?.name || existing.cpu_name,
        cpu_cores: incoming.cpu?.cores || existing.cpu_cores,
        ram_total_gb: incoming.ramTotalGb || existing.ram_total_gb,
        ip_address: incoming.ipAddress || existing.ip_address,
        mac_address: incoming.macAddress || existing.mac_address,
        lan_speed_mbps: incoming.lanSpeedMbps ?? existing.lan_speed_mbps,
        monitors_json: incoming.monitors || existing.monitors_json,
        disks_json: incoming.disks || existing.disks_json,
        installed_software_json: incoming.installedSoftware || existing.installed_software_json,
        edr_info_json: incoming.edrInfo || existing.edr_info_json,
        last_seen_at: now,
        updated_at: now
      };
      this.data.assets[existingIndex] = updated;
      this.save();
      return updated;
    } else {
      const newAsset: EmbeddedAsset = {
        id: incoming.hardwareUuid || 'ast-' + Date.now(),
        asset_tag: null,
        status: 'Unregistered',
        location_id: null,
        assigned_user: incoming.lastLoggedInUser || null,
        purchase_date: null,
        warranty_expiry_date: null,
        qr_code_token: `QR-${incoming.hostname}-${Date.now().toString(36)}`,
        hardware_uuid: incoming.hardwareUuid,
        hostname: incoming.hostname,
        pc_serial_number: incoming.serialNumber || 'UNKNOWN_SN',
        manufacturer: incoming.manufacturer || 'OEM',
        model: incoming.model || 'Standard PC',
        os_name: incoming.osName || 'Windows',
        os_build: incoming.osBuild || '',
        os_version: incoming.osVersion || (incoming.osBuild?.startsWith('26') ? '24H2' : incoming.osBuild?.startsWith('2263') ? '23H2' : incoming.osBuild?.startsWith('2262') ? '22H2' : incoming.osBuild?.startsWith('1904') ? '22H2' : '23H2'),
        os_ubr: incoming.osUbr || (incoming.osBuild && incoming.osBuild.includes('.') ? parseInt(incoming.osBuild.split('.')[1], 10) : null),
        latest_kb_id: incoming.latestKbId || null,
        installed_patches_json: incoming.installedPatches || [],
        pending_reboot: incoming.pendingReboot || false,
        last_windows_update: incoming.lastWindowsUpdate || new Date().toISOString(),
        last_boot_time: incoming.lastBootTime || new Date(Date.now() - 86400000).toISOString(),
        last_logged_in_user: incoming.lastLoggedInUser || null,
        cpu_name: incoming.cpu?.name || 'x64 CPU',
        cpu_cores: incoming.cpu?.cores || 4,
        ram_total_gb: incoming.ramTotalGb || 16,
        ip_address: incoming.ipAddress || null,
        mac_address: incoming.macAddress || null,
        lan_speed_mbps: incoming.lanSpeedMbps || 1000,
        wifi_ssid: null,
        wifi_signal_percent: null,
        agent_version: '1.0.0.0',
        last_seen_at: now,
        monitors_json: incoming.monitors || [],
        disks_json: incoming.disks || [],
        installed_software_json: incoming.installedSoftware || [],
        edr_info_json: incoming.edrInfo || null,
        created_at: now,
        updated_at: now
      };
      this.data.assets.push(newAsset);
      this.save();
      return newAsset;
    }
  }

  // Update telemetry metrics (CPU, RAM, Uptime)
  public updateTelemetry(payload: any) {
    const asset = this.data.assets.find(
      (a) => a.hardware_uuid === payload.hardwareUuid || a.hostname === payload.hostname
    );
    if (asset) {
      asset.last_seen_at = new Date().toISOString();
      if (payload.networkAdapters?.[0]?.ipv4Address) {
        asset.ip_address = payload.networkAdapters[0].ipv4Address;
      }
      this.save();
    }
  }

  // Bind Asset Tag
  public bindAsset(id: string, payload: any): EmbeddedAsset | null {
    const asset = this.data.assets.find(
      (a) =>
        a.id.toLowerCase() === id.toLowerCase() ||
        (a.hardware_uuid && a.hardware_uuid.toLowerCase() === id.toLowerCase()) ||
        a.hostname.toLowerCase() === id.toLowerCase()
    );
    if (!asset) return null;

    asset.asset_tag = payload.assetTag;
    asset.location_id = payload.locationId;
    if (payload.assignedUser) asset.assigned_user = payload.assignedUser;
    if (payload.purchaseDate) asset.purchase_date = payload.purchaseDate;
    if (payload.warrantyExpiryDate) asset.warranty_expiry_date = payload.warrantyExpiryDate;
    asset.status = 'Active';

    const loc = this.data.locations.find((l) => l.id === payload.locationId);
    if (loc) {
      asset.building = loc.building;
      asset.floor = loc.floor;
      asset.room_name = loc.room_name;
      asset.department_name = loc.department_name;
    }

    this.save();
    return asset;
  }

  // Acknowledge Change Log
  public acknowledgeChange(id: string, user: string, note: string): boolean {
    const log = this.data.changeLogs.find((l) => l.id === id);
    if (!log) return false;
    log.is_acknowledged = true;
    log.acknowledged_by = user;
    log.acknowledged_at = new Date().toISOString();
    log.resolution_note = note;
    this.save();
    return true;
  }
}

export const embeddedStore = new EmbeddedStore();

