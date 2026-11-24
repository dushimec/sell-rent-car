import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import {
  authRouter,
  createSessionTokenForTest,
} from '../src/server/routes/authRoutes.ts';
import {
  customerRouter,
  favoritesRouter,
  notificationsRouter,
} from '../src/server/routes/customerRoutes.ts';
import { salesInquiriesApiRouter } from '../src/server/routes/salesRoutes.ts';
import { rentalBookingsApiRouter } from '../src/server/routes/rentalsRoutes.ts';

async function withCustomerServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/sales-inquiries', salesInquiriesApiRouter);
  app.use('/api/rental-bookings', rentalBookingsApiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

test('protected customer, sales inquiry, and rental booking endpoints reject unauthenticated requests with 401', async () => {
  await withCustomerServer(async (baseUrl) => {
    const endpoints: Array<[string, string]> = [
      ['GET', '/api/auth/me'],
      ['GET', '/api/customer/profile'],
      ['PATCH', '/api/customer/profile'],
      ['GET', '/api/customer/dashboard'],
      ['GET', '/api/customer/payments'],
      ['GET', '/api/favorites'],
      ['POST', '/api/favorites'],
      ['GET', '/api/notifications'],
      ['POST', '/api/sales-inquiries'],
      ['GET', '/api/sales-inquiries/my'],
      ['POST', '/api/rental-bookings'],
      ['GET', '/api/rental-bookings/my'],
    ];

    for (const [method, path] of endpoints) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' || method === 'PATCH' ? '{}' : undefined,
      });
      assert.equal(res.status, 401, `Expected 401 on ${method} ${path}, got ${res.status}`);
    }
  });
});

test('customer profile endpoint enforces strict schema and rejects privilege escalation with 403', async () => {
  await withCustomerServer(async (baseUrl) => {
    const token = createSessionTokenForTest('cust-1', 'buyer@example.com');

    const escalationRes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fullName: 'Buyer One', role: 'SUPER_ADMIN' }),
    });
    assert.equal(escalationRes.status, 403);

    const updateRes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: 'Buyer One',
        phone: '+250788000100',
        address: 'KG 7 Ave, Kigali',
      }),
    });
    assert.equal(updateRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.status, 200);
    const data = await getRes.json();
    assert.equal(data.profile.fullName, 'Buyer One');
    assert.equal(data.profile.role, 'CUSTOMER');
  });
});

test('sales inquiry API prevents duplicate submissions (409) and enforces ownership isolation (403)', async () => {
  await withCustomerServer(async (baseUrl) => {
    const ownerToken = createSessionTokenForTest('cust-owner', 'owner@example.com');
    const otherToken = createSessionTokenForTest('cust-other', 'other@example.com');

    const payload = {
      vehicleId: 'veh-s580-exec',
      fullName: 'Alice Buyer',
      phone: '+250788111222',
      email: 'owner@example.com',
      preferredBudgetCents: 14500000000,
      preferredPaymentMethod: 'CASH',
      purchaseTimeline: 'WITHIN_ONE_MONTH',
      needsFinancing: false,
      idempotencyKey: 'idem-sale-key-001',
    };

    const first = await fetch(`${baseUrl}/api/sales-inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 201);
    const created = await first.json();
    assert.ok(created.inquiryReference.startsWith('SALE-'));
    assert.equal(created.inquiry.currency, 'RWF');

    // Duplicate retry with same idempotencyKey blocked with 409
    const duplicate = await fetch(`${baseUrl}/api/sales-inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(duplicate.status, 409);

    // Other user cannot inspect owner's inquiry
    const forbidden = await fetch(`${baseUrl}/api/sales-inquiries/${created.id}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(forbidden.status, 403);
  });
});

test('rental booking API computes RWF quote, blocks duplicates (409), and restricts cancellation to owner', async () => {
  await withCustomerServer(async (baseUrl) => {
    const renterToken = createSessionTokenForTest('cust-renter', 'renter@example.com');
    const otherToken = createSessionTokenForTest('cust-stranger', 'stranger@example.com');

    const payload = {
      vehicleId: 'veh-s580-exec',
      fullName: 'Jean Renter',
      phone: '+250788333444',
      email: 'renter@example.com',
      pickupLocation: 'Main Showroom — Kigali Downtown',
      returnLocation: 'Kigali International Airport',
      pickupAt: '2026-12-01T10:00',
      returnAt: '2026-12-04T10:00',
      rentalMode: 'SELF_DRIVE',
      additionalServices: ['GPS_NAV'],
      dailyRateCents: 48000000,
      chauffeurFeePerDayCents: 6000000,
      depositPercent: 25,
      idempotencyKey: 'idem-rent-key-001',
    };

    const first = await fetch(`${baseUrl}/api/rental-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${renterToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 201);
    const created = await first.json();
    assert.ok(created.bookingReference.startsWith('RENT-'));
    assert.equal(created.booking.currency, 'RWF');
    assert.equal(created.quote.days, 3);
    assert.equal(created.quote.totalAmountCents, 3 * (48000000 + 1500000));

    // Duplicate retry blocked
    const dup = await fetch(`${baseUrl}/api/rental-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${renterToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(dup.status, 409);

    // Other user cannot cancel
    const forbiddenCancel = await fetch(`${baseUrl}/api/rental-bookings/${created.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(forbiddenCancel.status, 403);

    // Owner can cancel while PENDING
    const okCancel = await fetch(`${baseUrl}/api/rental-bookings/${created.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${renterToken}` },
    });
    assert.equal(okCancel.status, 200);
  });
});

test('favorites and notifications APIs store per-user state when authenticated', async () => {
  await withCustomerServer(async (baseUrl) => {
    const token = createSessionTokenForTest('cust-fav', 'fav@example.com');

    const addFav = await fetch(`${baseUrl}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vehicleId: 'veh-etron-gt' }),
    });
    assert.equal(addFav.status, 201);

    const listFav = await fetch(`${baseUrl}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listFav.json();
    assert.deepEqual(listData.vehicleIds, ['veh-etron-gt']);

    const readNotif = await fetch(`${baseUrl}/api/notifications/notif-1/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(readNotif.status, 200);
  });
});
