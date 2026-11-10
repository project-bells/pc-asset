-- =============================================================================
-- Enterprise IT Asset Guard: Patch Compliance, Software & OS Distribution Views
-- Database Engine: PostgreSQL 16+
-- Script: patch_and_software_views.sql
-- =============================================================================

-- =============================================================================
-- 1. SCHEMA MIGRATION: ADD OS VERSIONING & PATCH COMPLIANCE COLUMNS TO ASSETS
-- =============================================================================

DO $$ 
BEGIN
    -- 1. OS Version (e.g. 21H2, 22H2, 23H2, 24H2)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'os_version'
    ) THEN
        ALTER TABLE assets ADD COLUMN os_version VARCHAR(50);
    END IF;

    -- 2. OS Update Build Revision (UBR from Registry, e.g. 3881)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'os_ubr'
    ) THEN
        ALTER TABLE assets ADD COLUMN os_ubr INT;
    END IF;

    -- 3. Latest installed Windows Cumulative Update KB ID (e.g. KB5044273)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'latest_kb_id'
    ) THEN
        ALTER TABLE assets ADD COLUMN latest_kb_id VARCHAR(50);
    END IF;

    -- 4. Installed Windows Security & Quality Patches collection
    -- Array of objects: [{ "kbId": "KB5044273", "description": "Security Update", "installedOn": "2026-10-15" }]
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'installed_patches_json'
    ) THEN
        ALTER TABLE assets ADD COLUMN installed_patches_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    -- 5. Pending Reboot flag (True if registry indicates pending file rename or Component-Based Servicing reboot)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'pending_reboot'
    ) THEN
        ALTER TABLE assets ADD COLUMN pending_reboot BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- High-performance indexes for analytical querying and filtering
CREATE INDEX IF NOT EXISTS idx_assets_os_version ON assets(os_version);
CREATE INDEX IF NOT EXISTS idx_assets_latest_kb ON assets(latest_kb_id);
CREATE INDEX IF NOT EXISTS idx_assets_pending_reboot ON assets(pending_reboot);
CREATE INDEX IF NOT EXISTS idx_assets_patches_gin ON assets USING gin(installed_patches_json);


-- =============================================================================
-- 2. VIEW 1: SOFTWARE INVENTORY SUMMARY (LICENSE COUNTING & DRILL-DOWN)
-- =============================================================================
-- Unnests 'installed_software_json' across all managed active/unregistered PCs.
-- Groups by normalized software category and exact software name + version.
-- Returns total installed count and a JSON array of specific machines.
-- =============================================================================

CREATE OR REPLACE VIEW vw_software_inventory_summary AS
WITH raw_software AS (
    SELECT 
        a.id AS asset_id,
        a.hostname,
        a.asset_tag,
        host(a.ip_address) AS ip_address,
        a.assigned_user,
        COALESCE(l.room_name, 'Unassigned Room') AS room_name,
        COALESCE(d.name, 'Unassigned Dept') AS department_name,
        TRIM(COALESCE(sw->>'displayName', sw->>'name', 'Unknown Software')) AS software_name,
        TRIM(COALESCE(sw->>'displayVersion', sw->>'version', 'Unknown')) AS software_version,
        TRIM(COALESCE(sw->>'publisher', 'Unknown')) AS software_publisher
    FROM assets a
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN departments d ON l.department_id = d.id
    CROSS JOIN LATERAL jsonb_array_elements(a.installed_software_json) AS sw
    WHERE a.status IN ('Active', 'Unregistered')
      AND jsonb_typeof(a.installed_software_json) = 'array'
      AND jsonb_array_length(a.installed_software_json) > 0
),
categorized_software AS (
    SELECT 
        asset_id,
        hostname,
        asset_tag,
        ip_address,
        assigned_user,
        room_name,
        department_name,
        software_name,
        software_version,
        software_publisher,
        CASE 
            -- Microsoft Productivity Suite
            WHEN software_name ILIKE '%Office%' 
              OR software_name ILIKE '%Word%' 
              OR software_name ILIKE '%Excel%' 
              OR software_name ILIKE '%PowerPoint%' 
              OR software_name ILIKE '%Outlook%' 
              OR software_name ILIKE '%Access%' 
              OR software_name ILIKE '%Visio%' 
              OR software_name ILIKE '%Project%' 
              OR software_name ILIKE '%Microsoft 365%' 
                THEN 'Microsoft Office / 365'

            -- Adobe Creative & PDF
            WHEN software_name ILIKE '%Adobe%' 
              OR software_name ILIKE '%Acrobat%' 
              OR software_name ILIKE '%Photoshop%' 
              OR software_name ILIKE '%Illustrator%' 
              OR software_name ILIKE '%InDesign%' 
                THEN 'Adobe Creative & PDF'

            -- Web Browsers
            WHEN software_name ILIKE '%Google Chrome%' 
              OR software_name ILIKE '%Firefox%' 
              OR software_name ILIKE '%Microsoft Edge%' 
              OR software_name ILIKE '%Brave%' 
              OR software_name ILIKE '%Opera%' 
                THEN 'Web Browsers'

            -- Remote Access & Support Tools
            WHEN software_name ILIKE '%AnyDesk%' 
              OR software_name ILIKE '%TeamViewer%' 
              OR software_name ILIKE '%UltraVNC%' 
              OR software_name ILIKE '%VNC%' 
              OR software_name ILIKE '%Remote Desktop%' 
              OR software_name ILIKE '%RustDesk%' 
              OR software_name ILIKE '%LogMeIn%' 
                THEN 'Remote Tools & Support'

            -- Software Development & IT Infrastructure Tools
            WHEN software_name ILIKE '%Visual Studio%' 
              OR software_name ILIKE '%VS Code%' 
              OR software_name ILIKE '%Git%' 
              OR software_name ILIKE '%Node.js%' 
              OR software_name ILIKE '%Python%' 
              OR software_name ILIKE '%Docker%' 
              OR software_name ILIKE '%CMake%' 
              OR software_name ILIKE '%SDK%' 
                THEN 'Development & IT Tools'

            -- Endpoint Security & Antivirus
            WHEN software_name ILIKE '%ESET%' 
              OR software_name ILIKE '%Antivirus%' 
              OR software_name ILIKE '%Endpoint Security%' 
              OR software_name ILIKE '%CrowdStrike%' 
              OR software_name ILIKE '%SentinelOne%' 
              OR software_name ILIKE '%Defender%' 
              OR software_name ILIKE '%Kaspersky%' 
              OR software_name ILIKE '%Trend Micro%' 
                THEN 'Security & Antivirus'

            -- Hospital, Chat & Productivity Utilities
            WHEN software_name ILIKE '%Synology Chat%' 
              OR software_name ILIKE '%Zoom%' 
              OR software_name ILIKE '%Teams%' 
              OR software_name ILIKE '%Line%' 
              OR software_name ILIKE '%7-Zip%' 
              OR software_name ILIKE '%WinRAR%' 
              OR software_name ILIKE '%Notepad++%' 
              OR software_name ILIKE '%PDF24%' 
              OR software_name ILIKE '%Foxit%' 
                THEN 'Utilities & Collaboration'

            ELSE 'General Software'
        END AS software_category
    FROM raw_software
    WHERE software_name != '' AND software_name != 'Unknown Software'
)
SELECT 
    software_category,
    software_name,
    software_version,
    software_publisher,
    COUNT(DISTINCT asset_id) AS installed_count,
    jsonb_agg(
        jsonb_build_object(
            'asset_id', asset_id,
            'hostname', hostname,
            'asset_tag', asset_tag,
            'ip_address', ip_address,
            'assigned_user', assigned_user,
            'room_name', room_name,
            'department_name', department_name
        ) ORDER BY hostname
    ) AS installed_pcs
FROM categorized_software
GROUP BY 
    software_category,
    software_name,
    software_version,
    software_publisher
ORDER BY 
    installed_count DESC, 
    software_category, 
    software_name;


-- =============================================================================
-- 3. VIEW 2: OS DISTRIBUTION & FLEET ADOPTION SUMMARY
-- =============================================================================
-- Groups assets by OS Family, OS Name, Release Version, and Kernel Build.
-- Calculates machine count and percentage across the entire enterprise estate.
-- =============================================================================

CREATE OR REPLACE VIEW vw_os_distribution_summary AS
WITH fleet_totals AS (
    SELECT COUNT(*)::NUMERIC AS total_fleet_count 
    FROM assets 
    WHERE status IN ('Active', 'Unregistered')
),
os_categorized AS (
    SELECT 
        a.id AS asset_id,
        a.hostname,
        a.asset_tag,
        host(a.ip_address) AS ip_address,
        COALESCE(d.name, 'Unassigned') AS department_name,
        a.os_name,
        COALESCE(a.os_version, 'Unknown') AS os_version,
        COALESCE(a.os_build, 'Unknown') AS os_build,
        CASE 
            WHEN a.os_name ILIKE '%Windows 11%' THEN 'Windows 11'
            WHEN a.os_name ILIKE '%Windows 10%' THEN 'Windows 10'
            WHEN a.os_name ILIKE '%Server%' THEN 'Windows Server'
            WHEN a.os_name ILIKE '%Windows 7%' THEN 'Windows 7 (Legacy)'
            WHEN a.os_name ILIKE '%Windows 8%' THEN 'Windows 8.1 (Legacy)'
            WHEN a.os_name ILIKE '%Linux%' OR a.os_name ILIKE '%Ubuntu%' THEN 'Linux'
            WHEN a.os_name ILIKE '%macOS%' OR a.os_name ILIKE '%OS X%' THEN 'macOS'
            ELSE 'Other OS'
        END AS os_family
    FROM assets a
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN departments d ON l.department_id = d.id
    WHERE a.status IN ('Active', 'Unregistered')
)
SELECT 
    osc.os_family,
    osc.os_name,
    osc.os_version,
    osc.os_build,
    COUNT(*) AS machine_count,
    ROUND((COUNT(*) * 100.0 / NULLIF(ft.total_fleet_count, 0)), 2) AS percentage,
    jsonb_agg(
        jsonb_build_object(
            'asset_id', osc.asset_id,
            'hostname', osc.hostname,
            'asset_tag', osc.asset_tag,
            'ip_address', osc.ip_address,
            'department_name', osc.department_name
        ) ORDER BY osc.hostname
    ) AS machines
FROM os_categorized osc
CROSS JOIN fleet_totals ft
GROUP BY 
    osc.os_family,
    osc.os_name,
    osc.os_version,
    osc.os_build,
    ft.total_fleet_count
ORDER BY 
    machine_count DESC, 
    osc.os_family;


-- =============================================================================
-- 4. VIEW 3: WINDOWS PATCH COMPLIANCE & ACTIONABLE ADVISORY ENGINE
-- =============================================================================
-- Evaluates patch recency, End-of-Support flags, and pending reboots.
-- Returns structured severity flags and human-friendly Thai recommendations.
-- =============================================================================

CREATE OR REPLACE VIEW vw_windows_patch_advisory AS
SELECT 
    a.id AS asset_id,
    a.hostname,
    a.asset_tag,
    host(a.ip_address) AS ip_address,
    COALESCE(l.building, 'Unassigned') AS building,
    COALESCE(l.room_name, 'Unassigned') AS room_name,
    COALESCE(d.name, 'Unassigned') AS department_name,
    a.assigned_user,
    a.os_name,
    COALESCE(a.os_version, 'Unknown') AS os_version,
    COALESCE(a.os_build, 'Unknown') AS os_build,
    a.os_ubr,
    COALESCE(a.latest_kb_id, 'None') AS latest_kb_id,
    a.last_windows_update,
    CASE 
        WHEN a.last_windows_update IS NULL THEN 999
        ELSE EXTRACT(DAY FROM (NOW() - a.last_windows_update::timestamp))::INT
    END AS days_since_last_patch,
    COALESCE(a.pending_reboot, FALSE) AS pending_reboot,
    a.last_boot_time,
    CASE 
        WHEN a.last_boot_time IS NULL THEN 0
        ELSE EXTRACT(DAY FROM (NOW() - a.last_boot_time))::INT
    END AS days_since_last_boot,
    a.last_seen_at,

    -- Compliance Severity Rule Engine
    CASE 
        -- 1. End-of-Support Operating Systems (Highest Threat)
        WHEN a.os_name ILIKE '%Windows 10%' 
          OR a.os_name ILIKE '%Windows 7%' 
          OR a.os_name ILIKE '%Windows 8%' 
            THEN 'CRITICAL_EOS'

        -- 2. Windows Updates older than 45 days or never updated
        WHEN a.last_windows_update IS NULL 
          OR EXTRACT(DAY FROM (NOW() - a.last_windows_update::timestamp)) > 45 
            THEN 'HIGH_OUTDATED'

        -- 3. Security patch installed waiting for reboot or uptime > 30 days
        WHEN a.pending_reboot = TRUE 
          OR (a.last_boot_time IS NOT NULL AND a.last_boot_time < NOW() - INTERVAL '30 days')
            THEN 'WARNING_REBOOT_REQUIRED'

        -- 4. Fully compliant
        ELSE 'COMPLIANT'
    END AS patch_status,

    -- Thai Actionable Advisory for IT Technicians & Executives
    CASE 
        WHEN a.os_name ILIKE '%Windows 10%' 
            THEN 'ระบบปฏิบัติการ Windows 10 ใกล้สิ้นสุดระยะสนับสนุน (End-of-Support: ต.ค. 2025) แนะนำให้วางแผนจัดสรรงบประมาณอัปเกรดเครื่องเป็น Windows 11'
        WHEN a.os_name ILIKE '%Windows 7%' OR a.os_name ILIKE '%Windows 8%' 
            THEN 'ระบบปฏิบัติการหมดระยะสนับสนุนแล้ว (End-of-Life) มีช่องโหว่ความปลอดภัยระดับร้ายแรง จำเป็นต้องอัปเกรด OS หรือเปลี่ยนอุปกรณ์ทันที'
        WHEN a.last_windows_update IS NULL 
            THEN 'ไม่พบประวัติการติดตั้ง Windows Update แนะนำให้เปิด Windows Update เพื่อดาวน์โหลดและติดตั้ง Security Baseline ทันที'
        WHEN EXTRACT(DAY FROM (NOW() - a.last_windows_update::timestamp)) > 45 
            THEN 'ไม่ได้ติดตั้ง Security Update มานานเกินกว่า 45 วัน แนะนำให้รัน Windows Update ติดตั้ง Cumulative Update ล่าสุด'
        WHEN a.pending_reboot = TRUE 
            THEN 'ติดตั้ง Security Patch สำเร็จแล้ว แต่รอรีสตาร์ทเครื่อง แนะนำให้ผู้ใช้งาน Restart PC เพื่อให้ Patch มีผลบังคับใช้'
        WHEN a.last_boot_time IS NOT NULL AND a.last_boot_time < NOW() - INTERVAL '30 days' 
            THEN 'เครื่องเปิดทำงานต่อเนื่องนานเกิน 30 วัน แนะนำให้รีสตาร์ทเครื่องเพื่อเคลียร์หน่วยความจำและบังคับใช้ Patch'
        ELSE 'เครื่องอยู่ในเกณฑ์มาตรฐานความปลอดภัย (Patch Compliance ปกติ)'
    END AS recommendation_th,

    -- Sort ordering for dashboard prioritization
    CASE 
        WHEN a.os_name ILIKE '%Windows 10%' OR a.os_name ILIKE '%Windows 7%' OR a.os_name ILIKE '%Windows 8%' THEN 1
        WHEN a.last_windows_update IS NULL OR EXTRACT(DAY FROM (NOW() - a.last_windows_update::timestamp)) > 45 THEN 2
        WHEN a.pending_reboot = TRUE OR (a.last_boot_time IS NOT NULL AND a.last_boot_time < NOW() - INTERVAL '30 days') THEN 3
        ELSE 4
    END AS priority_order

FROM assets a
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN departments d ON l.department_id = d.id
WHERE a.status IN ('Active', 'Unregistered')
ORDER BY 
    priority_order ASC,
    days_since_last_patch DESC,
    a.hostname ASC;

-- Grant permissions if specific application roles are configured
-- GRANT SELECT ON vw_software_inventory_summary TO app_reader;
-- GRANT SELECT ON vw_os_distribution_summary TO app_reader;
-- GRANT SELECT ON vw_windows_patch_advisory TO app_reader;
