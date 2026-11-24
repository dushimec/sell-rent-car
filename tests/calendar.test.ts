import assert from 'node:assert/strict';
import test from 'node:test';
import type { RentalBooking, Vehicle } from '../src/types/autosuite.ts';
import {
  bookingCoversDateKey,
  findBookingConflictIds,
  getDaysInMonth,
  getMonthGridDays,
  getRentalFleetVehicles,
  parseIsoDateKey,
  toDateKey,
} from '../src/utils/calendarUtils.ts';

function makeBooking(overrides: Partial<RentalBooking>): RentalBooking {
  return {
    id: 'b-default',
    bookingReference: 'RENT-2026-000001',
    customerId: 'cust-1',
    vehicleId: 'v1',
    vehicleName: '2026 Toyota Land Cruiser',
    customerName: 'Alex Morgan',
    customerPhone: '+250788000111',
    customerEmail: 'alex@example.com',
    pickupLocation: 'Kigali Showroom',
    returnLocation: 'Kigali Showroom',
    pickupAt: '2026-12-10T09:00',
    returnAt: '2026-12-13T18:00',
    rentalMode: 'SELF_DRIVE',
    additionalServices: [],
    days: 4,
    currency: 'RWF',
    dailyRateCents: 15000000,
    chauffeurFeeCents: 0,
    additionalServicesCents: 0,
    totalAmountCents: 60000000,
    requiredDepositCents: 15000000,
    paidAmountCents: 0,
    status: 'CONFIRMED',
    createdAt: '2026-12-01T10:00:00Z',
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'v1',
    name: '2026 Toyota Land Cruiser',
    brand: 'Toyota',
    model: 'Land Cruiser',
    year: 2026,
    category: 'SUV',
    listingType: 'RENTAL',
    mileageKm: 1200,
    transmission: 'Automatic',
    fuelType: 'Diesel',
    engineCapacity: '3.3L V6',
    color: 'Obsidian Black',
    seats: 7,
    description: 'Executive SUV',
    features: [],
    images: [],
    mainImage: '',
    salePriceCents: 0,
    rentalPricePerDayCents: 15000000,
    chauffeurAvailable: true,
    available: true,
    published: true,
    archived: false,
    featured: true,
    location: 'Kigali',
    ...overrides,
  };
}

test('date formatting and 42-day Mon-Sun month grid generation', () => {
  const sampleDate = new Date(2026, 11, 15); // Dec 15, 2026
  assert.equal(toDateKey(sampleDate), '2026-12-15');
  assert.equal(parseIsoDateKey('2026-12-15T10:30:00Z'), '2026-12-15');
  assert.equal(parseIsoDateKey('invalid-date'), '');

  const grid = getMonthGridDays(2026, 11, sampleDate);
  assert.equal(grid.length, 42);
  // Dec 1, 2026 is a Tuesday, so Monday Nov 30 is cell 0
  assert.equal(grid[0].dateKey, '2026-11-30');
  assert.equal(grid[0].inCurrentMonth, false);
  assert.equal(grid[1].dateKey, '2026-12-01');
  assert.equal(grid[1].inCurrentMonth, true);

  const todayCell = grid.find((c) => c.dateKey === '2026-12-15');
  assert.ok(todayCell);
  assert.equal(todayCell.isToday, true);

  const monthDays = getDaysInMonth(2026, 11, sampleDate);
  assert.equal(monthDays.length, 31);
  assert.equal(monthDays[0].dateKey, '2026-12-01');
  assert.equal(monthDays[30].dateKey, '2026-12-31');
});

test('bookingCoversDateKey highlights full pickup-through-return date range', () => {
  const booking = makeBooking({
    pickupAt: '2026-12-10T09:00',
    returnAt: '2026-12-13T18:00',
  });

  assert.equal(bookingCoversDateKey(booking, '2026-12-09'), false);
  assert.equal(bookingCoversDateKey(booking, '2026-12-10'), true);
  assert.equal(bookingCoversDateKey(booking, '2026-12-11'), true);
  assert.equal(bookingCoversDateKey(booking, '2026-12-13'), true);
  assert.equal(bookingCoversDateKey(booking, '2026-12-14'), false);
});

test('findBookingConflictIds flags overlapping pending/locked bookings on the same vehicle only', () => {
  const bookings: RentalBooking[] = [
    // Locked CONFIRMED booking on v1: Dec 10 09:00 -> Dec 13 18:00
    makeBooking({
      id: 'locked-v1',
      vehicleId: 'v1',
      status: 'CONFIRMED',
      pickupAt: '2026-12-10T09:00',
      returnAt: '2026-12-13T18:00',
    }),
    // Overlapping PENDING request on v1: Dec 12 09:00 -> Dec 15 18:00 -> SHOULD CONFLICT
    makeBooking({
      id: 'pending-overlap-v1',
      vehicleId: 'v1',
      status: 'PENDING',
      pickupAt: '2026-12-12T09:00',
      returnAt: '2026-12-15T18:00',
    }),
    // Back-to-back exact boundary PENDING request on v1: Dec 13 18:00 -> Dec 16 10:00 -> NO CONFLICT
    makeBooking({
      id: 'pending-clean-v1',
      vehicleId: 'v1',
      status: 'PENDING',
      pickupAt: '2026-12-13T18:00',
      returnAt: '2026-12-16T10:00',
    }),
    // Same overlapping dates on DIFFERENT vehicle v2 -> NO CONFLICT
    makeBooking({
      id: 'confirmed-v2',
      vehicleId: 'v2',
      status: 'ACTIVE',
      pickupAt: '2026-12-11T09:00',
      returnAt: '2026-12-14T18:00',
    }),
    // Cancelled/rejected overlapping bookings on v1 -> IGNORED (no false positive)
    makeBooking({
      id: 'cancelled-v1',
      vehicleId: 'v1',
      status: 'CANCELLED',
      pickupAt: '2026-12-10T09:00',
      returnAt: '2026-12-13T18:00',
    }),
    makeBooking({
      id: 'rejected-v1',
      vehicleId: 'v1',
      status: 'REJECTED',
      pickupAt: '2026-12-11T09:00',
      returnAt: '2026-12-12T18:00',
    }),
  ];

  const conflicts = findBookingConflictIds(bookings);
  assert.equal(conflicts.has('locked-v1'), false);
  assert.equal(conflicts.has('pending-overlap-v1'), true);
  assert.equal(conflicts.has('pending-clean-v1'), false);
  assert.equal(conflicts.has('confirmed-v2'), false);
  assert.equal(conflicts.has('cancelled-v1'), false);
  assert.equal(conflicts.has('rejected-v1'), false);
});

test('getRentalFleetVehicles filters rental/both non-archived catalog and preserves booking fallbacks', () => {
  const vehicles: Vehicle[] = [
    makeVehicle({ id: 'v1', name: 'Land Cruiser', listingType: 'RENTAL', archived: false }),
    makeVehicle({ id: 'v2', name: 'Range Rover', listingType: 'BOTH', archived: false }),
    makeVehicle({ id: 'v3', name: 'Sale Only Sedan', listingType: 'SALE', archived: false }),
    makeVehicle({ id: 'v4', name: 'Archived SUV', listingType: 'RENTAL', archived: true }),
  ];

  const bookings: RentalBooking[] = [
    makeBooking({ id: 'b-legacy', vehicleId: 'v-legacy', vehicleName: '2024 Legacy Prado' }),
  ];

  const fleet = getRentalFleetVehicles(vehicles, bookings);
  const ids = fleet.map((v) => v.id);
  assert.deepEqual(ids, ['v1', 'v2', 'v-legacy']);
});
