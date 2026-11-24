import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { submitPurchaseInquiry } from '../../services/salesService';
import type {
  BusinessSetting,
  PurchaseTimeline,
  SalePaymentPreference,
  Vehicle,
} from '../../types/autosuite';
import { amountToCents, centsToInputString, formatMoney } from '../../utils/money';

const purchaseSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  phone: z.string().trim().min(4, 'Phone number is required.'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
  preferredBudget: z
    .string()
    .trim()
    .refine((val) => amountToCents(val) > 0, {
      message: 'Preferred purchase budget is required.',
    }),
  preferredPaymentMethod: z.enum(['CASH', 'BANK_FINANCING', 'OTHER']),
  purchaseTimeline: z.enum([
    'IMMEDIATELY',
    'WITHIN_ONE_MONTH',
    'WITHIN_THREE_MONTHS',
    'LATER',
  ]),
  needsFinancing: z.enum(['YES', 'NO']),
  preferredInspectionDate: z.string().optional(),
  message: z.string().max(2000).optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const PAYMENT_LABELS: Record<PurchaseFormValues['preferredPaymentMethod'], string> = {
  CASH: 'Cash / Wire Transfer',
  BANK_FINANCING: 'Bank Financing',
  OTHER: 'Other Arranged Method',
};

const TIMELINE_LABELS: Record<PurchaseFormValues['purchaseTimeline'], string> = {
  IMMEDIATELY: 'Immediately',
  WITHIN_ONE_MONTH: 'Within One Month',
  WITHIN_THREE_MONTHS: 'Within Three Months',
  LATER: 'Later / Exploring',
};

function generateClientIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pur-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface PurchaseInquiryFormProps {
  vehicle: Vehicle;
  setting: BusinessSetting;
}

export function PurchaseInquiryForm({ vehicle, setting }: PurchaseInquiryFormProps) {
  const { profile, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  const draftKey = `autosuite_draft_purchase_${vehicle.id}`;
  const idempotencyKeyRef = useRef<string>(generateClientIdempotencyKey());
  const submittingLockRef = useRef<boolean>(false);

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [reviewValues, setReviewValues] = useState<PurchaseFormValues | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const loadDraft = (): Partial<PurchaseFormValues> => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return {};
      return JSON.parse(raw) as Partial<PurchaseFormValues>;
    } catch {
      return {};
    }
  };

  const savedDraft = loadDraft();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      fullName: savedDraft.fullName || profile?.fullName || '',
      phone: savedDraft.phone || profile?.phone || '',
      email: savedDraft.email || profile?.email || '',
      preferredBudget:
        savedDraft.preferredBudget ||
        (vehicle.salePriceCents > 0 ? centsToInputString(vehicle.salePriceCents) : ''),
      preferredPaymentMethod: savedDraft.preferredPaymentMethod || 'CASH',
      purchaseTimeline: savedDraft.purchaseTimeline || 'WITHIN_ONE_MONTH',
      needsFinancing: savedDraft.needsFinancing || 'NO',
      preferredInspectionDate: savedDraft.preferredInspectionDate || '',
      message: savedDraft.message || '',
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

  // Persist form draft across redirects
  const watchedAll = watch();
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(watchedAll));
    } catch {
      // Ignore storage quota issues
    }
  }, [draftKey, watchedAll]);

  const handleReviewStep = (data: PurchaseFormValues) => {
    if (!profile || !isEmailVerified) {
      const target = `/cars-for-sale/${vehicle.id}/inquiry`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=purchase`);
      return;
    }
    setSubmitError(null);
    setReviewValues(data);
    setStep('review');
  };

  const handleConfirmSubmit = async () => {
    if (!reviewValues) return;
    if (!profile || !isEmailVerified) {
      const target = `/cars-for-sale/${vehicle.id}/inquiry`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=purchase`);
      return;
    }
    if (submittingLockRef.current) return;

    submittingLockRef.current = true;
    setSubmittingConfirm(true);
    setSubmitError(null);

    try {
      const result = await submitPurchaseInquiry(
        {
          vehicle,
          setting,
          fullName: reviewValues.fullName,
          phone: reviewValues.phone,
          email: reviewValues.email || undefined,
          preferredBudgetCents: amountToCents(reviewValues.preferredBudget),
          preferredPaymentMethod: reviewValues.preferredPaymentMethod as SalePaymentPreference,
          purchaseTimeline: reviewValues.purchaseTimeline as PurchaseTimeline,
          needsFinancing: reviewValues.needsFinancing === 'YES',
          preferredInspectionDate: reviewValues.preferredInspectionDate || undefined,
          message: reviewValues.message || undefined,
          idempotencyKey: idempotencyKeyRef.current,
        },
        profile
      );
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      setSubmittedRef(result.inquiryReference);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to submit your purchase inquiry.'
      );
    } finally {
      submittingLockRef.current = false;
      setSubmittingConfirm(false);
    }
  };

  if (submittedRef) {
    return (
      <div className="p-5 rounded-xl bg-[#171717] border border-[#20D94B]/50 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#20D94B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Purchase Inquiry Registered</h3>
            <p className="text-xs text-[#A6A6A6] leading-relaxed">
              Your purchase requirements for{' '}
              <span className="text-white font-semibold">{vehicle.name}</span> have been assigned to
              our sales desk.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#202020] border border-[#353535] flex items-center justify-between gap-3">
          <span className="text-xs text-[#A6A6A6]">Inquiry Reference</span>
          <span className="text-sm font-mono font-extrabold text-[#20D94B] tabular-nums">
            {submittedRef}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/account/purchase-inquiries"
            className="flex-1 h-10 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:brightness-110 transition"
          >
            Track in My Purchase Inquiries
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => {
              idempotencyKeyRef.current = generateClientIdempotencyKey();
              setSubmittedRef(null);
              setReviewValues(null);
              setStep('form');
            }}
            className="h-10 px-4 rounded-xl bg-[#202020] border border-[#353535] text-xs font-semibold text-white hover:border-white/40 cursor-pointer"
          >
            New Inquiry
          </button>
        </div>
      </div>
    );
  }

  if (step === 'review' && reviewValues) {
    const budgetCents = amountToCents(reviewValues.preferredBudget);
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#171717] border border-[#20D94B]/40 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-[#353535] pb-3">
            <div>
              <p className="text-xs font-bold text-[#20D94B] uppercase tracking-wider">
                Review &amp; Confirm
              </p>
              <h3 className="text-base font-bold text-white mt-0.5">
                Purchase Requirements Summary
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
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Preferred Budget</span>
              <span className="font-mono font-bold text-[#20D94B] tabular-nums">
                {formatMoney(budgetCents, setting.currency)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Buyer Contact</span>
              <span className="font-semibold text-white block">{reviewValues.fullName}</span>
              <span className="text-[#A6A6A6] font-mono">{reviewValues.phone}</span>
              {reviewValues.email && (
                <span className="block text-[#A6A6A6] truncate">{reviewValues.email}</span>
              )}
            </div>
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535]">
              <span className="block text-[#A6A6A6]">Terms &amp; Timeline</span>
              <span className="font-semibold text-white block">
                {PAYMENT_LABELS[reviewValues.preferredPaymentMethod]}
              </span>
              <span className="text-[#A6A6A6] block">
                {TIMELINE_LABELS[reviewValues.purchaseTimeline]} · Financing:{' '}
                {reviewValues.needsFinancing === 'YES' ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {(reviewValues.preferredInspectionDate || reviewValues.message) && (
            <div className="p-3 rounded-lg bg-[#202020] border border-[#353535] text-xs space-y-1">
              {reviewValues.preferredInspectionDate && (
                <p className="text-[#A6A6A6]">
                  Preferred Inspection:{' '}
                  <span className="font-mono text-white">
                    {reviewValues.preferredInspectionDate}
                  </span>
                </p>
              )}
              {reviewValues.message && (
                <p className="text-[#A6A6A6]">
                  Notes: <span className="text-white">{reviewValues.message}</span>
                </p>
              )}
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
            Edit Details
          </button>
          <button
            type="button"
            disabled={submittingConfirm}
            onClick={() => void handleConfirmSubmit()}
            className="flex-1 h-12 px-5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
            {submittingConfirm
              ? 'Submitting Purchase Requirements...'
              : 'Confirm & Submit Purchase Inquiry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleReviewStep)} className="space-y-4">
      <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] text-[#A6A6A6]">Selected Vehicle for Purchase</span>
          <span className="block text-xs font-bold text-white truncate">
            {vehicle.year} {vehicle.name}
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums font-bold text-[#20D94B] shrink-0">
          {formatMoney(vehicle.salePriceCents, setting.currency)}
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
            placeholder="Jordan Vance"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Email Address (Optional)
          </label>
          <input
            type="email"
            {...register('email')}
            placeholder="buyer@company.com"
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.email && (
            <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Preferred Budget ({setting.currency}) <span className="text-[#20D94B]">*</span>
          </label>
          <input
            type="text"
            {...register('preferredBudget')}
            placeholder="145000000"
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-[#20D94B]"
          />
          {errors.preferredBudget && (
            <p className="text-[11px] text-red-400 mt-1">{errors.preferredBudget.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Preferred Payment Method <span className="text-[#20D94B]">*</span>
          </label>
          <select
            {...register('preferredPaymentMethod')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="CASH">Cash / Wire Transfer</option>
            <option value="BANK_FINANCING">Bank Financing</option>
            <option value="OTHER">Other Arranged Method</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Purchase Timeline <span className="text-[#20D94B]">*</span>
          </label>
          <select
            {...register('purchaseTimeline')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="IMMEDIATELY">Immediately</option>
            <option value="WITHIN_ONE_MONTH">Within One Month</option>
            <option value="WITHIN_THREE_MONTHS">Within Three Months</option>
            <option value="LATER">Later / Exploring</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Do You Need Financing? <span className="text-[#20D94B]">*</span>
          </label>
          <select
            {...register('needsFinancing')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="NO">No, self-funded</option>
            <option value="YES">Yes, financing assistance needed</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
            Preferred Inspection Date (Optional)
          </label>
          <input
            type="date"
            {...register('preferredInspectionDate')}
            className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
          Additional Requirements or Message (Optional)
        </label>
        <textarea
          rows={3}
          {...register('message')}
          placeholder="Trade-in vehicle details, pre-purchase inspection requests, or delivery notes..."
          className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white focus:outline-none focus:border-[#20D94B]"
        />
      </div>

      {submitError && (
        <p className="text-xs rounded-xl p-3 border bg-red-500/10 border-red-500/40 text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        className="w-full h-12 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
      >
        <Mail className="w-4 h-4" />
        {profile && isEmailVerified
          ? 'Review Purchase Requirements'
          : 'Sign In to Submit Purchase Inquiry'}
      </button>
    </form>
  );
}
