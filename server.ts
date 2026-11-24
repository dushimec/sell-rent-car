import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { authRouter, requireAuth } from './src/server/routes/authRoutes.ts';
import {
  customerRouter,
  favoritesRouter,
  notificationsRouter,
} from './src/server/routes/customerRoutes.ts';
import { rentalBookingsApiRouter, rentalsRouter } from './src/server/routes/rentalsRoutes.ts';
import { salesInquiriesApiRouter, salesRouter } from './src/server/routes/salesRoutes.ts';

dotenv.config();

const PORT = 3000;
const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

app.use(express.json({ limit: '7mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests, please wait a moment and try again.' },
});

app.use('/api', apiLimiter);

const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AutoSuite API',
    modules: ['auth', 'sales', 'rentals', 'uploads', 'notifications'],
    timestamp: new Date().toISOString(),
  });
});

// Authentication, Customer Portal, & Separate Sales / Rentals REST API modules
app.use('/api/auth', authRouter);
app.use('/api/customer', customerRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/sales-inquiries', salesInquiriesApiRouter);
app.use('/api/rentals', rentalsRouter);
app.use('/api/rental-bookings', rentalBookingsApiRouter);

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AutoSuite Commercial Automotive API',
    version: '1.2.0',
    description:
      'Modular REST API with Firebase Admin ID token verification (/api/auth/*) and separated Car Sales (/api/sales/*) & Car Rentals (/api/rentals/*) workflows.',
  },
  paths: {
    '/api/health': {
      get: { summary: 'API health probe', responses: { '200': { description: 'Service healthy' } } },
    },
    '/api/auth/session': {
      post: {
        summary: 'Verify Firebase ID token via Admin SDK and establish server session',
        responses: { '200': { description: 'Verified session + expiry' }, '401': { description: 'Invalid token' } },
      },
      get: {
        summary: 'Inspect active authenticated session via Bearer token',
        responses: { '200': { description: 'Authenticated identity' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/api/auth/logout': {
      post: { summary: 'Revoke active server session', responses: { '200': { description: 'Signed out' } } },
    },
    '/api/auth/forgot-password': {
      post: { summary: 'Non-enumerating password recovery request', responses: { '200': { description: 'Uniform acknowledgement' } } },
    },
    '/api/auth/reset-password/validate': {
      post: { summary: 'Validate password reset token expiration and password strength', responses: { '200': { description: 'Valid token & policy' } } },
    },
    '/api/sales/inquiries/validate': {
      post: {
        summary: 'Validate Purchase Requirements Form & generate unique SALE reference',
        responses: { '200': { description: 'Validated inquiry payload + inquiryReference' }, '400': { description: 'Validation error' } },
      },
    },
    '/api/rentals/quote': {
      post: {
        summary: 'Authoritative server-side rental quote calculation (integer cents)',
        responses: { '200': { description: 'Calculated integer-cent breakdown' }, '400': { description: 'Invalid date range or inputs' } },
      },
    },
    '/api/rentals/bookings/validate': {
      post: {
        summary: 'Validate Rental Booking Form, compute quote, and generate unique RENT reference',
        responses: { '200': { description: 'Validated booking payload + quote + bookingReference' }, '400': { description: 'Validation error' } },
      },
    },
    '/api/uploads/image': {
      post: {
        summary: 'Validate and store vehicle photography (JPEG/PNG/WEBP <= 5MB)',
        responses: { '201': { description: 'Image uploaded and URL returned' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/api/notifications/email': {
      post: {
        summary: 'Dispatch transactional email via Resend when configured',
        responses: { '200': { description: 'Delivery status returned truthfully' }, '401': { description: 'Unauthorized' } },
      },
    },
  },
};

app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/api/docs', (_req, res) => {
  res.type('text/html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoSuite API Reference</title>
  <style>
    body { background: #080808; color: #fff; font-family: system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    a { color: #20D94B; }
    pre { background: #171717; border: 1px solid #353535; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 13px; }
  </style>
</head>
<body>
  <h1>AutoSuite API Reference</h1>
  <p>OpenAPI 3.0 specification available at <a href="/api/openapi.json">/api/openapi.json</a>.</p>
  <pre>${JSON.stringify(openApiSpec, null, 2)}</pre>
</body>
</html>`);
});

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(180),
  html: z.string().min(1).max(12000),
});

app.post('/api/notifications/email', requireAuth, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email payload.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'AutoSuite <onboarding@resend.dev>';

  if (!apiKey) {
    return res.json({
      sent: false,
      configured: false,
      message: 'Email provider not configured; in-app notification recorded.',
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [parsed.data.to],
        subject: parsed.data.subject,
        html: parsed.data.html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({
        sent: false,
        configured: true,
        error: data?.message || 'Resend rejected the email request.',
      });
    }

    return res.json({ sent: true, configured: true, id: data?.id });
  } catch (error) {
    console.error('Resend email dispatch error:', error);
    return res.status(500).json({ sent: false, configured: true, error: 'Email delivery failed.' });
  }
});

const uploadSchema = z.object({
  filename: z.string().min(1).max(160),
  dataUrl: z.string().min(20),
});

function detectImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

app.post('/api/uploads/image', requireAuth, async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid upload payload.' });
  }

  const match = parsed.data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Only JPEG, PNG, and WEBP image uploads are permitted.' });
  }

  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return res.status(400).json({ error: 'Image size must be between 1 byte and 5MB.' });
  }

  const detectedExt = detectImageType(buffer);
  if (!detectedExt) {
    return res.status(400).json({ error: 'File contents do not match a valid JPEG, PNG, or WEBP image.' });
  }

  const safeName = `${crypto.randomUUID()}.${detectedExt}`;
  const targetPath = path.resolve(uploadDir, safeName);
  if (!targetPath.startsWith(uploadDir + path.sep)) {
    return res.status(400).json({ error: 'Invalid file destination.' });
  }

  await fs.promises.writeFile(targetPath, buffer);
  return res.status(201).json({
    url: `/uploads/${safeName}`,
    storage: process.env.R2_BUCKET_NAME ? 'local-fallback' : 'local',
    bytes: buffer.length,
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoSuite server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AutoSuite server:', err);
  process.exit(1);
});
