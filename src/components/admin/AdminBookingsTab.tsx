import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, FileText, ShieldAlert, XCircle } from 'lucide-react';
import {
  approveRentalBooking,
  transitionRentalBooking,
} from '../../services/rentalService';
import type { BookingStatus, RentalBooking, UserProfile, Vehicle } from '../../types/autosuite';
import { findBookingConflictIds } from '../../utils/calendarUtils';
import { DEFAULT_CURRENCY, formatMoney } from '../../utils/money';
import { RENTAL_ADDONS } from '../../utils/rentalCalc';
import { RentalCalendarView } from './RentalCalendarView';

interface AdminBookingsTabProps {
  profile: UserProfile;
  bookings: RentalBooking[];
  vehicles: Vehicle[];
  currency?: string;
  initialViewMode?: 'list' | 'calendar';
  onRecordPaymentForBooking: (bookingId: string) => void;
}

export function AdminBookingsTab({
  profile,
  bookings,
  vehicles,
  currency = DEFAULT_CURRENCY,
  initialViewMode = 'list',
  onRecordPaymentForBooking,
}: AdminBookingsTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialViewMode);
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [inspectionInputs, setInspectionInputs] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contractBooking, setContractBooking] = useState<RentalBooking | null>(null);

  const conflictIds = useMemo(() => findBookingConflictIds(bookings), [bookings]);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const filtered = bookings.filter((b) =>
    statusFilter === 'ALL' ? true : b.status === statusFilter
  );

  const handleApprove = async (bookingId: string) => {
    setErrorMsg(null);
    try {
      await approveRentalBooking(bookingId, profile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Approval failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Rental Bookings & Fleet Calendar</h2>
          <p className="text-xs text-[#A6A6A6]">
            Approvals run inside database transactions to block overlapping bookings for the same vehicle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#171717] border border-[#353535] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                viewMode === 'list' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6]'
              }`}
            >
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer inline-flex items-center gap-1 ${
                viewMode === 'calendar' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | BookingStatus)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      {viewMode === 'calendar' ? (
        <RentalCalendarView
          bookings={bookings}
          vehicles={vehicles}
          profile={profile}
          currency={currency}
          onApproveBooking={handleApprove}
          onRejectBooking={async (bookingId) => {
            setErrorMsg(null);
            await transitionRentalBooking(bookingId, 'REJECTED', profile);
          }}
          onTransitionBooking={async (bookingId, nextStatus) => {
            setErrorMsg(null);
            await transitionRentalBooking(
              bookingId,
              nextStatus,
              profile,
              inspectionInputs[bookingId]
            );
          }}
          onRecordPayment={onRecordPaymentForBooking}
          onOpenContract={(b) => setContractBooking(b)}
        />
      ) : filtered.length === 0 ? (
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center text-sm text-[#A6A6A6]">
          No rental bookings match the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const outstanding = Math.max(0, b.totalAmountCents - (b.paidAmountCents || 0));
            const addonLabels = (b.additionalServices || []).map(
              (id) => RENTAL_ADDONS.find((a) => a.id === id)?.label || id
            );
            const hasConflict = conflictIds.has(b.id);

            return (
              <div
                key={b.id}
                className={`bg-[#202020] border rounded-2xl p-6 space-y-4 ${
                  hasConflict ? 'border-red-500/60' : 'border-[#353535]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#353535] pb-4">
                  <div>
                    <p className="text-xs font-mono text-[#A6A6A6]">
                      {b.bookingReference || `#${b.id.slice(0, 8).toUpperCase()}`}
                      {b.contractReference ? ` · ${b.contractReference}` : ''}
                    </p>
                    <h3 className="text-lg font-bold text-white">{b.vehicleName}</h3>
                    <p className="text-xs text-[#A6A6A6] mt-0.5">
                      Client: {b.customerName}
                      {b.customerPhone ? ` · ${b.customerPhone}` : ''}
                      {b.customerEmail ? ` (${b.customerEmail})` : ''} · {b.rentalMode}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasConflict && (
                      <span className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-xs font-bold text-red-300 inline-flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Overlap Conflict
                      </span>
                    )}
                    <span className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-bold text-white">
                      {b.status}
                    </span>

                    {b.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={hasConflict}
                          onClick={() => void handleApprove(b.id)}
                          title={
                            hasConflict
                              ? 'Blocked: overlaps an existing confirmed or active booking'
                              : 'Approve booking'
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void transitionRentalBooking(b.id, 'REJECTED', profile)}
                          className="px-3.5 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    {b.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() =>
                          void transitionRentalBooking(b.id, 'ACTIVE', profile, inspectionInputs[b.id])
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] text-xs font-bold cursor-pointer"
                      >
                        Mark Picked Up (Active)
                      </button>
                    )}

                    {b.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() =>
                          void transitionRentalBooking(b.id, 'COMPLETED', profile, inspectionInputs[b.id])
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] text-xs font-bold cursor-pointer"
                      >
                        Complete Return
                      </button>
                    )}

                    {(b.status === 'CONFIRMED' || b.status === 'ACTIVE') && (
                      <button
                        type="button"
                        onClick={() => void transitionRentalBooking(b.id, 'CANCELLED', profile)}
                        className="px-3.5 py-1.5 rounded-lg border border-[#353535] text-xs text-[#A6A6A6] hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRecordPaymentForBooking(b.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-[#20D94B] cursor-pointer"
                    >
                      Record Payment
                    </button>

                    {b.contractReference && (
                      <button
                        type="button"
                        onClick={() => setContractBooking(b)}
                        className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Contract
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#A6A6A6] block">Schedule ({b.days}d)</span>
                    <span className="font-mono tabular-nums text-white">
                      {b.pickupAt.slice(0, 10)} → {b.returnAt.slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A6A6A6] block">Total Amount</span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      {formatMoney(b.totalAmountCents, b.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A6A6A6] block">Paid</span>
                    <span className="font-mono tabular-nums font-bold text-[#20D94B]">
                      {formatMoney(b.paidAmountCents || 0, b.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A6A6A6] block">Outstanding</span>
                    <span className="font-mono tabular-nums font-bold text-amber-400">
                      {formatMoney(outstanding, b.currency)}
                    </span>
                  </div>
                </div>

                {(addonLabels.length > 0 || b.specialRequests) && (
                  <div className="text-xs text-[#A6A6A6] bg-[#171717] border border-[#353535] rounded-xl p-3 space-y-1">
                    {addonLabels.length > 0 && (
                      <p>
                        Additional Services ({formatMoney(b.additionalServicesCents || 0, b.currency)}):{' '}
                        <span className="text-white">{addonLabels.join(', ')}</span>
                      </p>
                    )}
                    {b.specialRequests && (
                      <p>
                        Special Requests: <span className="text-white">{b.specialRequests}</span>
                      </p>
                    )}
                  </div>
                )}

                {(b.status === 'CONFIRMED' || b.status === 'ACTIVE') && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={inspectionInputs[b.id] || ''}
                      onChange={(e) =>
                        setInspectionInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      placeholder={
                        b.status === 'CONFIRMED'
                          ? 'Pickup inspection note (fuel level, odometer, exterior check)...'
                          : 'Return inspection note (condition check, fuel, mileage)...'
                      }
                      className="w-full h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
                    />
                  </div>
                )}

                {(b.pickupInspectionNote || b.returnInspectionNote) && (
                  <div className="text-xs text-[#A6A6A6] space-y-1 pt-1">
                    {b.pickupInspectionNote && <p>Pickup Inspection: {b.pickupInspectionNote}</p>}
                    {b.returnInspectionNote && <p>Return Inspection: {b.returnInspectionNote}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Rental Contract Modal */}
      {contractBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#202020] border border-[#353535] rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#353535] pb-3">
              <h3 className="text-base font-bold text-white">
                Rental Contract {contractBooking.contractReference}
              </h3>
              <button
                type="button"
                onClick={() => setContractBooking(null)}
                className="text-[#A6A6A6] hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-[#A6A6A6]">
              <p><strong className="text-white">Booking Ref:</strong> {contractBooking.bookingReference}</p>
              <p><strong className="text-white">Vehicle:</strong> {contractBooking.vehicleName}</p>
              <p>
                <strong className="text-white">Customer:</strong> {contractBooking.customerName}{' '}
                {contractBooking.customerPhone ? `· ${contractBooking.customerPhone}` : ''}{' '}
                {contractBooking.customerEmail ? `(${contractBooking.customerEmail})` : ''}
              </p>
              <p><strong className="text-white">Pickup:</strong> {contractBooking.pickupAt.replace('T', ' ')} at {contractBooking.pickupLocation}</p>
              <p><strong className="text-white">Return:</strong> {contractBooking.returnAt.replace('T', ' ')} at {contractBooking.returnLocation}</p>
              <p><strong className="text-white">Mode:</strong> {contractBooking.rentalMode}</p>
              <p className="font-mono"><strong className="text-white">Additional Services:</strong> {formatMoney(contractBooking.additionalServicesCents || 0, contractBooking.currency)}</p>
              <p className="font-mono"><strong className="text-white">Contract Total:</strong> {formatMoney(contractBooking.totalAmountCents, contractBooking.currency)}</p>
              <p className="font-mono"><strong className="text-white">Required Deposit:</strong> {formatMoney(contractBooking.requiredDepositCents, contractBooking.currency)}</p>
              <p className="font-mono"><strong className="text-white">Recorded Payments:</strong> {formatMoney(contractBooking.paidAmountCents || 0, contractBooking.currency)}</p>
            </div>
            <div className="flex justify-end pt-3 border-t border-[#353535]">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#20D94B] text-[#080808] font-bold cursor-pointer"
              >
                Print Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
