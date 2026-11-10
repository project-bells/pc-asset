import { Router } from 'express';
import express from 'express';
import { AdminController } from '../controllers/adminController';
import { AnalyticsController } from '../controllers/analyticsController';
import { RemoteController } from '../controllers/remoteController';
import {
  requireAuth,
  requireRole,
  validateBody
} from '../middleware/securityMiddleware';
import { BindAssetSchema, RemoteSessionLaunchSchema } from '../schemas/validationSchemas';

const router = Router();

// Apply JWT Authentication to all Admin & Management endpoints
router.use(requireAuth);

// Read-only Dashboards & Reports (Accessible by VIEWER, TECHNICIAN, and ADMIN)
router.get('/dashboard/kpis', requireRole('VIEWER'), AdminController.getDashboardKpis);
router.get('/dashboard/hygiene-alerts', requireRole('VIEWER'), AdminController.getHygieneAlerts);
router.get('/locations', requireRole('VIEWER'), AdminController.listLocations);
router.get('/assets', requireRole('VIEWER'), AdminController.listAssets);
router.get('/reports/pm-priority-queue', requireRole('VIEWER'), AdminController.getPmPriorityQueue);
router.get('/reports/unverified-audit', requireRole('VIEWER'), AdminController.getUnverifiedAuditAssets);
router.get('/reports/critical-changes', requireRole('VIEWER'), AdminController.getCriticalHardwareChanges);

// Executive Analytics, Software License Counting & Windows Patch Compliance Engine
router.get('/analytics/executive-summary', requireRole('VIEWER'), AnalyticsController.getExecutiveSummary);
router.get('/analytics/software', requireRole('VIEWER'), AnalyticsController.getSoftwareSummary);
router.get('/analytics/patch-advisory', requireRole('VIEWER'), AnalyticsController.getPatchAdvisory);

// Remote Desktop & Guacamole VNC Integration
router.post(
  '/assets/:id/remote-session',
  express.json({ limit: '32kb' }),
  requireRole('TECHNICIAN'),
  validateBody(RemoteSessionLaunchSchema),
  RemoteController.createRemoteSession
);

router.get('/remote/logs', requireRole('VIEWER'), RemoteController.listRemoteAccessLogs);

// Sensitive Mutations: Strictly restricted to ADMIN role
router.patch(
  '/assets/:id/bind',
  express.json({ limit: '64kb' }),
  requireRole('ADMIN'),
  validateBody(BindAssetSchema),
  AdminController.bindAsset
);

router.post(
  '/changes/:id/acknowledge',
  express.json({ limit: '16kb' }),
  requireRole('ADMIN'),
  AdminController.acknowledgeChangeLog
);

export default router;
