import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../../utils/money.ts';
import { calculateRentalQuote } from '../../utils/rentalCalc.ts';
import { requireAuth, type AuthenticatedRequest } from './authRoutes.ts';

export const rentalsRouter = Router();

interface StoredRentalBookingRecord {
  id: string;
  bookingReference: string;
  customerId: string;
  vehicleId: string;
  fullName: string;
  phone: string;
  email: string;
  pickupLocation: string;
  returnLocation: string;
  pickupAt: string;
  returnAt: string;
  rentalMode: 'SELF_DRIVE' | 'CHAUFFEUR';
  additionalServices: string[];
  specialRequests: string;
  days: number;
  currency: string;
  dailyRateCents: number;
  chauffeurFeeCents: number;
  additionalServicesCents: number;
  totalAmountCents: number;
  requiredDepositCents: number;
  status: 'PENDING' | 'CANCELLED';
  createdAt: string;
}

const recentBookingKeys = new Map<string, number>();
const serverRentalBookings = new Map<string, StoredRentalBookingRecord>();

function checkAndRecordBookingIdempotency(scopeKey: string): boolean {
  const now = Date.now();
  for (const [k, expiresAt] of recentBookingKeys.entries()) {
    if (expiresAt <= now) recentBookingKeys.delete(k);
  }
  const existing = recentBookingKeys.get(scopeKey);
  if (existing && existing > now) {
    return false;
  }
  recentBookingKeys.set(scopeKey, now + 5 * 60 * 1000);
  return true;
}

const quoteSchema = z.object({
  pickupAt: z.string().min(8).max(40),
  returnAt: z.string().min(8).max(40),
  dailyRateCents: z.number().int().min(0),
  rentalMode: z.enum(['SELF_DRIVE', 'CHAUFFEUR']),
  chauffeurFeePerDayCents: z.number().int().min(0).default(0),
  depositPercent: z.number().int().min(0).max(100).default(25),
  additionalServices: z.array(z.string().max(40)).max(10).default([]),
  currency: z.string().trim().max(3).optional().default(DEFAULT_CURRENCY),
});

rentalsRouter.post('/quote', (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid rental quote parameters.',
      details: parsed.error.flatten(),
    });
  }

  const result = calculateRentalQuote(parsed.data);
  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    ...result,
    currency: normalizeCurrency(parsed.data.currency),
  });
});

const rentalBookingSchema = z.object({
  vehicleId: z.string().min(1).max(128),
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  phone: z.string().trim().min(4, 'Phone number is required.').max(40),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please provide a valid email address.',
    }),
  pickupLocation: z.string().trim().min(1, 'Pickup location is required.').max(120),
  returnLocation: z.string().trim().min(1, 'Return location is required.').max(120),
  pickupAt: z.string().min(8, 'Pickup date and time are required.').max(40),
  returnAt: z.string().min(8, 'Return date and time are required.').max(40),
  rentalMode: z.enum(['SELF_DRIVE', 'CHAUFFEUR']),
  additionalServices: z.array(z.string().max(40)).max(10).default([]),
  specialRequests: z.string().trim().max(1500).optional(),
  dailyRateCents: z.number().int().min(0),
  chauffeurFeePerDayCents: z.number().int().min(0).default(0),
  depositPercent: z.number().int().min(0).max(100).default(25),
  currency: z.string().trim().max(3).optional().default(DEFAULT_CURRENCY),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

function validateBookingPayload(body: unknown, res: Response, customerId?: string) {
  const parsed = rentalBookingSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid rental booking request.',
      details: parsed.error.flatten(),
    });
    return null;
  }

  if (parsed.data.idempotencyKey) {
    const scopeKey = `rent:${customerId || 'anon'}:${parsed.data.idempotencyKey}`;
    if (!checkAndRecordBookingIdempotency(scopeKey)) {
      res.status(409).json({
        error: 'Duplicate submission prevented. This rental booking request was already processed.',
      });
      return null;
    }
  }

  const quote = calculateRentalQuote({
    pickupAt: parsed.data.pickupAt,
    returnAt: parsed.data.returnAt,
    dailyRateCents: parsed.data.dailyRateCents,
    rentalMode: parsed.data.rentalMode,
    chauffeurFeePerDayCents: parsed.data.chauffeurFeePerDayCents,
    depositPercent: parsed.data.depositPercent,
    additionalServices: parsed.data.additionalServices,
  });

  if (!quote.valid) {
    res.status(400).json({ error: quote.error });
    return null;
  }

  const bookingReference = `RENT-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

  return {
    bookingReference,
    quote,
    normalized: {
      vehicleId: parsed.data.vehicleId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || '',
      pickupLocation: parsed.data.pickupLocation,
      returnLocation: parsed.data.returnLocation,
      pickupAt: parsed.data.pickupAt,
      returnAt: parsed.data.returnAt,
      rentalMode: parsed.data.rentalMode,
      additionalServices: parsed.data.additionalServices,
      specialRequests: parsed.data.specialRequests || '',
      currency: normalizeCurrency(parsed.data.currency),
    },
  };
}

rentalsRouter.post('/bookings/validate', (req, res) => {
  const result = validateBookingPayload(req.body, res);
  if (!result) return;
  return res.status(200).json({
    valid: true,
    ...result,
  });
});

// Dedicated authenticated Rental Booking API module
export const rentalBookingsApiRouter = Router();

rentalBookingsApiRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });

  const result = validateBookingPayload(req.body, res, uid);
  if (!result) return;

  const id = crypto.randomUUID();
  const record: StoredRentalBookingRecord = {
    id,
    bookingReference: result.bookingReference,
    customerId: uid,
    ...result.normalized,
    days: result.quote.days,
    dailyRateCents: result.quote.dailyRateCents,
    chauffeurFeeCents: result.quote.chauffeurFeeCents,
    additionalServicesCents: result.quote.additionalServicesCents,
    totalAmountCents: result.quote.totalAmountCents,
    requiredDepositCents: result.quote.requiredDepositCents,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  serverRentalBookings.set(id, record);

  return res.status(201).json({
    valid: true,
    id,
    bookingReference: result.bookingReference,
    quote: result.quote,
    normalized: result.normalized,
    booking: record,
  });
});

rentalBookingsApiRouter.get('/my', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const list = Array.from(serverRentalBookings.values()).filter((b) => b.customerId === uid);
  return res.json({ bookings: list });
});

rentalBookingsApiRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const item = serverRentalBookings.get(String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Rental booking not found.' });
  if (item.customerId !== uid) {
    return res.status(403).json({ error: 'Access denied. You may only inspect your own bookings.' });
  }
  return res.json({ booking: item });
});

rentalBookingsApiRouter.post('/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const item = serverRentalBookings.get(String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Rental booking not found.' });
  if (item.customerId !== uid) {
    return res.status(403).json({ error: 'Access denied. You may only cancel your own pending bookings.' });
  }
  if (item.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending rental requests can be cancelled.' });
  }
  item.status = 'CANCELLED';
  return res.json({ ok: true, booking: item });
});
