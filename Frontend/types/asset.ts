export type AssetStatus = 'Unregistered' | 'Active' | 'Repair' | 'Retired' | 'Lost';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface MonitorItem {
  manufacturer: string;
  model: string;
  serialNumber: string;
}

export interface DiskItem {
  driveLetter?: string;
  devicePath?: string;
  model?: string;
  totalGb: number;
  freeGb?: number;
  freePercent?: number;
  smartStatus?: string;
  healthPercent?: number;
}

export interface InstalledSoftwareItem {
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
}

export interface TopProcessItem {
  pid: number;
  name: string;
  cpuPercent: number;
  ramWorkingSetMb: number;
}

export interface EdrInfo {
  installed: boolean;
  productName?: string;
  engineVersion?: string;
  realtimeProtection: boolean;
}

export interface Asset {
  id: string;
  asset_tag: string | null;
  status: AssetStatus;
  location_id: string | null;
  department_id?: string | null;
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
  monitors_json: MonitorItem[] | null;
  disks_json: DiskItem[] | null;
  installed_software_json: InstalledSoftwareItem[] | null;
  edr_info_json: EdrInfo | null;
  created_at: string;
  updated_at: string;
}

export interface AssetChangeLog {
  id: string;
  asset_id: string;
  change_type: string;
  severity: AlertSeverity;
  old_value: any;
  new_value: any;
  description: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_note: string | null;
  created_at: string;
  // Joined fields from views
  asset_tag?: string | null;
  hostname?: string;
  assigned_user?: string | null;
  location?: string | null;
}

export interface DashboardKpis {
  totalAssets: number;
  onlineNow: number;
  unregistered: number;
  criticalAlerts: number;
  urgentPm: number;
}

export interface SystemHygieneAlert {
  assetId: string;
  assetTag: string | null;
  hostname: string;
  assignedUser: string | null;
  issueType: 'LOW_DISK' | 'UNHEALTHY_SMART' | 'DEGRADED_LAN' | 'HIGH_UPTIME';
  title: string;
  detail: string;
  severity: AlertSeverity;
  metricValue: string;
}

export interface AuditCampaignSummary {
  id: string;
  name: string;
  year: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  totalAssets: number;
  agentVerified: number;
  qrScanned: number;
  pending: number;
  progressPercent: number;
}

export interface BindAssetPayload {
  assetTag: string;
  assignedUser?: string;
  locationId?: string;
  status?: AssetStatus;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
}

export interface AcknowledgeChangePayload {
  resolutionNote: string;
}

export interface LocationOption {
  id: string;
  building: string;
  floor: string;
  room_name: string;
  department_name?: string;
}


export interface QrScanResult {
  assetId: string;
  assetTag: string | null;
  status: AssetStatus;
  hostname: string;
  serialNumber: string;
  model: string;
  assignedUser: string | null;
  ipAddress: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  location: {
    locationId: string;
    building: string;
    floor: string;
    room: string;
    department?: string;
  };
  monitors: MonitorItem[];
  auditStatus: {
    activeCampaignId?: string;
    activeCampaignName?: string;
    verificationMethod: string;
    isLocationMatched?: boolean;
    verifiedAt?: string;
  };
  preventiveMaintenance: {
    lastPerformedAt?: string;
    lastResult?: string;
  };
}

export interface PmPreFillData {
  assetId: string;
  assetTag: string | null;
  hostname: string;
  autoDiagnostics: {
    cpuModel: string;
    ramTotalGb: number;
    lanLinkSpeedMbps: number;
    isGigabitLan: boolean;
    antivirusStatus: string;
    lastBootTime?: string;
    uptimeDays: number;
    uptimeWarning: boolean;
    diskDiagnostics: {
      driveLetter: string;
      totalSizeGb: number;
      freeSpaceGb: number;
      freeSpacePercent: number;
      lowSpaceWarning: boolean;
      smartHealthStatus: string;
      smartOperationalStatus: string;
      isSmartHealthy: boolean;
    };
  };
}

export interface PmSubmitPayload {
  assetId: string;
  scheduleId?: string;
  overallResult: 'PASS' | 'WARNING' | 'FAIL';
  checklist: {
    physicalDusting: boolean;
    thermalPasteChecked: boolean;
    cablesSecured: boolean;
    fansOperational: boolean;
    osUpdatesApplied: boolean;
    tempFilesCleaned: boolean;
    antivirusUpdated: boolean;
  };
  technicianNotes?: string;
  technicianSignatureBase64: string;
}

export interface AuditVerifyPayload {
  campaignId: string;
  assetId: string;
  verifiedLocationId: string;
  discrepancyNote?: string;
}
