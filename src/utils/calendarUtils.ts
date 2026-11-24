import type { RentalBooking, Vehicle } from '../types/autosuite';
import { hasDateRangeOverlap } from './rentalCalc';

export interface CalendarDayCell {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateKey(raw: string): string {
  if (!raw) return '';
  // Fast-path YYYY-MM-DD or YYYY-MM-DDTHH:mm
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : toDateKey(d);
}

/**
 * Generates a 42-day (6-week Mon-Sun) matrix for the given year & 0-indexed month.
 */
export function getMonthGridDays(year: number, month: number, today = new Date()): CalendarDayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  // Convert Sun=0..Sat=6 to Mon=0..Sun=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = toDateKey(today);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = toDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayOfMonth: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
      isToday: key === todayKey,
    });
  }
  return cells;
}

/**
 * Enumerates every YYYY-MM-DD day key inside the target month.
 */
export function getDaysInMonth(year: number, month: number, today = new Date()): CalendarDayCell[] {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(today);
  const cells: CalendarDayCell[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const key = toDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayOfMonth: day,
      inCurrentMonth: true,
      isToday: key === todayKey,
    });
  }
  return cells;
}

/**
 * Determines whether a booking occupies a specific calendar date (YYYY-MM-DD).
 * Inclusive of pickup and return calendar days so handover/turnaround days stay visible.
 */
export function bookingCoversDateKey(booking: RentalBooking, dateKey: string): boolean {
  const startKey = parseIsoDateKey(booking.pickupAt);
  const endKey = parseIsoDateKey(booking.returnAt);
  if (!startKey || !endKey) return false;
  return dateKey >= startKey && dateKey <= endKey;
}

/**
 * Returns booking IDs that conflict with locked (CONFIRMED or ACTIVE) bookings
 * for the same vehicle using exact timestamp overlap detection.
 */
export function findBookingConflictIds(bookings: RentalBooking[]): Set<string> {
  const conflictIds = new Set<string>();
  const locked = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE');

  for (const candidate of bookings) {
    if (candidate.status === 'CANCELLED' || candidate.status === 'REJECTED' || candidate.status === 'COMPLETED') {
      continue;
    }
    const sameVehicleLockedSlots = locked
      .filter((l) => l.vehicleId === candidate.vehicleId && l.id !== candidate.id)
      .map((l) => ({
        bookingId: l.id,
        pickupAt: l.pickupAt,
        returnAt: l.returnAt,
      }));

    if (
      sameVehicleLockedSlots.length > 0 &&
      hasDateRangeOverlap(candidate.pickupAt, candidate.returnAt, sameVehicleLockedSlots, candidate.id)
    ) {
      conflictIds.add(candidate.id);
    }
  }

  return conflictIds;
}

export function getRentalFleetVehicles(vehicles: Vehicle[], bookings: RentalBooking[]): Vehicle[] {
  const rentalFromCatalog = vehicles.filter(
    (v) => !v.archived && (v.listingType === 'RENTAL' || v.listingType === 'BOTH')
  );
  const knownIds = new Set(rentalFromCatalog.map((v) => v.id));

  // Include any vehicle referenced by existing bookings even if catalog listing changed
  const fallbackVehicles: Vehicle[] = [];
  for (const b of bookings) {
    if (!knownIds.has(b.vehicleId)) {
      knownIds.add(b.vehicleId);
      const fromCatalog = vehicles.find((v) => v.id === b.vehicleId);
      if (fromCatalog) {
        fallbackVehicles.push(fromCatalog);
      } else {
        fallbackVehicles.push({
          id: b.vehicleId,
          name: b.vehicleName,
          brand: '',
          model: '',
          year: new Date().getFullYear(),
          category: 'Rental',
          listingType: 'RENTAL',
          mileageKm: 0,
          transmission: 'Automatic',
          fuelType: 'Petrol',
          engineCapacity: '',
          color: '',
          seats: 5,
          description: '',
          features: [],
          images: [],
          mainImage: '',
          salePriceCents: 0,
          rentalPricePerDayCents: b.dailyRateCents,
          chauffeurAvailable: false,
          available: true,
          published: true,
          archived: false,
          featured: false,
          location: b.pickupLocation,
        });
      }
    }
  }

  return [...rentalFromCatalog, ...fallbackVehicles];
}
