import { Router } from 'express';
import express from 'express';
import { AgentController } from '../controllers/agentController';
import {
  agentHmacAndReplayMiddleware,
  inventoryRateLimiter,
  telemetryRateLimiter,
  validateBody
} from '../middleware/securityMiddleware';
import {
  FullInventoryPayloadSchema,
  TelemetryPayloadSchema
} from '../schemas/validationSchemas';

const router = Router();

// Body parser verify callback to capture raw buffer for HMAC verification
const rawBodySaver = (req: any, res: any, buf: Buffer) => {
  req.rawBody = buf;
};

// =============================================================================
// Public Endpoint: Version Manifest
// =============================================================================
router.get('/version', AgentController.getAgentVersion);

// =============================================================================
// Hardened Agent Endpoints (HMAC Signature, Anti-Replay, Rate Limits & Zod)
// =============================================================================

// Route 1: Full Inventory Sync (Strict 256KB Payload Limit)
router.post(
  '/inventory',
  inventoryRateLimiter,
  express.json({ limit: '256kb', verify: rawBodySaver }),
  agentHmacAndReplayMiddleware,
  validateBody(FullInventoryPayloadSchema),
  AgentController.syncInventory
);

// Route 2: Telemetry Heartbeat (Strict 32KB Payload Limit)
router.post(
  '/telemetry',
  telemetryRateLimiter,
  express.json({ limit: '32kb', verify: rawBodySaver }),
  agentHmacAndReplayMiddleware,
  validateBody(TelemetryPayloadSchema),
  AgentController.recordTelemetry
);

// Route 3: Command Execution Receipt
router.post(
  '/commands/receipt',
  express.json({ limit: '16kb', verify: rawBodySaver }),
  agentHmacAndReplayMiddleware,
  AgentController.receiveCommandReceipt
);

export default router;
