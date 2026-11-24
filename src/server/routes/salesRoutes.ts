import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../../utils/money.ts';
import { requireAuth, type AuthenticatedRequest } from './authRoutes.ts';

export const salesRouter = Router();

interface StoredSaleInquiryRecord {
  id: string;
  inquiryReference: string;
  customerId: string;
  vehicleId: string;
  fullName: string;
  phone: string;
  email: string;
  preferredBudgetCents: number;
  currency: string;
  preferredPaymentMethod: 'CASH' | 'BANK_FINANCING' | 'OTHER';
  purchaseTimeline: 'IMMEDIATELY' | 'WITHIN_ONE_MONTH' | 'WITHIN_THREE_MONTHS' | 'LATER';
  needsFinancing: boolean;
  preferredInspectionDate: string;
  message: string;
  status: 'NEW';
  createdAt: string;
}

const recentIdempotencyKeys = new Map<string, number>();
const serverSaleInquiries = new Map<string, StoredSaleInquiryRecord>();

function checkAndRecordIdempotency(scopeKey: string): boolean {
  const now = Date.now();
  for (const [k, expiresAt] of recentIdempotencyKeys.entries()) {
    if (expiresAt <= now) recentIdempotencyKeys.delete(k);
  }
  const existing = recentIdempotencyKeys.get(scopeKey);
  if (existing && existing > now) {
    return false;
  }
  recentIdempotencyKeys.set(scopeKey, now + 5 * 60 * 1000);
  return true;
}

const purchaseInquirySchema = z.object({
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
  preferredBudgetCents: z.number().int().positive('Preferred purchase budget is required.'),
  currency: z.string().trim().max(3).optional().default(DEFAULT_CURRENCY),
  preferredPaymentMethod: z.enum(['CASH', 'BANK_FINANCING', 'OTHER']),
  purchaseTimeline: z.enum([
    'IMMEDIATELY',
    'WITHIN_ONE_MONTH',
    'WITHIN_THREE_MONTHS',
    'LATER',
  ]),
  needsFinancing: z.boolean(),
  preferredInspectionDate: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

function validatePurchasePayload(body: unknown, res: Response, customerId?: string) {
  const parsed = purchaseInquirySchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid purchase requirements submission.',
      details: parsed.error.flatten(),
    });
    return null;
  }

  if (parsed.data.idempotencyKey) {
    const scopeKey = `sale:${customerId || 'anon'}:${parsed.data.idempotencyKey}`;
    if (!checkAndRecordIdempotency(scopeKey)) {
      res.status(409).json({
        error: 'Duplicate submission prevented. This purchase inquiry has already been processed.',
      });
      return null;
    }
  }

  const inquiryReference = `SALE-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

  return {
    inquiryReference,
    normalized: {
      vehicleId: parsed.data.vehicleId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || '',
      preferredBudgetCents: parsed.data.preferredBudgetCents,
      currency: normalizeCurrency(parsed.data.currency),
      preferredPaymentMethod: parsed.data.preferredPaymentMethod,
      purchaseTimeline: parsed.data.purchaseTimeline,
      needsFinancing: parsed.data.needsFinancing,
      preferredInspectionDate: parsed.data.preferredInspectionDate || '',
      message: parsed.data.message || '',
    },
  };
}

salesRouter.post('/inquiries/validate', (req, res) => {
  const result = validatePurchasePayload(req.body, res);
  if (!result) return;
  return res.status(200).json({
    valid: true,
    ...result,
  });
});

// Dedicated authenticated Car Sales Inquiry API module
export const salesInquiriesApiRouter = Router();

salesInquiriesApiRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });

  const result = validatePurchasePayload(req.body, res, uid);
  if (!result) return;

  const id = crypto.randomUUID();
  const record: StoredSaleInquiryRecord = {
    id,
    inquiryReference: result.inquiryReference,
    customerId: uid,
    ...result.normalized,
    status: 'NEW',
    createdAt: new Date().toISOString(),
  };
  serverSaleInquiries.set(id, record);

  return res.status(201).json({
    valid: true,
    id,
    inquiryReference: result.inquiryReference,
    normalized: result.normalized,
    inquiry: record,
  });
});

salesInquiriesApiRouter.get('/my', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const list = Array.from(serverSaleInquiries.values()).filter((i) => i.customerId === uid);
  return res.json({ inquiries: list });
});

salesInquiriesApiRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });
  const item = serverSaleInquiries.get(String(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Purchase inquiry not found.' });
  }
  if (item.customerId !== uid) {
    return res.status(403).json({ error: 'Access denied. You may only inspect your own purchase inquiries.' });
  }
  return res.json({ inquiry: item });
});
