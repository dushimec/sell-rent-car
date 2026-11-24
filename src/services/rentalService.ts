import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  BookingStatus,
  BusinessSetting,
  PaymentMethod,
  PaymentType,
  RentalBooking,
  RentalMode,
  ScheduleSlot,
  UserProfile,
  Vehicle,
} from '../types/autosuite';
import { normalizeCurrency } from '../utils/money';
import { hasDateRangeOverlap } from '../utils/rentalCalc';
import {
  createNotification,
  dispatchTransactionalEmail,
  writeAuditLog,
} from './autosuiteService';

export interface SubmitRentalBookingPayload {
  vehicle: Vehicle;
  setting: BusinessSetting;
  fullName: string;
  phone: string;
  email?: string;
  pickupLocation: string;
  returnLocation: string;
  pickupAt: string;
  returnAt: string;
  rentalMode: RentalMode;
  additionalServices: string[];
  specialRequests?: string;
  idempotencyKey?: string;
}

export async function submitRentalBooking(
  payload: SubmitRentalBookingPayload,
  actor: UserProfile
): Promise<{ id: string; bookingReference: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Please sign in and verify your email before submitting a rental booking.');
  }

  const res = await fetch('/api/rental-bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      vehicleId: payload.vehicle.id,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email || '',
      pickupLocation: payload.pickupLocation,
      returnLocation: payload.returnLocation,
      pickupAt: payload.pickupAt,
      returnAt: payload.returnAt,
      rentalMode: payload.rentalMode,
      additionalServices: payload.additionalServices,
      specialRequests: payload.specialRequests || '',
      dailyRateCents: payload.vehicle.rentalPricePerDayCents,
      chauffeurFeePerDayCents: payload.setting.chauffeurFeePerDayCents,
      depositPercent: payload.setting.depositPercent,
      currency: normalizeCurrency(payload.setting.currency),
      idempotencyKey: payload.idempotencyKey,
    }),
  });

  const validation = await res.json();
  if (!res.ok || !validation.valid) {
    throw new Error(validation.error || 'Please verify all required rental booking fields.');
  }

  const bookingReference: string = validation.bookingReference;
  const quote = validation.quote;

  const scheduleSnap = await getDoc(doc(db, 'vehicle_schedules', payload.vehicle.id));
  if (scheduleSnap.exists()) {
    const slots = (scheduleSnap.data().slots || []) as ScheduleSlot[];
    if (hasDateRangeOverlap(payload.pickupAt, payload.returnAt, slots)) {
      throw new Error('This vehicle already has a confirmed rental overlapping the selected dates.');
    }
  }

  try {
    const ref = await addDoc(collection(db, 'bookings'), {
      bookingReference,
      customerId: actor.uid,
      customerName: validation.normalized.fullName,
      customerPhone: validation.normalized.phone,
      customerEmail: validation.normalized.email,
      vehicleId: payload.vehicle.id,
      vehicleName: payload.vehicle.name,
      pickupLocation: validation.normalized.pickupLocation,
      returnLocation: validation.normalized.returnLocation,
      pickupAt: validation.normalized.pickupAt,
      returnAt: validation.normalized.returnAt,
      rentalMode: validation.normalized.rentalMode,
      additionalServices: validation.normalized.additionalServices,
      specialRequests: validation.normalized.specialRequests,
      days: quote.days,
      currency: normalizeCurrency(validation.normalized.currency || payload.setting.currency),
      dailyRateCents: quote.dailyRateCents,
      chauffeurFeeCents: quote.chauffeurFeeCents,
      additionalServicesCents: quote.additionalServicesCents,
      totalAmountCents: quote.totalAmountCents,
      requiredDepositCents: quote.requiredDepositCents,
      paidAmountCents: 0,
      status: 'PENDING' as BookingStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: actor.uid,
      audience: 'USER',
      title: `Rental Request Submitted (${bookingReference})`,
      message: `Your rental request for ${payload.vehicle.name} (${quote.days} days) is awaiting confirmation.`,
      type: 'BOOKING',
      link: '/account/bookings',
    });

    await createNotification({
      userId: actor.uid,
      audience: 'ADMIN',
      title: `New Rental Request ${bookingReference}`,
      message: `${validation.normalized.fullName} requested ${payload.vehicle.name} (${quote.days} days).`,
      type: 'BOOKING',
      link: '/admin',
    });

    await writeAuditLog(
      actor,
      'CREATE_RENTAL_BOOKING',
      'RentalBooking',
      ref.id,
      `Submitted rental booking ${bookingReference} for ${payload.vehicle.name}`
    );

    return { id: ref.id, bookingReference };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'bookings');
  }
}

export async function approveRentalBooking(bookingId: string, actor: UserProfile): Promise<void> {
  const bookingRef = doc(db, 'bookings', bookingId);
  let approvedBooking: RentalBooking | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) {
        throw new Error('Booking record not found.');
      }

      const booking = { id: bookingSnap.id, ...bookingSnap.data() } as RentalBooking;
      if (booking.status !== 'PENDING') {
        throw new Error(`Cannot approve booking in ${booking.status} state.`);
      }

      const scheduleRef = doc(db, 'vehicle_schedules', booking.vehicleId);
      const scheduleSnap = await tx.get(scheduleRef);
      const currentSlots: ScheduleSlot[] = scheduleSnap.exists()
        ? (scheduleSnap.data().slots as ScheduleSlot[]) || []
        : [];

      if (hasDateRangeOverlap(booking.pickupAt, booking.returnAt, currentSlots, booking.id)) {
        throw new Error(
          'Booking conflict detected: another confirmed rental overlaps these dates for this vehicle.'
        );
      }

      const nextSlots: ScheduleSlot[] = [
        ...currentSlots,
        {
          bookingId: booking.id,
          pickupAt: booking.pickupAt,
          returnAt: booking.returnAt,
        },
      ];

      const contractRef = `CTR-${new Date().getFullYear()}-${booking.id.slice(0, 6).toUpperCase()}`;

      tx.set(scheduleRef, {
        vehicleId: booking.vehicleId,
        slots: nextSlots,
        updatedAt: serverTimestamp(),
      });

      tx.update(bookingRef, {
        status: 'CONFIRMED',
        contractReference: contractRef,
        assignedStaffId: actor.uid,
        updatedAt: serverTimestamp(),
      });

      approvedBooking = booking;
    });

    if (approvedBooking) {
      const b = approvedBooking as RentalBooking;
      await createNotification({
        userId: b.customerId,
        audience: 'USER',
        title: `Rental Booking Confirmed (${b.bookingReference})`,
        message: `Your rental for ${b.vehicleName} (${b.pickupAt.slice(0, 10)}) has been approved.`,
        type: 'BOOKING',
        link: '/account/bookings',
      });
      if (b.customerEmail) {
        await dispatchTransactionalEmail(
          b.customerEmail,
          `Rental Confirmed (${b.bookingReference}): ${b.vehicleName}`,
          `<p>Hello ${b.customerName},</p><p>Your rental booking <strong>${b.bookingReference}</strong> for <strong>${b.vehicleName}</strong> has been confirmed.</p>`
        );
      }
      await writeAuditLog(
        actor,
        'APPROVE_RENTAL_BOOKING',
        'RentalBooking',
        bookingId,
        `Confirmed booking ${b.bookingReference} for ${b.vehicleName}`
      );
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('conflict') || err.message.includes('Cannot approve'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
  }
}

export async function transitionRentalBooking(
  bookingId: string,
  nextStatus: Extract<BookingStatus, 'REJECTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>,
  actor: UserProfile,
  inspectionNote?: string
): Promise<void> {
  const bookingRef = doc(db, 'bookings', bookingId);
  let targetBooking: RentalBooking | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists()) throw new Error('Booking not found.');
      const booking = { id: snap.id, ...snap.data() } as RentalBooking;

      const scheduleRef = doc(db, 'vehicle_schedules', booking.vehicleId);
      const scheduleSnap = await tx.get(scheduleRef);
      const currentSlots: ScheduleSlot[] = scheduleSnap.exists()
        ? (scheduleSnap.data().slots as ScheduleSlot[]) || []
        : [];

      const releasesSlot = nextStatus === 'REJECTED' || nextStatus === 'CANCELLED' || nextStatus === 'COMPLETED';
      if (releasesSlot && scheduleSnap.exists()) {
        const filteredSlots = currentSlots.filter((s) => s.bookingId !== booking.id);
        tx.set(scheduleRef, {
          vehicleId: booking.vehicleId,
          slots: filteredSlots,
          updatedAt: serverTimestamp(),
        });
      }

      const updateFields: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      if (nextStatus === 'ACTIVE' && inspectionNote) {
        updateFields.pickupInspectionNote = inspectionNote.trim();
      }
      if (nextStatus === 'COMPLETED' && inspectionNote) {
        updateFields.returnInspectionNote = inspectionNote.trim();
      }

      tx.update(bookingRef, updateFields);
      targetBooking = booking;
    });

    if (targetBooking) {
      const b = targetBooking as RentalBooking;
      await createNotification({
        userId: b.customerId,
        audience: 'USER',
        title: `Booking ${b.bookingReference} ${nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}`,
        message: `Your rental booking for ${b.vehicleName} is now ${nextStatus.toLowerCase()}.`,
        type: 'BOOKING',
        link: '/account/bookings',
      });
      await writeAuditLog(
        actor,
        `BOOKING_${nextStatus}`,
        'RentalBooking',
        bookingId,
        `Updated booking ${b.bookingReference} status to ${nextStatus}`
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
  }
}

export async function cancelOwnPendingBooking(booking: RentalBooking, actor: UserProfile) {
  const ref = doc(db, 'bookings', booking.id);
  try {
    await updateDoc(ref, {
      status: 'CANCELLED',
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      actor,
      'CANCEL_RENTAL_BOOKING',
      'RentalBooking',
      booking.id,
      `Customer cancelled pending booking ${booking.bookingReference}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
  }
}

export async function recordManualPayment(
  params: {
    booking: RentalBooking;
    amountCents: number;
    paymentType: PaymentType;
    method: PaymentMethod;
    reference: string;
    notes: string;
    paidAt: string;
  },
  actor: UserProfile
): Promise<void> {
  if (params.amountCents <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const bookingRef = doc(db, 'bookings', params.booking.id);
  const paymentRef = doc(collection(db, 'payments'));

  try {
    await runTransaction(db, async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) throw new Error('Booking not found.');
      const booking = bookingSnap.data() as RentalBooking;

      const delta = params.paymentType === 'REFUND' ? -params.amountCents : params.amountCents;
      const nextPaid = Math.max(0, (booking.paidAmountCents || 0) + delta);

      tx.set(paymentRef, {
        bookingId: params.booking.id,
        customerId: params.booking.customerId,
        customerName: params.booking.customerName,
        amountCents: params.amountCents,
        currency: params.booking.currency,
        paymentType: params.paymentType,
        method: params.method,
        reference: params.reference.trim(),
        notes: params.notes.trim(),
        paidAt: params.paidAt,
        recordedBy: actor.uid,
        createdAt: serverTimestamp(),
      });

      tx.update(bookingRef, {
        paidAmountCents: nextPaid,
        updatedAt: serverTimestamp(),
      });
    });

    await createNotification({
      userId: params.booking.customerId,
      audience: 'USER',
      title: `Payment Recorded (${params.booking.bookingReference})`,
      message: `A ${params.paymentType.replace('_', ' ').toLowerCase()} was recorded for ${params.booking.vehicleName} (Ref: ${params.reference}).`,
      type: 'PAYMENT',
      link: '/account/payments',
    });

    await writeAuditLog(
      actor,
      'RECORD_PAYMENT',
      'RentalPayment',
      paymentRef.id,
      `Recorded ${params.paymentType} (${params.method}) for booking ${params.booking.bookingReference}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'payments');
  }
}
