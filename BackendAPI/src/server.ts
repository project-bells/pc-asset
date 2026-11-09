import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { db, pool } from './db';
import { safeErrorHandler } from './middleware/securityMiddleware';

// Route Modules
import agentRoutes from './routes/agentRoutes';
import auditRoutes from './routes/auditRoutes';
import pmRoutes from './routes/pmRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

// =============================================================================
// 1. HTTP Security Headers (OWASP Hardened via Helmet)
// =============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

// =============================================================================
// 2. Strict CORS Configuration (Anti-Data Exfiltration)
// =============================================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5000', 'https://portal.company.local'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin agent)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS Policy: Request origin is not in the approved corporate allowlist.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Timestamp', 'X-Signature'],
    credentials: true,
    maxAge: 86400
  })
);

// =============================================================================
// 3. Static Files: IT Admin Web Portal & Mobile QR Scanner (PWA)
// =============================================================================
app.use(express.static(path.join(__dirname, '../public')));

// =============================================================================
// 4. Health & Diagnostics Endpoint
// =============================================================================
app.get('/health', async (req: Request, res: Response) => {
  const isDbHealthy = await db.healthCheck();
  const statusCode = isDbHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isDbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: isDbHealthy ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  });
});

// =============================================================================
// 5. API Route Groupings (Each route applies tailored payload limits & validation)
// =============================================================================
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1/assets', agentRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/pm', pmRoutes);
app.use('/api/v1/admin', adminRoutes);

// =============================================================================
// 6. 404 Catch-All & Global Safe Error Handler (Zero Data Leakage)
// =============================================================================
app.use((req: Request, res: Response) => {
  return res.status(404).json({
    error: 'NotFound',
    message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`
  });
});

// Global Error Handler catches all exceptions, masking internal stack traces
app.use(safeErrorHandler);

// =============================================================================
// 7. Server Bootstrap & Graceful Process Termination
// =============================================================================
const server = app.listen(config.port, () => {
  console.log('================================================================');
  console.log(`  Enterprise IT Asset Management & PM API [AppSec Hardened]     `);
  console.log(`  Listening on: http://localhost:${config.port}                 `);
  console.log(`  Healthcheck:  http://localhost:${config.port}/health          `);
  console.log('================================================================');
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Received shutdown signal. Closing HTTP server...`);

  server.close(async () => {
    console.log('HTTP server closed. Draining database connection pool...');
    await pool.end();
    console.log('Database pool drained. Process terminated cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully terminating process after 10-second shutdown timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
