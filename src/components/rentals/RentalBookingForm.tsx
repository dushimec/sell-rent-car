import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, CalendarCheck, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { submitRentalBooking } from '../../services/rentalService';
import type {
  BusinessSetting,
  RentalMode,
  ScheduleSlot,
  Vehicle,
} from '../../types/autosuite';
import { formatMoney } from '../../utils/money';
import {
  calculateRentalQuote,
  hasDateRangeOverlap,
  RENTAL_ADDONS,
  type RentalCalculationResult,
} from '../../utils/rentalCalc';

const rentalSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  phone: z.string().trim().min(4, 'Phone number is required.'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
  pickupAt: z.string().min(8, 'Pickup date and time are required.'),
  returnAt: z.string().min(8, 'Return date and time are required.'),
  pickupLocation: z.string().min(1, 'Pickup location is required.'),
  returnLocation: z.string().min(1, 'Return location is required.'),
  rentalMode: z.enum(['SELF_DRIVE', 'CHAUFFEUR']),
  additionalServices: z.array(z.string()),
  specialRequests: z.string().max(1500).optional(),
});

type RentalFormValues = z.infer<typeof rentalSchema>;

function generateClientIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rnt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RentalBookingFormProps {
  vehicle: Vehicle;
  setting: BusinessSetting;
  bookedSlots: ScheduleSlot[];
  initialPickup?: string;
  initialReturn?: string;
}

export function RentalBookingForm({
  vehicle,
  setting,
  bookedSlots,
  initialPickup,
  initialReturn,
}: RentalBookingFormProps) {
  const { profile, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  const draftKey = `autosuite_draft_rental_${vehicle.id}`;
  const idempotencyKeyRef = useRef<string>(generateClientIdempotencyKey());
  const submittingLockRef = useRef<boolean>(false);

  const defaultPickup =
    initialPickup || new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const defaultReturn =
    initialReturn || new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16);
  const defaultLocation = setting.locations[0] || vehicle.location || 'Main Showroom';

  const loadDraft = (): Partial<RentalFormValues> => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return {};
      return JSON.parse(raw) as Partial<RentalFormValues>;
    } catch {
      return {};
    }
  };

  const savedDraft = loadDraft();

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [reviewValues, setReviewValues] = useState<RentalFormValues | null>(null);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedBooking, setSubmittedBooking] = useState<{
    bookingReference: string;
    totalCents: number;
    depositCents: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RentalFormValues>({
    resolver: zodResolver(rentalSchema),
    defaultValues: {
      fullName: savedDraft.fullName || profile?.fullName || '',
      phone: savedDraft.phone || profile?.phone || '',
      email: savedDraft.email || profile?.email || '',
      pickupAt: savedDraft.pickupAt || defaultPickup,
      returnAt: savedDraft.returnAt || defaultReturn,
      pickupLocation: savedDraft.pickupLocation || defaultLocation,
      returnLocation: savedDraft.returnLocation || defaultLocation,
      rentalMode: savedDraft.rentalMode || 'SELF_DRIVE',
      additionalServices: Array.isArray(savedDraft.additionalServices)
        ? savedDraft.additionalServices
        : [],
      specialRequests: savedDraft.specialRequests || '',
    },
  });

  // Prefill from authenticated customer profile when fields are blank
  useEffect(() => {
    if (profile) {
      if (!watch('fullName')) setValue('fullName', profile.fullName || '');
      if (!watch('phone') && profile.phone) setValue('phone', profile.phone);
      if (!watch('email') && profile.email) setValue('email', profile.email);
    }
  }, [profile, setValue, watch]);

  // Persist draft across redirects
  const watchedAll = watch();
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(watchedAll));
    } catch {
      // ignore
    }
  }, [draftKey, watchedAll]);

  const pickupAt = watch('pickupAt');
  const returnAt = watch('returnAt');
  const rentalMode = watch('rentalMode');
  const additionalServices = watch('additionalServices');

  const localQuote = useMemo(() => {
    return calculateRentalQuote({
      pickupAt,
      returnAt,
      dailyRateCents: vehicle.rentalPricePerDayCents,
      rentalMode: rentalMode as RentalMode,
      chauffeurFeePerDayCents: setting.chauffeurFeePerDayCents,
      depositPercent: setting.depositPercent,
      additionalServices,
    });
  }, [
    pickupAt,
    returnAt,
    vehicle.rentalPricePerDayCents,
    rentalMode,
    setting.chauffeurFeePerDayCents,
    setting.depositPercent,
    additionalServices,
  ]);

  const [serverQuote, setServerQuote] = useState<RentalCalculationResult | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/rentals/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupAt,
        returnAt,
        dailyRateCents: vehicle.rentalPricePerDayCents,
        rentalMode,
        chauffeurFeePerDayCents: setting.chauffeurFeePerDayCents,
        depositPercent: setting.depositPercent,
        additionalServices,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!active) return;
        if (r.ok && data.valid) {
          setServerQuote(data);
        } else {
          setServerQuote(null);
        }
      })
      .catch(() => {
        if (active) setServerQuote(null);
      });
    return () => {
      active = false;
    };
  }, [
    pickupAt,
    returnAt,
    vehicle.rentalPricePerDayCents,
    rentalMode,
    setting.chauffeurFeePerDayCents,
    setting.depositPercent,
    additionalServices,
  ]);

  const quote = localQuote.valid ? serverQuote || localQuote : localQuote;

  const hasOverlap = useMemo(() => {
    return hasDateRangeOverlap(pickupAt, returnAt, bookedSlots);
  }, [pickupAt, returnAt, bookedSlots]);

  const toggleAddon = (addonId: string) => {
    const current = new Set(additionalServices);
    if (current.has(addonId)) current.delete(addonId);
    else current.add(addonId);
    setValue('additionalServices', Array.from(current));
  };

  const handleReviewStep = (data: RentalFormValues) => {
    if (!profile || !isEmailVerified) {
      const target = `/cars-for-rent/${vehicle.id}/book`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=rental`);
      return;
    }
    if (!quote?.valid || hasOverlap || !vehicle.available) {
      return;
    }
    setSubmitError(null);
    setReviewValues(data);
    setStep('review');
  };

  const handleConfirmSubmit = async () => {
    if (!reviewValues) return;
    if (!profile || !isEmailVerified) {
      const target = `/cars-for-rent/${vehicle.id}/book`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=rental`);
      return;
    }
    if (submittingLockRef.current) return;

    submittingLockRef.current = true;
    setSubmittingConfirm(true);
    setSubmitError(null);

    try {
      const result = await submitRentalBooking(
        {
          vehicle,
          setting,
          fullName: reviewValues.fullName,
          phone: reviewValues.phone,
          email: reviewValues.email || undefined,
          pickupLocation: reviewValues.pickupLocation,
          returnLocation: reviewValues.returnLocation,
          pickupAt: reviewValues.pickupAt,
          returnAt: reviewValues.returnAt,
          rentalMode: reviewValues.rentalMode as RentalMode,
          additionalServices: reviewValues.additionalServices,
          specialRequests: reviewValues.specialRequests || undefined,
          idempotencyKey: idempotencyKeyRef.current,
        },
        profile
      );
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      setSubmittedBooking({
        bookingReference: result.bookingReference,
        totalCents: quote.totalAmountCents,
        depositCents: quote.requiredDepositCents,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to submit rental booking request.'
      );
    } finally {
      submittingLockRef.current = false;
      setSubmittingConfirm(false);
    }
  };

  if (submittedBooking) {
    return (
      <div className="p-5 rounded-xl bg-[#171717] border border-[#20D94B]/50 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#20D94B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Rental Booking Request Submitted</h3>
            <p className="text-xs text-[#A6A6A6] leading-relaxed">
              Your reservation request for{' '}
              <span className="text-white font-semibold">{vehicle.name}</span> is awaiting fleet
              confirmation.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#202020] border border-[#353535] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#A6A6A6]">Booking Reference</span>
            <span className="text-sm font-mono font-extrabold text-[#20D94B] tabular-nums">
              {submittedBooking.bookingReference}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#A6A6A6]">Estimated Total</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {formatMoney(submittedBooking.totalCents, setting.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#A6A6A6]">Required Deposit</span>
            <span className="font-mono text-white tabular-nums">
              {formatMoney(submittedBooking.depositCents, setting.currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/account/bookings"
            className="flex-1 h-10 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:brightness-110 transition"
          >
            Track in My Rental Bookings
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => {
              idempotencyKeyRef.current = generateClientIdempotencyKey();
              setSubmittedBooking(null);
              setReviewValues(null);
              setStep('form');
            }}
            className="h-10 px-4 rounded-xl bg-[#202020] border border-[#353535] text-xs font-semibold text-white hover:border-white/40 cursor-pointer"
          >
            New Booking
          </button>
        </div>
      </div>
    );
  }

  if (step === 'review' && reviewValues && quote?.valid) {
    const addonLabels = reviewValues.additionalServices.map(
      (id) => RENTAL_ADDONS.find((a) => a.id === id)?.label || id
    );
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#171717] border border-[#20D94B]/40 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-[#353535] pb-3">
            <div>
              <p className="text-xs font-bold text-[#20D94B] uppercase tracking-wider">
                Review &amp; Confirm
              </p>
              <h3 className="text-base font-bold text-white mt-0.5">
                Rental Reservation Summary
              </h3>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#20D94B] shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Selected Vehicle</span>
              <span className="font-bold text-white">
                {vehicle.year} {vehicle.name}
              </span>
              <span className="block text-[#A6A6A6] mt-0.5">
                {reviewValues.rentalMode === 'CHAUFFEUR' ? 'Chauffeur-Driven' : 'Self-Drive'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Driver / Renter Contact</span>
              <span className="font-semibold text-white block">{reviewValues.fullName}</span>
              <span className="font-mono text-[#A6A6A6] block">{reviewValues.phone}</span>
              {reviewValues.email && (
                <span className="text-[#A6A6A6] block truncate">{reviewValues.email}</span>
              )}
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Pickup</span>
              <span className="font-mono text-white block">
                {reviewValues.pickupAt.replace('T', ' ')}
              </span>
              <span className="text-[#A6A6A6] block truncate">{reviewValues.pickupLocation}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Return</span>
              <span className="font-mono text-white block">
                {reviewValues.returnAt.replace('T', ' ')}
              </span>
              <span className="text-[#A6A6A6] block truncate">{reviewValues.returnLocation}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#202020] border border-[#353535] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#A6A6A6]">
              <span>Duration</span>
              <span className="font-mono text-white">{quote.days} days</span>
            </div>
            {addonLabels.length > 0 && (
              <div className="flex justify-between gap-2 text-[#A6A6A6]">
                <span>Additional Services</span>
                <span className="text-white text-right">{addonLabels.join(', ')}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#353535] font-bold text-sm text-white">
              <span>Estimated Total</span>
              <span className="font-mono text-[#20D94B] tabular-nums">
                {formatMoney(quote.totalAmountCents, setting.currency)}
              </span>
            </div>
            <div className="flex justify-between text-[#A6A6A6]">
              <span>Required Deposit ({setting.depositPercent}%)</span>
              <span className="font-mono tabular-nums text-white">
                {formatMoney(quote.requiredDepositCents, setting.currency)}
              </span>
            </div>
          </div>

          {reviewValues.specialRequests && (
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535] text-xs">
              <span className="text-[#A6A6A6]">Special Requests: </span>
              <span className="text-white">{reviewValues.specialRequests}</span>
            </div>
          )}
        </div>

        {submitError && (
          <p className="text-xs rounded-xl p-3 border bg-red-500/10 border-red-500/40 text-red-400">
            {submitError}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={submittingConfirm}
            onClick={() => setStep('form')}
            className="h-12 px-5 rounded-xl bg-[#171717] border border-[#353535] text-white font-semibold text-xs inline-flex items-center justify-center gap-2 hover:border-[#4D4D4D] cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Edit Booking
          </button>
          <button
            type="button"
            disabled={submittingConfirm}
            onClick={() => void handleConfirmSubmit()}
            className="flex-1 h-12 px-5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            <CalendarCheck className="w-4 h-4" />
            {submittingConfirm
              ? 'Submitting Rental Booking...'
              : 'Confirm & Submit Rental Booking'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleReviewStep)} className="space-y-4">
      <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] text-[#A6A6A6]">Selected Rental Vehicle</span>
          <span className="block text-xs font-bold text-white truncate">
            {vehicle.year} {vehicle.name}
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums font-bold text-[#20D94B] shrink-0">
          {formatMoney(vehicle.rentalPricePerDayCents, setting.currency)}/day
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Full Name <span className="text-[#20D94B]">*</span>
          </label>
          <input
            type="text"
            {...register('fullName')}
            placeholder="Alex Morgan"
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.fullName && (
            <p className="text-[11px] text-red-400 mt-1">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Phone Number <span className="text-[#20D94B]">*</span>
          </label>
          <input
            type="tel"
            {...register('phone')}
            placeholder="+250 788 000 100"
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.phone && (
            <p className="text-[11px] text-red-400 mt-1">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
          Email Address (Optional)
        </label>
        <input
          type="email"
          {...register('email')}
          placeholder="renter@company.com"
          className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
        />
        {errors.email && (
          <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Pickup Date &amp; Time <span className="text-[#20D94B]">*</span>
          </label>
          <input
            type="datetime-local"
            {...register('pickupAt')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.pickupAt && (
            <p className="text-[11px] text-red-400 mt-1">{errors.pickupAt.message}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Return Date &amp; Time <span className="text-[#20D94B]">*</span>
          </label>
          <input
            type="datetime-local"
            {...register('returnAt')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.returnAt && (
            <p className="text-[11px] text-red-400 mt-1">{errors.returnAt.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Pickup Location <span className="text-[#20D94B]">*</span>
          </label>
          <select
            {...register('pickupLocation')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          >
            {setting.locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Return Location <span className="text-[#20D94B]">*</span>
          </label>
          <select
            {...register('returnLocation')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          >
            {setting.locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
          Rental Option <span className="text-[#20D94B]">*</span>
        </label>
        <select
          {...register('rentalMode')}
          className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
        >
          <option value="SELF_DRIVE">Self-Drive</option>
          {vehicle.chauffeurAvailable && (
            <option value="CHAUFFEUR">
              Chauffeur-Driven (+{formatMoney(setting.chauffeurFeePerDayCents, setting.currency)}
              /day)
            </option>
          )}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[#A6A6A6]">
          Additional Services (Optional)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RENTAL_ADDONS.map((addon) => {
            const checked = additionalServices.includes(addon.id);
            return (
              <label
                key={addon.id}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                  checked
                    ? 'bg-[#20D94B]/10 border-[#20D94B]/60 text-white'
                    : 'bg-[#171717] border-[#353535] text-[#A6A6A6] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddon(addon.id)}
                    className="accent-[#20D94B] rounded"
                  />
                  <span>{addon.label}</span>
                </span>
                <span className="font-mono tabular-nums text-[11px] text-[#20D94B] shrink-0">
                  +{formatMoney(addon.perDayCents, setting.currency)}/d
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
          Special Requests (Optional)
        </label>
        <textarea
          rows={2}
          {...register('specialRequests')}
          placeholder="Flight number for airport pickup, child seat setup, preferred handover time..."
          className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
        />
      </div>

      {/* Live Backend Price Breakdown */}
      {quote?.valid ? (
        <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] space-y-2 text-xs">
          <div className="flex justify-between text-[#A6A6A6]">
            <span>
              Base Rental ({quote.days} days ×{' '}
              {formatMoney(quote.dailyRateCents, setting.currency)})
            </span>
            <span className="font-mono tabular-nums text-white">
              {formatMoney(quote.baseRentalCents, setting.currency)}
            </span>
          </div>
          {quote.chauffeurFeeCents > 0 && (
            <div className="flex justify-between text-[#A6A6A6]">
              <span>Chauffeur Service ({quote.days} days)</span>
              <span className="font-mono tabular-nums text-white">
                {formatMoney(quote.chauffeurFeeCents, setting.currency)}
              </span>
            </div>
          )}
          {quote.additionalServicesCents > 0 && (
            <div className="flex justify-between text-[#A6A6A6]">
              <span>Additional Services ({additionalServices.length} selected)</span>
              <span className="font-mono tabular-nums text-white">
                {formatMoney(quote.additionalServicesCents, setting.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-[#353535] font-bold text-sm text-white">
            <span>Estimated Rental Total</span>
            <span className="font-mono tabular-nums text-[#20D94B]">
              {formatMoney(quote.totalAmountCents, setting.currency)}
            </span>
          </div>
          <div className="flex justify-between text-[#A6A6A6]">
            <span>Required Security Deposit ({setting.depositPercent}%)</span>
            <span className="font-mono tabular-nums">
              {formatMoney(quote.requiredDepositCents, setting.currency)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-400">{quote?.error}</p>
      )}

      {hasOverlap && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          Conflict detected: Another confirmed rental overlaps your selected dates. Please choose
          different dates.
        </p>
      )}

      {submitError && (
        <p className="text-xs rounded-xl p-3 border bg-red-500/10 border-red-500/40 text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={!quote?.valid || hasOverlap || !vehicle.available}
        className="w-full h-12 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
      >
        <CalendarCheck className="w-4 h-4" />
        {profile && isEmailVerified
          ? 'Review Rental Booking'
          : 'Sign In to Book This Car'}
      </button>
    </form>
  );
}
