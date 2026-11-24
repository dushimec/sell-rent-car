import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from './authRoutes.ts';

export const customerRouter = Router();

interface CustomerProfilePatch {
  fullName?: string;
  phone?: string;
  address?: string;
  driverLicenseNo?: string;
  updatedAt: string;
}

const customerOverrides = new Map<string, CustomerProfilePatch>();
const userFavorites = new Map<string, Set<string>>();

const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(200).optional(),
    driverLicenseNo: z.string().trim().max(60).optional(),
  })
  .strict();

customerRouter.get('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const patch = customerOverrides.get(user.uid);
  return res.json({
    profile: {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      role: 'CUSTOMER',
      fullName: patch?.fullName || user.name || '',
      phone: patch?.phone || '',
      address: patch?.address || '',
      driverLicenseNo: patch?.driverLicenseNo || '',
      updatedAt: patch?.updatedAt || null,
    },
  });
});

customerRouter.patch('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const rawBody = req.body as Record<string, unknown> | undefined;
  if (rawBody && ('role' in rawBody || 'permissions' in rawBody || 'active' in rawBody)) {
    return res.status(403).json({
      error: 'Privilege escalation denied. Customers cannot modify roles or permissions.',
    });
  }

  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid profile fields.',
    });
  }

  const prev = customerOverrides.get(user.uid) || { updatedAt: new Date().toISOString() };
  const next: CustomerProfilePatch = {
    ...prev,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  customerOverrides.set(user.uid, next);

  return res.json({
    ok: true,
    profile: {
      uid: user.uid,
      email: user.email,
      role: 'CUSTOMER',
      ...next,
    },
  });
});

customerRouter.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  return res.json({
    uid: user.uid,
    email: user.email,
    currency: 'RWF',
    authorized: true,
  });
});

customerRouter.get('/payments', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  return res.json({
    customerId: user.uid,
    currency: 'RWF',
    payments: [],
  });
});

export const favoritesRouter = Router();

favoritesRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  return res.json({ vehicleIds: Array.from(userFavorites.get(uid) || []) });
});

favoritesRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const parsed = z.object({ vehicleId: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid vehicleId is required.' });
  }
  const set = userFavorites.get(uid) || new Set<string>();
  set.add(parsed.data.vehicleId);
  userFavorites.set(uid, set);
  return res.status(201).json({ vehicleId: parsed.data.vehicleId, saved: true });
});

favoritesRouter.delete('/:vehicleId', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const set = userFavorites.get(uid);
  set?.delete(String(req.params.vehicleId));
  return res.json({ vehicleId: String(req.params.vehicleId), saved: false });
});

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  return res.json({ customerId: uid, notifications: [] });
});

notificationsRouter.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  return res.json({ id: String(req.params.id), read: true });
});
