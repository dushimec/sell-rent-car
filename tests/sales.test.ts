import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { salesRouter } from '../src/server/routes/salesRoutes.ts';

test('sales inquiry validation API enforces purchase fields and generates SALE reference', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/sales', salesRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Reject missing phone and zero budget
    const invalidRes = await fetch(`${baseUrl}/api/sales/inquiries/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: 'v_gt_1',
        fullName: 'Jordan Vance',
        phone: '',
        preferredBudgetCents: 0,
        preferredPaymentMethod: 'BANK_FINANCING',
        purchaseTimeline: 'WITHIN_ONE_MONTH',
        needsFinancing: true,
      }),
    });
    assert.equal(invalidRes.status, 400);

    // Accept valid purchase requirements with optional email omitted
    const validRes = await fetch(`${baseUrl}/api/sales/inquiries/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: 'v_gt_1',
        fullName: 'Jordan Vance',
        phone: '+1 555 234 8910',
        email: '',
        preferredBudgetCents: 12500000,
        preferredPaymentMethod: 'BANK_FINANCING',
        purchaseTimeline: 'IMMEDIATELY',
        needsFinancing: true,
        preferredInspectionDate: '2026-12-15',
        message: 'Looking for full service history inspection.',
      }),
    });
    assert.equal(validRes.status, 200);
    const body = await validRes.json();
    assert.equal(body.valid, true);
    assert.match(body.inquiryReference, /^SALE-\d{4}-[0-9A-F]{6}$/);
    assert.equal(body.normalized.preferredBudgetCents, 12500000);
    assert.equal(body.normalized.needsFinancing, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
