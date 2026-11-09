import { Router } from 'express';
import express from 'express';
import { AuditAndPmController } from '../controllers/auditAndPmController';
import {
  requireAuth,
  requireRole,
  auditAndPmRateLimiter,
  validateBody
} from '../middleware/securityMiddleware';
import { PmSubmitSchema } from '../schemas/validationSchemas';

const router = Router();

// Apply JWT Authentication and Rate Limiting
router.use(requireAuth);
router.use(auditAndPmRateLimiter);

// Technicians and Admins can view PM pre-fill
router.get('/pre-fill/:assetId', requireRole('TECHNICIAN'), AuditAndPmController.preFillPm);

// Submitting PM requires validating the checklist and base64 signature
router.post(
  '/submit',
  express.json({ limit: '2mb' }), // Allow up to 2MB to comfortably hold 100KB signature
  requireRole('TECHNICIAN'),
  validateBody(PmSubmitSchema),
  AuditAndPmController.submitPm
);

export default router;
