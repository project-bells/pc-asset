import { Request, Response } from 'express';
import { db } from '../db';

export class AnalyticsController {
  /**
   * GET /api/v1/admin/analytics/executive-summary
   * Returns aggregated high-level KPIs for C-level & IT management:
   * 1. OS Distribution (Windows 11 vs Windows 10 vs Legacy)
   * 2. Key Enterprise Software license seat counts (Office 365, Adobe, Antivirus)
   * 3. Windows Patch Compliance status and End-of-Support threat breakdown
   */
  public static async getExecutiveSummary(req: Request, res: Response) {
    try {
      // 1. Fetch analytical views concurrently
      const [osRes, patchRes, swRes, assetsRes] = await Promise.all([
        db.query('SELECT * FROM vw_os_distribution_summary;'),
        db.query('SELECT * FROM vw_windows_patch_advisory;'),
        db.query('SELECT * FROM vw_software_inventory_summary;'),
        db.query("SELECT id, status, last_seen_at FROM assets WHERE status IN ('Active', 'Unregistered');")
      ]);

      const osRows = osRes.rows || [];
      const patchRows = patchRes.rows || [];
      const swRows = swRes.rows || [];
      const assetRows = assetsRes.rows || [];

      // 2. Aggregate OS Distribution by Family
      const familyCounts: Record<string, number> = {};
      const totalMachines = assetRows.length || 1;

      osRows.forEach((r: any) => {
        const fam = r.os_family || 'Other';
        familyCounts[fam] = (familyCounts[fam] || 0) + Number(r.machine_count || 0);
      });

      const osFamilySummary = Object.entries(familyCounts).map(([family, count]) => ({
        family,
        machineCount: count,
        percentage: Math.round((count * 10000) / totalMachines) / 100
      })).sort((a, b) => b.machineCount - a.machineCount);

      // 3. Patch Compliance Metrics
      const totalAssessed = patchRows.length;
      const criticalEos = patchRows.filter((r: any) => r.patch_status === 'CRITICAL_EOS').length;
      const highOutdated = patchRows.filter((r: any) => r.patch_status === 'HIGH_OUTDATED').length;
      const warningReboot = patchRows.filter((r: any) => r.patch_status === 'WARNING_REBOOT_REQUIRED').length;
      const compliant = patchRows.filter((r: any) => r.patch_status === 'COMPLIANT').length;
      const complianceRatePercent = totalAssessed > 0
        ? Math.round((compliant * 10000) / totalAssessed) / 100
        : 100;

      // 4. Executive Software Seat Counts (Deduplicated unique PCs per major software category)
      const countUniquePcsByCategory = (categoryKeyword: string): number => {
        const uniquePcs = new Set<string>();
        swRows.forEach((row: any) => {
          const cat = (row.software_category || '').toLowerCase();
          const name = (row.software_name || '').toLowerCase();
          if (cat.includes(categoryKeyword.toLowerCase()) || name.includes(categoryKeyword.toLowerCase())) {
            const pcs = Array.isArray(row.installed_pcs) ? row.installed_pcs : [];
            pcs.forEach((p: any) => {
              if (p.asset_id) uniquePcs.add(p.asset_id);
            });
          }
        });
        return uniquePcs.size;
      };

      const softwareTotals = {
        microsoftOfficePcs: countUniquePcsByCategory('Office'),
        adobeCreativePcs: countUniquePcsByCategory('Adobe'),
        securityAntivirusPcs: countUniquePcsByCategory('Security & Antivirus'),
        remoteToolsPcs: countUniquePcsByCategory('Remote Tools & Support'),
        webBrowsersPcs: countUniquePcsByCategory('Web Browsers')
      };

      // 5. Fleet Connectivity
      const nowMs = Date.now();
      const onlineThresholdMs = 15 * 60 * 1000;
      const onlineNowCount = assetRows.filter((a: any) => {
        if (!a.last_seen_at) return false;
        return nowMs - new Date(a.last_seen_at).getTime() <= onlineThresholdMs;
      }).length;

      const unregisteredCount = assetRows.filter((a: any) => a.status === 'Unregistered').length;

      return res.status(200).json({
        fleet: {
          totalAssets: assetRows.length,
          activeAssets: assetRows.filter((a: any) => a.status === 'Active').length,
          unregisteredAssets: unregisteredCount,
          onlineNow: onlineNowCount
        },
        osDistribution: {
          byFamily: osFamilySummary,
          detailedBreakdown: osRows
        },
        patchCompliance: {
          totalAssessed,
          compliant,
          criticalEos,
          highOutdated,
          warningReboot,
          complianceRatePercent
        },
        softwareTotals
      });
    } catch (err: any) {
      console.error('[AnalyticsController] getExecutiveSummary error:', err);
      return res.status(500).json({ error: 'Failed to generate executive analytics summary.' });
    }
  }

  /**
   * GET /api/v1/admin/analytics/software
   * Installed Software Inventory & Executive License Seat Counting.
   * Query params:
   *   - search: string (matches software name or publisher)
   *   - category: string (exact or partial category match)
   * 
   * CRITICAL REQUIREMENT:
   * Deduplicates unique PCs across all matched software entries (e.g. Word, Excel, Visio
   * installed on the same PC will only count as 1 unique PC in totalUniquePcs).
   */
  public static async getSoftwareSummary(req: Request, res: Response) {
    try {
      const { search, category } = req.query;
      const result = await db.query('SELECT * FROM vw_software_inventory_summary;');
      const allRows: any[] = result.rows || [];

      // Collect all distinct categories across the full inventory
      const categoriesSet = new Set<string>();
      allRows.forEach((r) => {
        if (r.software_category) categoriesSet.add(r.software_category);
      });
      const categories = Array.from(categoriesSet).sort();

      // Apply filtering
      let filtered = allRows;

      if (category && typeof category === 'string' && category.trim()) {
        const catTerm = category.trim().toLowerCase();
        filtered = filtered.filter((r) => (r.software_category || '').toLowerCase().includes(catTerm));
      }

      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        filtered = filtered.filter((r) =>
          (r.software_name || '').toLowerCase().includes(searchTerm) ||
          (r.software_publisher || '').toLowerCase().includes(searchTerm)
        );
      }

      // Deduplicate unique PCs across all matching software records
      const uniqueAssetIds = new Set<string>();
      let totalInstallations = 0;

      filtered.forEach((r) => {
        totalInstallations += Number(r.installed_count || 0);
        const pcs = Array.isArray(r.installed_pcs) ? r.installed_pcs : [];
        pcs.forEach((p: any) => {
          if (p.asset_id) {
            uniqueAssetIds.add(p.asset_id);
          }
        });
      });

      return res.status(200).json({
        filter: {
          search: search || null,
          category: category || null
        },
        totalUniquePcs: uniqueAssetIds.size,
        totalInstallations,
        totalSoftwareTitles: filtered.length,
        categories,
        software: filtered
      });
    } catch (err: any) {
      console.error('[AnalyticsController] getSoftwareSummary error:', err);
      return res.status(500).json({ error: 'Failed to retrieve software inventory summary.' });
    }
  }

  /**
   * GET /api/v1/admin/analytics/patch-advisory
   * Windows Patch Compliance & Recommendation Engine.
   * Query params:
   *   - status: CRITICAL_EOS | HIGH_OUTDATED | WARNING_REBOOT_REQUIRED | COMPLIANT
   */
  public static async getPatchAdvisory(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const result = await db.query('SELECT * FROM vw_windows_patch_advisory;');
      const allRows: any[] = result.rows || [];

      // Calculate compliance summary metrics
      const summary = {
        total: allRows.length,
        criticalEos: allRows.filter((r) => r.patch_status === 'CRITICAL_EOS').length,
        highOutdated: allRows.filter((r) => r.patch_status === 'HIGH_OUTDATED').length,
        warningReboot: allRows.filter((r) => r.patch_status === 'WARNING_REBOOT_REQUIRED').length,
        compliant: allRows.filter((r) => r.patch_status === 'COMPLIANT').length,
        complianceRatePercent: allRows.length > 0
          ? Math.round((allRows.filter((r) => r.patch_status === 'COMPLIANT').length * 10000) / allRows.length) / 100
          : 100
      };

      // Filter by requested status if specified
      let advisories = allRows;
      if (status && typeof status === 'string' && status.trim()) {
        const filterStatus = status.trim().toUpperCase();
        advisories = allRows.filter((r) => (r.patch_status || '').toUpperCase() === filterStatus);
      }

      return res.status(200).json({
        summary,
        filter: {
          status: status || 'ALL'
        },
        advisories
      });
    } catch (err: any) {
      console.error('[AnalyticsController] getPatchAdvisory error:', err);
      return res.status(500).json({ error: 'Failed to retrieve Windows patch advisory report.' });
    }
  }
}
