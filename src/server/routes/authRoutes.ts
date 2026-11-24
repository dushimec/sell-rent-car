import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export interface VerifiedAuthIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  provider: string;
  name?: string;
  expiresAt: number;
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: VerifiedAuthIdentity;
}

function loadFirebaseAppletConfig(): { projectId?: string; authDomain?: string } {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string; authDomain?: string };
    return parsed;
  } catch {
    return {};
  }
}

function loadFirebaseProjectId(): string | null {
  const envProjectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  if (envProjectId && envProjectId !== 'remixed-project-id') {
    return envProjectId;
  }
  const parsed = loadFirebaseAppletConfig();
  if (!parsed.projectId || parsed.projectId === 'remixed-project-id') return null;
  return parsed.projectId;
}

export function getServerFirebaseConfigSummary() {
  const applet = loadFirebaseAppletConfig();
  const projectId = loadFirebaseProjectId();
  const authDomain =
    (
      process.env.FIREBASE_AUTH_DOMAIN ||
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      applet.authDomain ||
      ''
    ).trim() || null;
  const websiteDomain = (process.env.BUSINESS_WEBSITE_DOMAIN || '').trim() || null;
  const usingDefaultFirebaseDomain = Boolean(
    authDomain && (authDomain.endsWith('.firebaseapp.com') || authDomain.endsWith('.web.app'))
  );

  return {
    projectId,
    authDomain,
    websiteDomain,
    usingDefaultFirebaseDomain,
    expectedRedirectUri: authDomain ? `https://${authDomain}/__/auth/handler` : null,
  };
}

let cachedAdminApp: App | null = null;

function getFirebaseAdminApp(): App | null {
  if (cachedAdminApp) return cachedAdminApp;
  const projectId = loadFirebaseProjectId();
  if (!projectId) return null;
  cachedAdminApp = getApps().length ? getApp() : initializeApp({ projectId });
  return cachedAdminApp;
}

const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const activeSessions = new Map<string, { uid: string; email: string; emailVerified: boolean; provider: string; expiresAt: number }>();
const usedResetTokenIds = new Set<string>();

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [jti, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(jti);
    }
  }
}

function signPayload(payloadObj: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T extends { exp?: number }>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createResetTokenForTestOrRecovery(email: string, ttlMs = 15 * 60 * 1000): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + ttlMs;
  const jti = crypto.randomUUID();
  const token = signPayload({
    typ: 'pwd_reset',
    jti,
    email: email.trim().toLowerCase(),
    exp: expiresAt,
  });
  return { token, expiresAt };
}

export function createSessionTokenForTest(
  uid: string,
  email: string,
  ttlMs = 60 * 60 * 1000
): string {
  const expiresAt = Date.now() + ttlMs;
  const jti = crypto.randomUUID();
  activeSessions.set(jti, {
    uid,
    email,
    emailVerified: true,
    provider: 'password',
    expiresAt,
  });
  return signPayload({
    typ: 'session',
    jti,
    uid,
    email,
    emailVerified: true,
    provider: 'password',
    exp: expiresAt,
  });
}

export function validateResetTokenPayload(token: string): {
  valid: boolean;
  email?: string;
  jti?: string;
  expiresAt?: number;
  error?: string;
} {
  const payload = verifySignedPayload<{
    typ?: string;
    jti?: string;
    email?: string;
    exp?: number;
  }>(token);

  if (!payload || payload.typ !== 'pwd_reset' || !payload.jti || !payload.email || !payload.exp) {
    return { valid: false, error: 'Password reset link is invalid or has expired.' };
  }
  if (usedResetTokenIds.has(payload.jti)) {
    return { valid: false, error: 'This password reset link has already been used.' };
  }
  return {
    valid: true,
    email: payload.email,
    jti: payload.jti,
    expiresAt: payload.exp,
  };
}

export async function verifyIncomingBearerToken(token: string): Promise<VerifiedAuthIdentity | null> {
  // 1. Check server-issued HMAC session token
  if (token.split('.').length === 2) {
    const parsed = verifySignedPayload<{
      typ?: string;
      jti?: string;
      uid?: string;
      email?: string;
      emailVerified?: boolean;
      provider?: string;
      exp?: number;
    }>(token);

    if (!parsed || parsed.typ !== 'session' || !parsed.jti || !parsed.uid || !parsed.exp) {
      return null;
    }

    const active = activeSessions.get(parsed.jti);
    if (!active || active.expiresAt <= Date.now()) {
      activeSessions.delete(parsed.jti);
      return null;
    }

    return {
      uid: parsed.uid,
      email: parsed.email || '',
      emailVerified: Boolean(parsed.emailVerified),
      provider: parsed.provider || 'firebase',
      expiresAt: parsed.exp,
      sessionId: parsed.jti,
    };
  }

  // 2. Verify Firebase ID Token via Firebase Admin SDK (no IAM needed)
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      emailVerified: Boolean(decoded.email_verified),
      provider: decoded.firebase?.sign_in_provider || 'firebase',
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      expiresAt: decoded.exp * 1000,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Empty token.' });
    return;
  }

  const verified = await verifyIncomingBearerToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Session is invalid or has expired. Please sign in again.' });
    return;
  }

  req.authUser = verified;
  next();
}

export const authRouter = Router();

const authSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

const sessionExchangeSchema = z.object({
  idToken: z.string().min(20, 'Firebase ID token is required.'),
  rememberMe: z.boolean().optional().default(false),
});

async function handleSessionExchange(req: Request, res: Response) {
  const parsed = sessionExchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid authentication payload.' });
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return res.status(503).json({ error: 'Authentication service is not configured.' });
  }

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(parsed.data.idToken);
    pruneExpiredSessions();

    const ttlMs = parsed.data.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;
    const jti = crypto.randomUUID();
    const provider = decoded.firebase?.sign_in_provider || 'password';
    const email = decoded.email || '';
    const emailVerified = Boolean(decoded.email_verified);

    activeSessions.set(jti, {
      uid: decoded.uid,
      email,
      emailVerified,
      provider,
      expiresAt,
    });

    const sessionToken = signPayload({
      typ: 'session',
      jti,
      uid: decoded.uid,
      email,
      emailVerified,
      provider,
      exp: expiresAt,
    });

    return res.status(200).json({
      verified: true,
      identity: {
        uid: decoded.uid,
        email,
        emailVerified,
        provider,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
      },
      sessionToken,
      expiresAt,
      rememberMe: parsed.data.rememberMe,
    });
  } catch {
    return res.status(401).json({
      error: 'Unable to verify Firebase authentication token. Please sign in again.',
    });
  }
}

authRouter.get('/config', (_req, res) => {
  return res.json(getServerFirebaseConfigSummary());
});

authRouter.post('/session', authSensitiveLimiter, handleSessionExchange);
authRouter.post('/firebase', authSensitiveLimiter, handleSessionExchange);

authRouter.get('/session', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({
    authenticated: true,
    user: req.authUser,
  });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({
    authenticated: true,
    user: req.authUser,
  });
});

authRouter.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    const parsed = verifySignedPayload<{ typ?: string; jti?: string; exp?: number }>(token);
    if (parsed?.typ === 'session' && parsed.jti) {
      activeSessions.delete(parsed.jti);
    }
  }
  return res.json({ ok: true });
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.').max(160),
});

authRouter.post('/forgot-password', authSensitiveLimiter, (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email address.' });
  }

  // Always return an identical uniform response without revealing account existence.
  return res.status(200).json({
    ok: true,
    message:
      'If an account matches that email address, password recovery instructions have been sent.',
  });
});

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128)
  .refine((val) => /[A-Z]/.test(val), 'Password must include an uppercase letter.')
  .refine((val) => /[a-z]/.test(val), 'Password must include a lowercase letter.')
  .refine((val) => /[0-9]/.test(val), 'Password must include a number.');

const resetValidateSchema = z
  .object({
    token: z.string().min(1).max(2048).optional(),
    oobCode: z.string().min(1).max(2048).optional(),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((d) => Boolean(d.token || d.oobCode), {
    message: 'Reset token or verification code is required.',
  });

authRouter.post('/reset-password/validate', authSensitiveLimiter, (req, res) => {
  const parsed = resetValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid password reset request.',
    });
  }

  if (parsed.data.token) {
    const check = validateResetTokenPayload(parsed.data.token);
    if (!check.valid || !check.jti) {
      return res.status(400).json({ error: check.error || 'Invalid or expired reset token.' });
    }
    usedResetTokenIds.add(check.jti);
    return res.status(200).json({
      valid: true,
      mode: 'server_token',
      email: check.email,
      message: 'Password reset token verified and consumed.',
    });
  }

  return res.status(200).json({
    valid: true,
    mode: 'firebase_oob',
    message: 'Password strength validated for Firebase reset completion.',
  });
});
