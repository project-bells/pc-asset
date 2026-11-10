-- =============================================================================
-- Enterprise IT Asset Management, Annual Stocktake & Preventive Maintenance (PM)
-- Database Engine: PostgreSQL 16+
-- Script: init_schema.sql
-- =============================================================================

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUM TYPES & DOMAIN DECLARATIONS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE asset_status_enum AS ENUM (
        'Unregistered',
        'Active',
        'Repair',
        'Retired',
        'Lost'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE change_type_enum AS ENUM (
        'RAM_CHANGED',
        'MONITOR_SWAPPED',
        'DISK_CHANGED',
        'SERIAL_MISMATCH',
        'IP_CHANGED',
        'SOFTWARE_CHANGED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE change_severity_enum AS ENUM (
        'INFO',
        'WARNING',
        'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE audit_campaign_status_enum AS ENUM (
        'Draft',
        'In_Progress',
        'Completed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE audit_verification_method_enum AS ENUM (
        'Pending',
        'Agent_Auto_Verified',
        'QR_Physical_Scan'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE pm_result_enum AS ENUM (
        'Pass',
        'Pass_With_Minor_Issue',
        'Needs_Repair'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================================================
-- 2. TRIGGER HELPER FOR AUTO-UPDATING 'updated_at'
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. CORE TABLES: ORGANIZATION HIERARCHY
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building VARCHAR(100) NOT NULL,
    floor VARCHAR(50) NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_locations_dept ON locations(department_id);
CREATE INDEX IF NOT EXISTS idx_locations_building_floor ON locations(building, floor);

CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- 4. MASTER ASSET INVENTORY & LATEST AGENT STATE
-- =============================================================================

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Administrative & Accounting Metadata
    asset_tag VARCHAR(100) UNIQUE, -- May be NULL until physical barcode/QR is assigned
    status asset_status_enum NOT NULL DEFAULT 'Unregistered',
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    assigned_user VARCHAR(150),
    purchase_date DATE,
    warranty_expiry_date DATE,
    qr_code_token VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

    -- Agent Machine Identity
    hardware_uuid VARCHAR(100) UNIQUE NOT NULL,
    hostname VARCHAR(150) NOT NULL,
    pc_serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    model VARCHAR(150),
    os_name VARCHAR(150),
    os_build VARCHAR(50),
    last_logged_in_user VARCHAR(150),

    -- Latest Hardware & Network Summary
    cpu_model VARCHAR(150),
    ram_total_gb NUMERIC(6, 2),
    ip_address INET,
    mac_address MACADDR,
    link_speed_mbps NUMERIC(10, 2),

    -- System Hygiene (Preventive Maintenance Metrics)
    last_boot_time TIMESTAMPTZ,
    antivirus_status VARCHAR(100),
    last_windows_update DATE,

    -- Flexible JSONB Collections (GIN Indexed)
    disks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    monitors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    peripherals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    installed_software_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    inventory_hash VARCHAR(64), -- SHA-256 checksum to detect configuration drift

    -- Timestamps
    last_seen_at TIMESTAMPTZ,
    last_inventory_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- B-Tree Indexes on High-Frequency Lookups
CREATE INDEX IF NOT EXISTS idx_assets_hardware_uuid ON assets(hardware_uuid);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_pc_serial ON assets(pc_serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname);
CREATE INDEX IF NOT EXISTS idx_assets_last_seen ON assets(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_ip_mac ON assets(ip_address, mac_address);

-- GIN Indexes for High-Performance JSONB Array Search
CREATE INDEX IF NOT EXISTS idx_assets_disks_gin ON assets USING gin(disks_json);
CREATE INDEX IF NOT EXISTS idx_assets_monitors_gin ON assets USING gin(monitors_json);
CREATE INDEX IF NOT EXISTS idx_assets_peripherals_gin ON assets USING gin(peripherals_json);
CREATE INDEX IF NOT EXISTS idx_assets_software_gin ON assets USING gin(installed_software_json);

CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- 5. TIME-SERIES TELEMETRY & HEALTH LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_health_logs (
    id BIGSERIAL PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    cpu_load_percent NUMERIC(5, 2) NOT NULL,
    ram_available_gb NUMERIC(6, 2) NOT NULL,
    disks_free_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    link_speed_mbps NUMERIC(10, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Fast time-slice composite index for endpoint telemetry graphs
CREATE INDEX IF NOT EXISTS idx_health_logs_asset_time ON asset_health_logs(asset_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_disks_free_gin ON asset_health_logs USING gin(disks_free_json);

-- =============================================================================
-- 6. HARDWARE & SOFTWARE AUDIT TRAIL (TAMPER DETECTION)
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_change_logs (
    id BIGSERIAL PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    change_type change_type_enum NOT NULL,
    severity change_severity_enum NOT NULL DEFAULT 'INFO',
    old_value JSONB,
    new_value JSONB,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR(150),
    acknowledged_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_change_logs_asset_time ON asset_change_logs(asset_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_logs_ack_severity ON asset_change_logs(is_acknowledged, severity) WHERE is_acknowledged = FALSE;

-- =============================================================================
-- 7. ANNUAL ASSET STOCKTAKE (AUDIT CAMPAIGNS & VERIFICATION)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL, -- e.g. "Annual IT Audit 2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status audit_campaign_status_enum NOT NULL DEFAULT 'Draft',
    created_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_audit_campaigns_updated_at
BEFORE UPDATE ON audit_campaigns
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS audit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES audit_campaigns(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    verification_method audit_verification_method_enum NOT NULL DEFAULT 'Pending',
    verified_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    is_location_matched BOOLEAN NOT NULL DEFAULT FALSE,
    is_hardware_matched BOOLEAN NOT NULL DEFAULT TRUE,
    discrepancy_note TEXT,
    verified_by VARCHAR(150),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT uq_campaign_asset UNIQUE (campaign_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_records_campaign ON audit_records(campaign_id, verification_method);
CREATE INDEX IF NOT EXISTS idx_audit_records_asset ON audit_records(asset_id);

-- =============================================================================
-- 8. PREVENTIVE MAINTENANCE (PM) SCHEDULES & SERVICE RECORDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS pm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    round INT NOT NULL, -- e.g. Round 1, Round 2
    title VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pm_schedules_year_round ON pm_schedules(year, round);

CREATE TABLE IF NOT EXISTS pm_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES pm_schedules(id) ON DELETE SET NULL,
    pm_year INT NOT NULL,
    pm_round INT NOT NULL,
    performed_by VARCHAR(150) NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    -- Automated Machine State at the Exact Moment of Maintenance
    agent_health_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Physical Maintenance Checklist
    physical_checklist_json JSONB NOT NULL DEFAULT '{
        "clean_case_fan": false,
        "clean_monitor": false,
        "check_lan_cable": false,
        "test_ups_battery": false,
        "organize_cables": false
    }'::jsonb,

    issues_found TEXT,
    resolution_note TEXT,
    overall_result pm_result_enum NOT NULL DEFAULT 'Pass',

    -- Digital Sign-Off
    user_signoff_name VARCHAR(150),
    user_signoff_signature TEXT, -- Base64 encoded signature image or hash

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pm_records_asset ON pm_records(asset_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_records_year_round ON pm_records(pm_year, pm_round);
CREATE INDEX IF NOT EXISTS idx_pm_records_checklist_gin ON pm_records USING gin(physical_checklist_json);

CREATE TRIGGER trg_pm_records_updated_at
BEFORE UPDATE ON pm_records
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- 9. PRODUCTION SQL VIEWS
-- =============================================================================

-- View 1: Preventive Maintenance (PM) Priority Queue
-- Identifies assets requiring urgent maintenance based on S.M.A.R.T. health, low storage, slow network, prolonged uptime, or overdue PM cycle (> 180 days).
CREATE OR REPLACE VIEW vw_pm_priority_queue AS
WITH last_pm AS (
    SELECT 
        asset_id, 
        MAX(performed_at) AS last_pm_date
    FROM pm_records
    GROUP BY asset_id
)
SELECT 
    a.id AS asset_id,
    a.asset_tag,
    a.hostname,
    a.assigned_user,
    a.ip_address,
    l.building AS location_building,
    l.floor AS location_floor,
    l.room_name AS location_room,
    a.last_seen_at,
    a.last_boot_time,
    ROUND(EXTRACT(EPOCH FROM (NOW() - a.last_boot_time)) / 86400.0, 1) AS uptime_days,
    lp.last_pm_date,
    COALESCE(EXTRACT(DAY FROM (NOW() - lp.last_pm_date))::INT, 999) AS days_since_last_pm,
    a.link_speed_mbps,
    -- Aggregate Urgent Reasons
    ARRAY_REMOVE(ARRAY[
        CASE WHEN a.link_speed_mbps < 1000.0 THEN 'Slow Link Speed (<1Gbps)' END,
        CASE WHEN a.last_boot_time < NOW() - INTERVAL '30 days' THEN 'Excessive Uptime (>30d Reboot Needed)' END,
        CASE WHEN lp.last_pm_date IS NULL OR lp.last_pm_date < NOW() - INTERVAL '180 days' THEN 'Overdue PM Cycle (>180d)' END,
        CASE WHEN a.disks_json::text ILIKE '%"healthStatus": "Warning"%' 
               OR a.disks_json::text ILIKE '%"healthStatus": "Unhealthy"%' 
               OR a.disks_json::text ILIKE '%"operationalStatus": "Degraded"%' THEN 'S.M.A.R.T. Disk Health Degraded' END,
        CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(a.disks_json) AS d
            WHERE (d->>'freeSpaceGb')::NUMERIC / NULLIF((d->>'totalSizeGb')::NUMERIC, 0) < 0.15
        ) THEN 'Low Disk Free Space (<15%)' END
    ], NULL) AS urgent_reasons
FROM assets a
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN last_pm lp ON a.id = lp.asset_id
WHERE a.status = 'Active'
  AND (
      a.link_speed_mbps < 1000.0
      OR a.last_boot_time < NOW() - INTERVAL '30 days'
      OR lp.last_pm_date IS NULL
      OR lp.last_pm_date < NOW() - INTERVAL '180 days'
      OR a.disks_json::text ILIKE '%"healthStatus": "Warning"%'
      OR a.disks_json::text ILIKE '%"healthStatus": "Unhealthy"%'
      OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(a.disks_json) AS d
          WHERE (d->>'freeSpaceGb')::NUMERIC / NULLIF((d->>'totalSizeGb')::NUMERIC, 0) < 0.15
      )
  )
ORDER BY days_since_last_pm DESC;

-- View 2: Unverified Audit Assets
-- Displays assets assigned to an ongoing audit campaign that are either offline > 14 days or not yet verified via physical QR scan.
CREATE OR REPLACE VIEW vw_unverified_audit_assets AS
SELECT 
    c.id AS campaign_id,
    c.name AS campaign_name,
    a.id AS asset_id,
    a.asset_tag,
    a.hostname,
    a.pc_serial_number,
    a.assigned_user,
    l.building AS registered_building,
    l.floor AS registered_floor,
    l.room_name AS registered_room,
    ar.verification_method,
    a.last_seen_at,
    CASE 
        WHEN a.last_seen_at IS NULL THEN 999
        ELSE EXTRACT(DAY FROM (NOW() - a.last_seen_at))::INT
    END AS offline_days,
    CASE 
        WHEN a.last_seen_at < NOW() - INTERVAL '14 days' OR a.last_seen_at IS NULL THEN 'Missing / Long Offline (>14d)'
        WHEN ar.verification_method = 'Agent_Auto_Verified' THEN 'Online Only (Pending Physical Scan)'
        ELSE 'Awaiting Verification'
    END AS audit_status
FROM audit_records ar
JOIN audit_campaigns c ON ar.campaign_id = c.id
JOIN assets a ON ar.asset_id = a.id
LEFT JOIN locations l ON a.location_id = l.id
WHERE c.status = 'In_Progress'
  AND (ar.verification_method != 'QR_Physical_Scan' OR ar.is_location_matched = FALSE);

-- View 3: Critical Unacknowledged Hardware Changes
-- Surfaces unauthorized tampering or component swaps (e.g. Monitor swapped, RAM reduced, Serial mismatch) requiring IT investigation.
CREATE OR REPLACE VIEW vw_critical_hardware_changes AS
SELECT 
    cl.id AS change_log_id,
    cl.detected_at,
    cl.severity,
    cl.change_type,
    a.id AS asset_id,
    a.asset_tag,
    a.hostname,
    a.assigned_user,
    l.building AS location_building,
    l.room_name AS location_room,
    cl.old_value,
    cl.new_value,
    cl.is_acknowledged
FROM asset_change_logs cl
JOIN assets a ON cl.asset_id = a.id
LEFT JOIN locations l ON a.location_id = l.id
WHERE cl.is_acknowledged = FALSE
  AND cl.severity IN ('CRITICAL', 'WARNING')
ORDER BY 
    CASE cl.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
    cl.detected_at DESC;

-- =============================================================================
-- 10. REALISTIC SEED DATA (OPTIONAL INITIAL SETUP)
-- =============================================================================

INSERT INTO departments (code, name) VALUES 
('IT', 'Information Technology Department'),
('HR', 'Human Resources & Administration'),
('ACC', 'Accounting & Financial Services'),
('OPS', 'Warehouse & Logistics Operations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO locations (building, floor, room_name, department_id)
SELECT 'Headquarters Tower A', 'Floor 4', 'Server & IT Ops Room', id FROM departments WHERE code = 'IT'
UNION ALL
SELECT 'Headquarters Tower A', 'Floor 3', 'Accounting Office', id FROM departments WHERE code = 'ACC'
UNION ALL
SELECT 'Logistics Hub B', 'Ground Floor', 'Dispatch Dispatching Desk', id FROM departments WHERE code = 'OPS';

