import { Router } from 'express';
import express from 'express';
import { AuditAndPmController } from '../controllers/auditAndPmController';
import {
  requireAuth,
  requireRole,
  auditAndPmRateLimiter,
  validateBody
} from '../middleware/securityMiddleware';
import { AuditVerifySchema } from '../schemas/validationSchemas';

const router = Router();

// Apply JWT Authentication and Rate Limiting
router.use(requireAuth);
router.use(auditAndPmRateLimiter);

// Audit Campaign progress
router.get('/campaigns/active/progress', requireRole('VIEWER'), AuditAndPmController.getActiveAuditProgress);

// Technicians and Admins can perform mobile QR scans and verify audit
router.get('/scan/:qrToken', requireRole('TECHNICIAN'), AuditAndPmController.scanQrToken);

router.post(
  '/verify',
  express.json({ limit: '64kb' }),
  requireRole('TECHNICIAN'),
  validateBody(AuditVerifySchema),
  AuditAndPmController.verifyAudit
);

export default router;
