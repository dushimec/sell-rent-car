import { useMemo, useState } from 'react';
import { updateSaleInquiry } from '../../services/salesService';
import type {
  InquiryStatus,
  SaleInquiry,
  UserProfile,
  Vehicle,
} from '../../types/autosuite';
import { DEFAULT_CURRENCY, formatMoney } from '../../utils/money';

interface AdminInquiriesTabProps {
  profile: UserProfile;
  inquiries: SaleInquiry[];
  users: UserProfile[];
  vehicles: Vehicle[];
  currency?: string;
}

const STATUS_OPTIONS: Array<{ value: InquiryStatus; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'INSPECTION_SCHEDULED', label: 'Inspection Scheduled' },
  { value: 'OFFER_SENT', label: 'Offer Sent' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'CLOSED_UNSUCCESSFUL', label: 'Closed / Unsuccessful' },
];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash / Wire',
  BANK_FINANCING: 'Bank Financing',
  OTHER: 'Other',
};

const TIMELINE_LABELS: Record<string, string> = {
  IMMEDIATELY: 'Immediately',
  WITHIN_ONE_MONTH: 'Within 1 Month',
  WITHIN_THREE_MONTHS: 'Within 3 Months',
  LATER: 'Later',
};

export function AdminInquiriesTab({
  profile,
  inquiries,
  users,
  vehicles,
  currency = DEFAULT_CURRENCY,
}: AdminInquiriesTabProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | InquiryStatus>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const staffUsers = users.filter(
    (u) => u.role === 'STAFF' || u.role === 'BUSINESS_ADMIN' || u.role === 'SUPER_ADMIN'
  );

  const uniqueVehicles = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((v) => {
      if (v.listingType === 'SALE' || v.listingType === 'BOTH') {
        map.set(v.id, v.name);
      }
    });
    inquiries.forEach((i) => {
      if (!map.has(i.vehicleId)) map.set(i.vehicleId, i.vehicleName);
    });
    return Array.from(map.entries());
  }, [vehicles, inquiries]);

  const filtered = inquiries.filter((i) => {
    if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
    if (vehicleFilter !== 'ALL' && i.vehicleId !== vehicleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (i.inquiryReference || '').toLowerCase().includes(q) ||
        i.vehicleName.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        (i.customerPhone || '').toLowerCase().includes(q) ||
        (i.customerEmail || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Car Sales Inquiries</h2>
          <p className="text-xs text-[#A6A6A6]">
            Review buyer requirements, assign sales advisors, schedule inspections, and close deals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, buyer, phone..."
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
          />
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
          >
            <option value="ALL">All Vehicles</option>
            {uniqueVehicles.map(([vid, vname]) => (
              <option key={vid} value={vid}>
                {vname}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | InquiryStatus)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center text-sm text-[#A6A6A6]">
          No purchase inquiries match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inq) => (
            <div key={inq.id} className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#353535] pb-4">
                <div>
                  <p className="text-xs font-mono text-[#A6A6A6]">
                    {inq.inquiryReference || `#${inq.id.slice(0, 8).toUpperCase()}`} · {inq.customerName}
                    {inq.customerPhone ? ` · ${inq.customerPhone}` : ''}
                    {inq.customerEmail ? ` · ${inq.customerEmail}` : ''}
                  </p>
                  <h3 className="text-base font-bold text-white mt-0.5">{inq.vehicleName}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={inq.assignedStaffId || ''}
                    onChange={(e) => {
                      const staff = staffUsers.find((s) => s.uid === e.target.value);
                      void updateSaleInquiry(
                        inq.id,
                        {
                          assignedStaffId: staff?.uid || '',
                          assignedStaffName: staff?.fullName || '',
                        },
                        profile
                      );
                    }}
                    className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
                  >
                    <option value="">Unassigned Advisor</option>
                    {staffUsers.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={inq.status}
                    onChange={(e) =>
                      void updateSaleInquiry(
                        inq.id,
                        { status: e.target.value as InquiryStatus },
                        profile
                      )
                    }
                    className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs font-bold text-[#20D94B]"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={inq.followUpDate || ''}
                    onChange={(e) =>
                      void updateSaleInquiry(inq.id, { followUpDate: e.target.value }, profile)
                    }
                    className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
                    title="Follow-up date"
                  />

                  {inq.status !== 'SOLD' && inq.status !== 'CLOSED_UNSUCCESSFUL' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void updateSaleInquiry(inq.id, { status: 'SOLD' }, profile)}
                        className="h-9 px-3 rounded-lg bg-[#20D94B] text-[#080808] text-xs font-bold cursor-pointer"
                      >
                        Mark Sold
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateSaleInquiry(
                            inq.id,
                            { status: 'CLOSED_UNSUCCESSFUL' },
                            profile
                          )
                        }
                        className="h-9 px-3 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold cursor-pointer"
                      >
                        Close Lost
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Buyer Requirements Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs">
                <div>
                  <span className="text-[#A6A6A6] block">Preferred Budget</span>
                  <span className="font-mono tabular-nums font-bold text-[#20D94B]">
                    {inq.preferredBudgetCents
                      ? formatMoney(inq.preferredBudgetCents, inq.currency || currency)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#A6A6A6] block">Payment Method</span>
                  <span className="text-white font-semibold">
                    {PAYMENT_LABELS[inq.preferredPaymentMethod] || inq.preferredPaymentMethod}
                  </span>
                </div>
                <div>
                  <span className="text-[#A6A6A6] block">Timeline</span>
                  <span className="text-white font-semibold">
                    {TIMELINE_LABELS[inq.purchaseTimeline] || inq.purchaseTimeline}
                  </span>
                </div>
                <div>
                  <span className="text-[#A6A6A6] block">Needs Financing</span>
                  <span className="text-white font-semibold">
                    {inq.needsFinancing ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-[#A6A6A6] block">Inspection Date</span>
                  <span className="font-mono text-white">
                    {inq.preferredInspectionDate || 'Not specified'}
                  </span>
                </div>
              </div>

              {inq.message && <p className="text-sm text-[#A6A6A6]">{inq.message}</p>}

              {/* Internal Notes & Follow-Up Log */}
              <div className="space-y-2 pt-1">
                {inq.notes.length > 0 && (
                  <div className="space-y-1.5">
                    {inq.notes.map((n) => (
                      <div key={n.id} className="text-xs bg-[#171717] px-3 py-2 rounded-lg text-[#A6A6A6]">
                        <span className="text-white font-semibold">{n.authorName}:</span> {n.content}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteInputs[inq.id] || ''}
                    onChange={(e) =>
                      setNoteInputs((prev) => ({ ...prev, [inq.id]: e.target.value }))
                    }
                    placeholder="Record follow-up or internal negotiation note..."
                    className="flex-1 h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = noteInputs[inq.id];
                      if (!val?.trim()) return;
                      void updateSaleInquiry(
                        inq.id,
                        { newNote: val, existingNotes: inq.notes },
                        profile
                      );
                      setNoteInputs((prev) => ({ ...prev, [inq.id]: '' }));
                    }}
                    className="px-4 h-9 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] cursor-pointer"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
