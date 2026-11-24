import React, { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { recordManualPayment } from '../../services/rentalService';
import type {
  BusinessSetting,
  PaymentMethod,
  PaymentType,
  RentalBooking,
  RentalPayment,
  UserProfile,
} from '../../types/autosuite';
import { amountToCents, formatMoney } from '../../utils/money';

interface AdminPaymentsTabProps {
  profile: UserProfile;
  setting: BusinessSetting;
  bookings: RentalBooking[];
  payments: RentalPayment[];
  preselectedBookingId?: string;
}

export function AdminPaymentsTab({
  profile,
  setting,
  bookings,
  payments,
  preselectedBookingId,
}: AdminPaymentsTabProps) {
  const eligibleBookings = bookings.filter((b) => b.status !== 'REJECTED' && b.status !== 'CANCELLED');

  const [bookingId, setBookingId] = useState(preselectedBookingId || eligibleBookings[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('DEPOSIT');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (preselectedBookingId) {
      setBookingId(preselectedBookingId);
    } else if (!bookingId && eligibleBookings.length > 0) {
      setBookingId(eligibleBookings[0].id);
    }
  }, [preselectedBookingId, eligibleBookings, bookingId]);

  const selectedBooking = bookings.find((b) => b.id === bookingId);

  const totalDepositsCents = payments
    .filter((p) => p.paymentType === 'DEPOSIT')
    .reduce((acc, p) => acc + p.amountCents, 0);
  const totalRentalPaymentsCents = payments
    .filter((p) => p.paymentType === 'RENTAL_PAYMENT')
    .reduce((acc, p) => acc + p.amountCents, 0);
  const totalRefundsCents = payments
    .filter((p) => p.paymentType === 'REFUND')
    .reduce((acc, p) => acc + p.amountCents, 0);
  const netCollectedCents = totalDepositsCents + totalRentalPaymentsCents - totalRefundsCents;

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    const amountCents = amountToCents(amount);
    if (amountCents <= 0 || !reference.trim()) {
      setFeedback({ ok: false, text: 'Enter a valid payment amount and reference.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await recordManualPayment(
        {
          booking: selectedBooking,
          amountCents,
          paymentType,
          method,
          reference,
          notes,
          paidAt,
        },
        profile
      );
      setAmount('');
      setReference('');
      setNotes('');
      setFeedback({ ok: true, text: 'Manual payment recorded and booking balance updated.' });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to record payment.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
          <p className="text-xs text-[#A6A6A6]">Net Collected Payments</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#20D94B] mt-1">
            {formatMoney(netCollectedCents, setting.currency)}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
          <p className="text-xs text-[#A6A6A6]">Security Deposits Held</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {formatMoney(totalDepositsCents, setting.currency)}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
          <p className="text-xs text-[#A6A6A6]">Rental Settlements</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {formatMoney(totalRentalPaymentsCents, setting.currency)}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
          <p className="text-xs text-[#A6A6A6]">Refunds Issued</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-amber-400 mt-1">
            {formatMoney(totalRefundsCents, setting.currency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleRecord}
          className="lg:col-span-5 bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4 text-xs"
        >
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#20D94B]" />
            Record Manual Payment
          </h3>

          {feedback && (
            <div
              className={`p-3 rounded-xl border ${
                feedback.ok
                  ? 'bg-[#20D94B]/10 border-[#20D94B]/40 text-[#20D94B]'
                  : 'bg-red-500/10 border-red-500/40 text-red-400'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div>
            <label className="block text-[#A6A6A6] mb-1">Target Rental Booking</label>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            >
              <option value="">Select booking...</option>
              {eligibleBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingReference || `#${b.id.slice(0, 6).toUpperCase()}`} · {b.customerName} · {b.vehicleName}
                </option>
              ))}
            </select>
          </div>

          {selectedBooking && (
            <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] space-y-1.5">
              <div className="flex justify-between text-[#A6A6A6]">
                <span>Booking Total</span>
                <span className="font-mono tabular-nums text-white">
                  {formatMoney(selectedBooking.totalAmountCents, selectedBooking.currency)}
                </span>
              </div>
              <div className="flex justify-between text-[#A6A6A6]">
                <span>Paid So Far</span>
                <span className="font-mono tabular-nums text-[#20D94B]">
                  {formatMoney(selectedBooking.paidAmountCents || 0, selectedBooking.currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-white pt-1 border-t border-[#353535]">
                <span>Outstanding Balance</span>
                <span className="font-mono tabular-nums text-amber-400">
                  {formatMoney(
                    Math.max(0, selectedBooking.totalAmountCents - (selectedBooking.paidAmountCents || 0)),
                    selectedBooking.currency
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A6A6A6] mb-1">Amount ({setting.currency})</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="150000"
                className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[#A6A6A6] mb-1">Payment Date</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A6A6A6] mb-1">Payment Type</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
              >
                <option value="DEPOSIT">Security Deposit</option>
                <option value="RENTAL_PAYMENT">Rental Payment</option>
                <option value="REFUND">Refund</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A6A6A6] mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other Manual Method</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#A6A6A6] mb-1">Payment Reference / Receipt #</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              placeholder="WIRE-2026-8812"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[#A6A6A6] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Verified by showroom desk"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !selectedBooking}
            className="w-full h-11 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </form>

        {/* Payment Ledger Table */}
        <div className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl overflow-x-auto">
          <div className="p-5 border-b border-[#353535]">
            <h3 className="text-base font-bold text-white">Recorded Payment Ledger</h3>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#353535] text-[#A6A6A6]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type / Method</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#353535]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#A6A6A6]">
                    No manual payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#A6A6A6]">{p.paidAt}</td>
                    <td className="py-3 px-4 font-semibold text-white">{p.customerName}</td>
                    <td className="py-3 px-4 text-[#A6A6A6]">{p.paymentType} · {p.method}</td>
                    <td className="py-3 px-4 font-mono text-white">{p.reference}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                        p.paymentType === 'REFUND' ? 'text-amber-400' : 'text-[#20D94B]'
                      }`}
                    >
                      {p.paymentType === 'REFUND' ? '-' : ''}
                      {formatMoney(p.amountCents, p.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
