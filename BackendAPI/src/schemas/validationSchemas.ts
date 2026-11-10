import { z } from 'zod';

/**
 * Strips HTML tags, script wrappers, null bytes, and non-printable control characters.
 * Defends against Stored Cross-Site Scripting (XSS) in administrative dashboards.
 */
export const sanitizeString = (val: unknown): string => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/\0/g, '') // Null byte poisoning protection
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags and internal content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Strip style tags and internal content
    .replace(/<[^>]*>?/gm, '') // Strip remaining HTML tags
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '') // Strip control chars
    .trim();
};

/**
 * Reusable sanitized string schema with boundary constraints
 */
export const sanitizedString = (min = 0, max = 255) =>
  z.string()
    .max(max, { message: `String length exceeds maximum allowed limit of ${max} characters.` })
    .transform(sanitizeString)
    .refine((val) => val.length >= min, {
      message: `Sanitized string must contain at least ${min} valid characters.`
    });

// =============================================================================
// Group A: Agent Telemetry & Inventory Schemas
// =============================================================================

export const DiskMetricSchema = z.object({
  driveLetter: sanitizedString(1, 10),
  totalSizeGb: z.number().nonnegative().max(1000000),
  freeSpaceGb: z.number().nonnegative().max(1000000),
  freeSpacePercent: z.number().min(0).max(100)
}).strip();

export const NetworkMetricSchema = z.object({
  description: sanitizedString(1, 200),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format.').max(50),
  ipv4Address: z.string().ip({ version: 'v4' }).nullable().optional(),
  linkSpeedMbps: z.number().nonnegative().max(1000000),
  isConnected: z.boolean()
}).strip();

export const PowerStatusSchema = z.object({
  isAcLineConnected: z.boolean(),
  batteryChargePercent: z.number().int().min(0).max(100).nullable().optional(),
  batteryStatusDescription: sanitizedString(0, 100).optional(),
  cpuTemperatureCelsius: z.number().min(-50).max(200).nullable().optional()
}).strip();

export const ProcessMetricSchema = z.object({
  processId: z.number().int().nonnegative(),
  processName: sanitizedString(1, 150),
  memoryWorkingSetMb: z.number().nonnegative().max(1000000),
  totalProcessorTimeSec: z.number().nonnegative().max(1000000000)
}).strip();

export const TelemetryPayloadSchema = z.object({
  hardwareUuid: z.string().min(10).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid hardware UUID format.'),
  hostname: sanitizedString(1, 150),
  timestampUtc: z.string().datetime(),
  cpuLoadPercent: z.number().min(0).max(100),
  ramTotalGb: z.number().nonnegative().max(4096),
  ramAvailableGb: z.number().nonnegative().max(4096),
  ramUsedPercent: z.number().min(0).max(100),
  disks: z.array(DiskMetricSchema).max(30, 'Exceeded maximum volume count of 30.'),
  networkAdapters: z.array(NetworkMetricSchema).max(20, 'Exceeded maximum network adapter count of 20.'),
  powerStatus: PowerStatusSchema.optional().nullable(),
  topProcesses: z.array(ProcessMetricSchema).max(50, 'Exceeded maximum process count of 50.').optional(),
  pendingReboot: z.boolean().optional().nullable(),
  lastBootTime: z.string().optional().nullable(),
  uptimeDays: z.number().optional().nullable()
}).strip();

export const MonitorSchema = z.object({
  manufacturer: sanitizedString(0, 100),
  model: sanitizedString(0, 150),
  serialNumber: sanitizedString(0, 100)
}).strip();

export const InstalledSoftwareSchema = z.object({
  displayName: sanitizedString(1, 250),
  displayVersion: sanitizedString(0, 100),
  publisher: sanitizedString(0, 150),
  installDate: sanitizedString(0, 50)
}).strip();

export const MemoryModuleSchema = z.object({
  manufacturer: sanitizedString(0, 100),
  partNumber: sanitizedString(0, 100),
  serialNumber: sanitizedString(0, 100),
  capacityGb: z.number().nonnegative().max(512),
  speedMhz: z.number().int().nonnegative().max(20000)
}).strip();

export const PhysicalDiskSchema = z.object({
  friendlyName: sanitizedString(0, 200),
  serialNumber: sanitizedString(0, 150),
  mediaType: sanitizedString(0, 50),
  healthStatus: sanitizedString(0, 50),
  operationalStatus: sanitizedString(0, 100)
}).strip();

export const PeripheralSchema = z.object({
  type: sanitizedString(1, 50),
  name: sanitizedString(1, 150),
  description: sanitizedString(0, 250),
  pnpDeviceId: sanitizedString(0, 250),
  vendorId: sanitizedString(0, 20).nullable().optional(),
  productId: sanitizedString(0, 20).nullable().optional()
}).strip();

export const FullInventoryPayloadSchema = z.object({
  system: z.object({
    hardwareUuid: z.string().min(10).max(100).regex(/^[a-zA-Z0-9_-]+$/),
    biosSerialNumber: sanitizedString(0, 100),
    manufacturer: sanitizedString(0, 100),
    model: sanitizedString(0, 150),
    hostname: sanitizedString(1, 150),
    osName: sanitizedString(0, 150),
    osVersion: sanitizedString(0, 50),
    osBuild: sanitizedString(0, 50),
    currentLoggedInUser: sanitizedString(0, 150),
    osUbr: z.number().int().optional().nullable(),
    latestKbId: sanitizedString(0, 50).optional().nullable(),
    lastWindowsUpdate: z.string().optional().nullable(),
    lastBootTime: z.string().optional().nullable()
  }).strip(),
  cpu: z.object({
    model: sanitizedString(1, 150),
    physicalCores: z.number().int().min(1).max(256),
    logicalProcessors: z.number().int().min(1).max(512)
  }).strip(),
  memoryModules: z.array(MemoryModuleSchema).max(32, 'Exceeded maximum RAM module count (32).'),
  logicalDisks: z.array(z.object({
    driveLetter: sanitizedString(1, 10),
    fileSystem: sanitizedString(0, 50),
    totalSizeGb: z.number().nonnegative().max(1000000),
    freeSpaceGb: z.number().nonnegative().max(1000000)
  }).strip()).max(30),
  physicalDisks: z.array(PhysicalDiskSchema).max(30),
  networkAdapters: z.array(z.object({
    description: sanitizedString(1, 200),
    macAddress: z.string().max(50),
    ipv4Address: z.string().ip({ version: 'v4' }).nullable().optional(),
    defaultGateway: z.string().ip({ version: 'v4' }).nullable().optional(),
    linkSpeedMbps: z.number().nonnegative().max(1000000)
  }).strip()).max(20),
  // Anti-DoS constraint: Limit monitors to max 10
  monitors: z.array(MonitorSchema).max(10, 'Monitors collection cannot exceed 10 devices.'),
  peripherals: z.array(PeripheralSchema).max(50, 'Peripherals collection cannot exceed 50 devices.'),
  // Anti-DoS constraint: Limit software array to max 500 to prevent JSONB bombs
  installedSoftware: z.array(InstalledSoftwareSchema).max(500, 'Installed software collection cannot exceed 500 applications.'),
  securityProducts: z.array(z.object({
    antivirusProductName: sanitizedString(1, 150),
    isRealTimeProtectionEnabled: z.boolean(),
    areSignaturesUpToDate: z.boolean(),
    stateHex: sanitizedString(0, 50)
  }).strip()).max(10).optional().nullable(),
  installedPatches: z.array(z.object({
    kbId: sanitizedString(1, 50),
    description: sanitizedString(0, 200),
    installedOn: sanitizedString(0, 50)
  }).strip()).max(500).optional().nullable(),
  pendingReboot: z.boolean().optional().nullable()
}).strip();

// =============================================================================
// Group B: Asset Binding & Audit Schemas
// =============================================================================

export const BindAssetSchema = z.object({
  assetTag: sanitizedString(1, 100),
  locationId: sanitizedString(1, 100),
  assignedUser: sanitizedString(0, 150).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'purchaseDate must follow YYYY-MM-DD.').optional().nullable(),
  warrantyExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'warrantyExpiryDate must follow YYYY-MM-DD.').optional().nullable()
}).strip();

export const AuditVerifySchema = z.object({
  campaignId: sanitizedString(1, 100),
  assetId: sanitizedString(1, 100),
  verifiedLocationId: sanitizedString(1, 100),
  discrepancyNote: sanitizedString(0, 500).optional().nullable()
}).strip();

// =============================================================================
// Group C: Preventive Maintenance (PM) Schemas
// =============================================================================

export const PmSubmitSchema = z.object({
  assetId: z.string().uuid({ message: 'assetId must be a valid UUID.' }),
  scheduleId: z.string().uuid().optional().nullable(),
  pmYear: z.number().int().min(2020).max(2100),
  pmRound: z.number().int().min(1).max(12),
  physicalChecklist: z.record(z.boolean()),
  issuesFound: sanitizedString(0, 2000).optional().nullable(),
  resolutionNote: sanitizedString(0, 2000).optional().nullable(),
  overallResult: z.enum(['Pass', 'Pass_With_Minor_Issue', 'Needs_Repair']),
  userSignoffName: sanitizedString(0, 150).optional().nullable(),
  // Strict Base64 Canvas Signature Validation: must be PNG/JPEG and <= 100KB (max ~137,000 base64 chars)
  userSignoffSignature: z.string()
    .regex(/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/, 'Invalid digital signature image format.')
    .max(137000, 'Signature image payload exceeds 100KB limit.')
    .optional()
    .nullable()
}).strip();

// =============================================================================
// Group D: Remote Access & Guacamole VNC Schemas
// =============================================================================

export const RemoteSessionLaunchSchema = z.object({
  accessReason: sanitizedString(5, 500),
  accessMode: z.enum(['VIEW_ONLY', 'FULL_CONTROL'])
}).strip();

