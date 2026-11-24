import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  BusinessSetting,
  InquiryNote,
  InquiryStatus,
  PurchaseTimeline,
  SalePaymentPreference,
  UserProfile,
  Vehicle,
} from '../types/autosuite';
import { normalizeCurrency } from '../utils/money';
import {
  createNotification,
  dispatchTransactionalEmail,
  writeAuditLog,
} from './autosuiteService';

export interface SubmitPurchaseInquiryPayload {
  vehicle: Vehicle;
  setting: BusinessSetting;
  fullName: string;
  phone: string;
  email?: string;
  preferredBudgetCents: number;
  preferredPaymentMethod: SalePaymentPreference;
  purchaseTimeline: PurchaseTimeline;
  needsFinancing: boolean;
  preferredInspectionDate?: string;
  message?: string;
  idempotencyKey?: string;
}

export async function submitPurchaseInquiry(
  payload: SubmitPurchaseInquiryPayload,
  actor: UserProfile
): Promise<{ id: string; inquiryReference: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Please sign in and verify your email before submitting a purchase inquiry.');
  }

  const res = await fetch('/api/sales-inquiries', {
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
      preferredBudgetCents: payload.preferredBudgetCents,
      currency: normalizeCurrency(payload.setting.currency),
      preferredPaymentMethod: payload.preferredPaymentMethod,
      purchaseTimeline: payload.purchaseTimeline,
      needsFinancing: payload.needsFinancing,
      preferredInspectionDate: payload.preferredInspectionDate || '',
      message: payload.message || '',
      idempotencyKey: payload.idempotencyKey,
    }),
  });

  const validation = await res.json();
  if (!res.ok || !validation.valid) {
    throw new Error(validation.error || 'Please verify all required purchase fields.');
  }

  const inquiryReference: string = validation.inquiryReference;

  try {
    const docRef = await addDoc(collection(db, 'inquiries'), {
      inquiryReference,
      customerId: actor.uid,
      vehicleId: payload.vehicle.id,
      vehicleName: payload.vehicle.name,
      customerName: validation.normalized.fullName,
      customerPhone: validation.normalized.phone,
      customerEmail: validation.normalized.email,
      preferredBudgetCents: validation.normalized.preferredBudgetCents,
      currency: normalizeCurrency(validation.normalized.currency || payload.setting.currency),
      preferredPaymentMethod: validation.normalized.preferredPaymentMethod,
      purchaseTimeline: validation.normalized.purchaseTimeline,
      needsFinancing: validation.normalized.needsFinancing,
      preferredInspectionDate: validation.normalized.preferredInspectionDate,
      message: validation.normalized.message,
      status: 'NEW' as InquiryStatus,
      notes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: actor.uid,
      audience: 'USER',
      title: `Purchase Inquiry Received (${inquiryReference})`,
      message: `Your purchase requirements for ${payload.vehicle.name} have been received.`,
      type: 'INQUIRY',
      link: '/account/purchase-inquiries',
    });

    await createNotification({
      userId: actor.uid,
      audience: 'ADMIN',
      title: `New Purchase Inquiry ${inquiryReference}`,
      message: `${validation.normalized.fullName} expressed purchase interest in ${payload.vehicle.name}.`,
      type: 'INQUIRY',
      link: '/admin',
    });

    if (validation.normalized.email) {
      await dispatchTransactionalEmail(
        validation.normalized.email,
        `Purchase Inquiry Received (${inquiryReference}) — ${payload.vehicle.name}`,
        `<p>Hello ${validation.normalized.fullName},</p><p>We have received your purchase inquiry <strong>${inquiryReference}</strong> for <strong>${payload.vehicle.name}</strong>.</p>`
      );
    }

    await writeAuditLog(
      actor,
      'CREATE_PURCHASE_INQUIRY',
      'SaleInquiry',
      docRef.id,
      `Submitted purchase inquiry ${inquiryReference} for ${payload.vehicle.name}`
    );

    return { id: docRef.id, inquiryReference };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'inquiries');
  }
}

export async function updateSaleInquiry(
  inquiryId: string,
  updates: {
    status?: InquiryStatus;
    assignedStaffId?: string;
    assignedStaffName?: string;
    followUpDate?: string;
    newNote?: string;
    existingNotes?: InquiryNote[];
  },
  actor: UserProfile
) {
  const ref = doc(db, 'inquiries', inquiryId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.status) payload.status = updates.status;
  if (updates.assignedStaffId !== undefined) payload.assignedStaffId = updates.assignedStaffId;
  if (updates.assignedStaffName !== undefined) payload.assignedStaffName = updates.assignedStaffName;
  if (updates.followUpDate !== undefined) payload.followUpDate = updates.followUpDate;
  if (updates.newNote && updates.newNote.trim()) {
    const note: InquiryNote = {
      id: `${Date.now()}`,
      authorId: actor.uid,
      authorName: actor.fullName,
      content: updates.newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    payload.notes = [...(updates.existingNotes || []), note];
  }

  try {
    await updateDoc(ref, payload);
    await writeAuditLog(
      actor,
      'UPDATE_PURCHASE_INQUIRY',
      'SaleInquiry',
      inquiryId,
      `Updated sales inquiry ${inquiryId}${updates.status ? ` to ${updates.status}` : ''}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `inquiries/${inquiryId}`);
  }
}
