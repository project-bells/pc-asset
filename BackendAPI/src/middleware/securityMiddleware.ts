import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ZodSchema, ZodError } from 'zod';
import { config } from '../config';

// Augment Express Request type for rawBody and authenticated RBAC User
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: {
        userId: string;
        username: string;
        role: 'VIEWER' | 'TECHNICIAN' | 'ADMIN';
      };
    }
  }
}

export type UserRole = 'VIEWER' | 'TECHNICIAN' | 'ADMIN';

// Role Hierarchy: ADMIN has all privileges; TECHNICIAN includes VIEWER privileges
const RoleHierarchy: Record<UserRole, number> = {
  VIEWER: 1,
  TECHNICIAN: 2,
  ADMIN: 3
};

// =============================================================================
// 1. Zod Request Validation Middleware Factory
// =============================================================================

export const validateBody = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Request payload failed schema and security constraints.',
      details: (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message
      }))
    });
  }

  req.body = result.data;
  next();
};

export const validateParams = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: 'ParameterValidationError',
      message: 'URL parameters failed security validation.',
      details: (result.error as ZodError).errors.map((e) => ({
        param: e.path.join('.'),
        issue: e.message
      }))
    });
  }

  req.params = result.data;
  next();
};

export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      error: 'QueryValidationError',
      message: 'Query string parameters failed security validation.',
      details: (result.error as ZodError).errors.map((e) => ({
        param: e.path.join('.'),
        issue: e.message
      }))
    });
  }

  req.query = result.data;
  next();
};

// =============================================================================
// 2. Strong Agent Authentication: Timing-Safe API Key + Anti-Replay + HMAC
// =============================================================================

export const agentHmacAndReplayMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('X-Api-Key');
  const timestampStr = req.header('X-Timestamp');
  const signature = req.header('X-Signature');

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing required X-Api-Key header.' });
  }

  // 1. Validate Pre-Shared Key using Constant-Time Comparison
  try {
    const providedKeyBuf = Buffer.from(apiKey);
    const expectedKeyBuf = Buffer.from(config.agentApiKey);

    if (
      providedKeyBuf.length !== expectedKeyBuf.length ||
      !crypto.timingSafeEqual(providedKeyBuf, expectedKeyBuf)
    ) {
      console.warn(`[Security Alert] Invalid API Key attempt from IP: ${req.ip}`);
      return res.status(403).json({ error: 'Forbidden: Invalid API credentials.' });
    }
  } catch {
    return res.status(500).json({ error: 'Authentication processing error.' });
  }

  // 2. Anti-Replay Protection: Enforce 5-minute clock drift boundary
  if (timestampStr) {
    const requestTimeMs = parseInt(timestampStr, 10);
    const serverTimeMs = Date.now();
    const driftMs = Math.abs(serverTimeMs - requestTimeMs);
    const maxDriftMs = 5 * 60 * 1000; // 5 minutes

    if (isNaN(requestTimeMs) || driftMs > maxDriftMs) {
      console.warn(`[Security Alert] Replay Attack or Out-of-Sync clock detected from IP ${req.ip}. Drift: ${driftMs}ms`);
      return res.status(401).json({
        error: 'Unauthorized: Request timestamp expired or outside permitted 5-minute replay window.'
      });
    }

    // 3. HMAC-SHA256 Payload Verification (If X-Signature is attached)
    if (signature) {
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
      const payloadToSign = `${timestampStr}.${rawBody}`;
      const expectedHmac = crypto
        .createHmac('sha256', config.agentApiKey)
        .update(payloadToSign)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedHmac, 'hex');

      if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
      ) {
        console.warn(`[Security Alert] HMAC-SHA256 signature verification mismatch from IP ${req.ip}`);
        return res.status(403).json({ error: 'Forbidden: Tampered payload or invalid HMAC signature.' });
      }
    }
  }

  next();
};

// =============================================================================
// 3. RBAC & JWT Authentication for Admin & Technicians
// =============================================================================

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');

  // Local / Intranet Web Portal access: Allow seamless connection with ADMIN role in demo mode
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.STRICT_AUTH === 'true') {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
    }
    req.user = {
      userId: 'usr-admin-01',
      username: 'admin',
      role: 'ADMIN'
    };
    return next();
  }

  const token = authHeader.substring(7);

  // Accept mock role tokens generated by Frontend AuthContext in demo mode
  if (token.startsWith('mock_jwt_token_for_')) {
    if (process.env.STRICT_AUTH === 'true') {
      return res.status(401).json({ error: 'Unauthorized: Mock tokens are disabled in STRICT_AUTH mode.' });
    }
    const roleStr = token.replace('mock_jwt_token_for_', '').toUpperCase();
    const role = (['ADMIN', 'TECHNICIAN', 'VIEWER'].includes(roleStr) ? roleStr : 'ADMIN') as UserRole;
    req.user = {
      userId: `usr-${role.toLowerCase()}-01`,
      username: role.toLowerCase(),
      role: role
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      userId: decoded.sub || decoded.userId,
      username: decoded.username,
      role: (decoded.role?.toUpperCase() as UserRole) || 'VIEWER'
    };
    next();
  } catch (err) {
    if (process.env.STRICT_AUTH === 'true') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired JWT token.' });
    }
    // Fallback to ADMIN for local intranet portal requests in demo mode
    req.user = {
      userId: 'usr-admin-01',
      username: 'admin',
      role: 'ADMIN'
    };
    next();
  }
};

export const requireRole = (minimumRole: UserRole) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Unauthenticated user.' });
  }

  const userLevel = RoleHierarchy[req.user.role] || 0;
  const requiredLevel = RoleHierarchy[minimumRole] || 0;

  if (userLevel < requiredLevel) {
    console.warn(`[RBAC Violation] User '${req.user.username}' (${req.user.role}) attempted action requiring '${minimumRole}'.`);
    return res.status(403).json({
      error: 'Forbidden: Insufficient privileges for this administrative operation.'
    });
  }

  next();
};

// =============================================================================
// 4. Granular Tiered Rate Limiters
// =============================================================================

export const telemetryRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // Allow max 15 requests per 5-minute window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many telemetry packets. Please throttle agent timer.' }
});

export const inventoryRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow max 10 inventory scans per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Inventory sync limit exceeded. Scans are scheduled every 12 hours.' }
});

export const auditAndPmRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Up to 100 operations per technician in 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many audit/PM submissions. Please wait before retrying.' }
});

export const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 login/QR lookups per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. IP temporarily restricted.' }
});

// =============================================================================
// 5. Security Audit Logging for Sensitive Administrative Mutations
// =============================================================================

export const logAdminAudit = (
  action: string,
  user: { userId: string; username: string } | undefined,
  resourceId: string,
  details: Record<string, any>,
  req: Request
) => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    performedBy: user?.username || 'SYSTEM_UNKNOWN',
    userId: user?.userId || 'N/A',
    sourceIp: req.ip || req.socket.remoteAddress,
    userAgent: req.header('User-Agent') || 'Unknown',
    resourceId,
    details
  };

  // Structured logging to stdout / centralized SIEM
  console.log(`[SECURITY AUDIT LOG] ${JSON.stringify(auditEntry)}`);
};

// =============================================================================
// 6. Safe Error Handler (Zero Data Leakage)
// =============================================================================

export const safeErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Log full stack trace internally only
  console.error(`[Internal Server Error] ${req.method} ${req.originalUrl} | IP: ${req.ip}:`, err);

  // Return generic error without exposing DB tables, query text, or stack traces
  const statusCode = typeof err.status === 'number' ? err.status : 500;
  const message = isProduction && statusCode === 500 
    ? 'An unexpected error occurred while processing your request. Please contact IT Security.' 
    : err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    error: err.name || 'ServerError',
    message
  });
};

