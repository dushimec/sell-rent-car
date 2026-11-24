import type { RentalMode, ScheduleSlot } from '../types/autosuite';

export interface RentalAddonCatalogItem {
  id: string;
  label: string;
  perDayCents: number;
}

export const RENTAL_ADDONS: RentalAddonCatalogItem[] = [
  { id: 'GPS_NAV', label: 'Satellite Navigation Unit', perDayCents: 1500000 },
  { id: 'CHILD_SEAT', label: 'Executive Child Safety Seat', perDayCents: 1200000 },
  { id: 'AIRPORT_MEET', label: 'Airport VIP Meet & Greet', perDayCents: 3500000 },
  { id: 'EXTRA_DRIVER', label: 'Additional Authorized Driver', perDayCents: 2000000 },
];

export interface RentalCalculationResult {
  valid: boolean;
  error?: string;
  days: number;
  dailyRateCents: number;
  chauffeurFeeCents: number;
  additionalServicesCents: number;
  baseRentalCents: number;
  totalAmountCents: number;
  requiredDepositCents: number;
}

export function calculateRentalQuote(params: {
  pickupAt: string;
  returnAt: string;
  dailyRateCents: number;
  rentalMode: RentalMode;
  chauffeurFeePerDayCents: number;
  depositPercent: number;
  additionalServices?: string[];
}): RentalCalculationResult {
  const startMs = Date.parse(params.pickupAt);
  const endMs = Date.parse(params.returnAt);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return {
      valid: false,
      error: 'Please provide valid pickup and return dates.',
      days: 0,
      dailyRateCents: 0,
      chauffeurFeeCents: 0,
      additionalServicesCents: 0,
      baseRentalCents: 0,
      totalAmountCents: 0,
      requiredDepositCents: 0,
    };
  }

  if (endMs <= startMs) {
    return {
      valid: false,
      error: 'Return date and time must be after pickup date and time.',
      days: 0,
      dailyRateCents: 0,
      chauffeurFeeCents: 0,
      additionalServicesCents: 0,
      baseRentalCents: 0,
      totalAmountCents: 0,
      requiredDepositCents: 0,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.ceil((endMs - startMs) / msPerDay));

  if (days > 365) {
    return {
      valid: false,
      error: 'Maximum single rental duration is 365 days.',
      days: 0,
      dailyRateCents: 0,
      chauffeurFeeCents: 0,
      additionalServicesCents: 0,
      baseRentalCents: 0,
      totalAmountCents: 0,
      requiredDepositCents: 0,
    };
  }

  const dailyRateCents = Math.max(0, Math.round(params.dailyRateCents));
  const baseRentalCents = days * dailyRateCents;
  const chauffeurPerDay =
    params.rentalMode === 'CHAUFFEUR' ? Math.max(0, Math.round(params.chauffeurFeePerDayCents)) : 0;
  const chauffeurFeeCents = days * chauffeurPerDay;

  const selectedIds = new Set(params.additionalServices || []);
  const addonsPerDayCents = RENTAL_ADDONS.filter((a) => selectedIds.has(a.id)).reduce(
    (sum, a) => sum + a.perDayCents,
    0
  );
  const additionalServicesCents = days * addonsPerDayCents;

  const totalAmountCents = baseRentalCents + chauffeurFeeCents + additionalServicesCents;
  const safeDepositPct = Math.min(100, Math.max(0, Math.round(params.depositPercent)));
  const requiredDepositCents = Math.round((totalAmountCents * safeDepositPct) / 100);

  return {
    valid: true,
    days,
    dailyRateCents,
    chauffeurFeeCents,
    additionalServicesCents,
    baseRentalCents,
    totalAmountCents,
    requiredDepositCents,
  };
}

/**
 * Checks whether [pickupAt, returnAt) overlaps any existing confirmed/active slot.
 */
export function hasDateRangeOverlap(
  pickupAt: string,
  returnAt: string,
  slots: ScheduleSlot[],
  excludeBookingId?: string
): boolean {
  const startA = Date.parse(pickupAt);
  const endA = Date.parse(returnAt);
  if (Number.isNaN(startA) || Number.isNaN(endA)) return true;

  return slots.some((slot) => {
    if (excludeBookingId && slot.bookingId === excludeBookingId) return false;
    const startB = Date.parse(slot.pickupAt);
    const endB = Date.parse(slot.returnAt);
    if (Number.isNaN(startB) || Number.isNaN(endB)) return false;
    return startA < endB && endA > startB;
  });
}
