import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { rentalsRouter } from '../src/server/routes/rentalsRoutes.ts';
import { amountToCents, formatCurrency, formatMoney } from '../src/utils/money.ts';
import { calculateRentalQuote, hasDateRangeOverlap } from '../src/utils/rentalCalc.ts';

test('centralized RWF currency formatting and Decimal/minor-unit parsing', () => {
  assert.equal(amountToCents('450000'), 45000000);
  assert.equal(amountToCents('150,000'), 15000000);
  assert.equal(amountToCents('1299.95'), 129995);
  assert.equal(formatCurrency(150000), 'RWF 150,000');
  assert.equal(formatCurrency('1500000', 'RWF'), 'RWF 1,500,000');
  assert.equal(formatCurrency({ toNumber: () => 250000 }, 'RWF'), 'RWF 250,000');
  assert.equal(formatMoney(45000000), 'RWF 450,000');
  assert.equal(formatMoney(45000000, ''), 'RWF 450,000');
  // Historical non-RWF currency records never display '$' and never silently relabel as RWF
  assert.equal(formatMoney(129995, 'USD'), 'USD 1,299.95');
});

test('rental quote calculation prevents invalid dates and computes chauffeur, add-ons, and deposit accurately', () => {
  const invalid = calculateRentalQuote({
    pickupAt: '2026-12-10T10:00',
    returnAt: '2026-12-09T10:00',
    dailyRateCents: 50000,
    rentalMode: 'SELF_DRIVE',
    chauffeurFeePerDayCents: 12000,
    depositPercent: 25,
  });
  assert.equal(invalid.valid, false);

  const valid = calculateRentalQuote({
    pickupAt: '2026-12-10T10:00',
    returnAt: '2026-12-13T10:00',
    dailyRateCents: 50000000,
    rentalMode: 'CHAUFFEUR',
    chauffeurFeePerDayCents: 6000000,
    depositPercent: 25,
    additionalServices: ['GPS_NAV', 'AIRPORT_MEET'],
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.days, 3);
  assert.equal(valid.baseRentalCents, 150000000);
  assert.equal(valid.chauffeurFeeCents, 18000000);
  // GPS_NAV (15,000 RWF/day) + AIRPORT_MEET (35,000 RWF/day) = 50,000 RWF/day * 3 days = 150,000 RWF (15,000,000 cents)
  assert.equal(valid.additionalServicesCents, 15000000);
  assert.equal(valid.totalAmountCents, 183000000);
  assert.equal(valid.requiredDepositCents, 45750000);
});

test('overlapping confirmed booking detection', () => {
  const slots = [
    {
      bookingId: 'b1',
      pickupAt: '2026-12-10T10:00',
      returnAt: '2026-12-14T10:00',
    },
  ];

  // Overlapping interior range
  assert.equal(hasDateRangeOverlap('2026-12-12T10:00', '2026-12-15T10:00', slots), true);
  // Exact boundary after return is allowed
  assert.equal(hasDateRangeOverlap('2026-12-14T10:00', '2026-12-16T10:00', slots), false);
  // Same booking ID excluded during re-validation
  assert.equal(hasDateRangeOverlap('2026-12-12T10:00', '2026-12-15T10:00', slots, 'b1'), false);
});

test('rentals validation API generates RENT reference and rejects missing required fields', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/rentals', rentalsRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const badRes = await fetch(`${baseUrl}/api/rentals/bookings/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: 'v1',
        fullName: 'A',
        phone: '',
        pickupLocation: 'Main Showroom',
        returnLocation: 'Main Showroom',
        pickupAt: '2026-12-10T10:00',
        returnAt: '2026-12-12T10:00',
        rentalMode: 'SELF_DRIVE',
        dailyRateCents: 40000,
      }),
    });
    assert.equal(badRes.status, 400);

    const okRes = await fetch(`${baseUrl}/api/rentals/bookings/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: 'v1',
        fullName: 'Alex Morgan',
        phone: '+1 555 0194',
        email: '',
        pickupLocation: 'Main Showroom',
        returnLocation: 'Airport VIP Terminal',
        pickupAt: '2026-12-10T10:00',
        returnAt: '2026-12-12T10:00',
        rentalMode: 'SELF_DRIVE',
        additionalServices: ['GPS_NAV'],
        dailyRateCents: 40000000,
        chauffeurFeePerDayCents: 6000000,
        depositPercent: 25,
      }),
    });
    assert.equal(okRes.status, 200);
    const data = await okRes.json();
    assert.equal(data.valid, true);
    assert.match(data.bookingReference, /^RENT-\d{4}-[0-9A-F]{6}$/);
    assert.equal(data.normalized.currency, 'RWF');
    assert.equal(data.quote.days, 2);
    assert.equal(data.quote.additionalServicesCents, 3000000);
    assert.equal(data.quote.totalAmountCents, 83000000);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
