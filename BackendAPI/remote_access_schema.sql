-- =============================================================================
-- Enterprise IT Asset Guard: Remote Access & Guacamole VNC Session Integration
-- Database Engine: PostgreSQL 16+
-- Script: remote_access_schema.sql
-- =============================================================================

-- =============================================================================
-- 1. ASSET TABLE EXTENSIONS FOR ULTRAVNC INTEGRATION
-- =============================================================================

DO $$ 
BEGIN
    -- 1. VNC Readiness Status ('READY', 'SERVICE_STOPPED', 'PORT_CLOSED', 'UNKNOWN')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'vnc_status'
    ) THEN
        ALTER TABLE assets ADD COLUMN vnc_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN';
    END IF;

    -- 2. VNC Port (Default 5900 for standard UltraVNC)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'vnc_port'
    ) THEN
        ALTER TABLE assets ADD COLUMN vnc_port INT NOT NULL DEFAULT 5900;
    END IF;

    -- 3. Encrypted VNC Password (AES-256-GCM encrypted, nullable for per-PC override)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'vnc_password_encrypted'
    ) THEN
        ALTER TABLE assets ADD COLUMN vnc_password_encrypted TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_vnc_status ON assets(vnc_status);

-- =============================================================================
-- 2. IMMUTABLE SECURITY AUDIT LOG FOR REMOTE ACCESS (ISO 27001 / PDPA COMPLIANCE)
-- =============================================================================

CREATE TABLE IF NOT EXISTS remote_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    hostname VARCHAR(150) NOT NULL,
    target_ip VARCHAR(50) NOT NULL,
    technician_user_id VARCHAR(100) NOT NULL,
    technician_username VARCHAR(100) NOT NULL,
    access_mode VARCHAR(20) NOT NULL CHECK (access_mode IN ('VIEW_ONLY', 'FULL_CONTROL')),
    access_reason TEXT NOT NULL,
    recording_filename VARCHAR(255),
    client_source_ip VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for Security Audit Queries
CREATE INDEX IF NOT EXISTS idx_remote_logs_asset_id ON remote_access_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_remote_logs_created_at ON remote_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_logs_technician ON remote_access_logs(technician_username);

-- =============================================================================
-- 3. AUDIT VIEW FOR COMPLIANCE REPORTING & DRILL-DOWN
-- =============================================================================

CREATE OR REPLACE VIEW vw_remote_access_audit_logs AS
SELECT 
    r.id,
    r.asset_id,
    r.hostname,
    r.target_ip,
    r.technician_user_id,
    r.technician_username,
    r.access_mode,
    r.access_reason,
    r.recording_filename,
    r.client_source_ip,
    r.created_at,
    a.asset_tag,
    a.assigned_user,
    COALESCE(l.building, 'Unassigned') AS building,
    COALESCE(l.room_name, 'Unassigned Room') AS room_name,
    COALESCE(d.name, 'Unassigned Dept') AS department_name
FROM remote_access_logs r
LEFT JOIN assets a ON r.asset_id = a.id
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN departments d ON l.department_id = d.id
ORDER BY r.created_at DESC;
