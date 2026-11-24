import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Database, Plus } from 'lucide-react';
import { seedDemoShowroom } from '../../services/autosuiteService';
import type {
  BusinessSetting,
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  UserProfile,
  Vehicle,
} from '../../types/autosuite';
import { formatMoney } from '../../utils/money';

interface AdminOverviewTabProps {
  profile: UserProfile;
  setting: BusinessSetting;
  vehicles: Vehicle[];
  bookings: RentalBooking[];
  inquiries: SaleInquiry[];
  payments: RentalPayment[];
  users: UserProfile[];
  onNavigateTab: (tab: string) => void;
}

export function AdminOverviewTab({
  profile,
  setting,
  vehicles,
  bookings,
  inquiries,
  payments,
  users,
  onNavigateTab,
}: AdminOverviewTabProps) {
  const [seeding, setSeeding] = useState(false);

  const activeVehicles = vehicles.filter((v) => !v.archived);
  const availableVehicles = activeVehicles.filter((v) => v.available && v.published);
  const saleVehicles = activeVehicles.filter((v) => v.listingType === 'SALE' || v.listingType === 'BOTH');
  const rentalVehicles = activeVehicles.filter((v) => v.listingType === 'RENTAL' || v.listingType === 'BOTH');

  const pendingBookings = bookings.filter((b) => b.status === 'PENDING');
  const confirmedOrActive = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE');
  const newInquiries = inquiries.filter((i) => i.status === 'NEW');
  const customers = users.filter((u) => u.role === 'CUSTOMER');

  // Strict financial separation: Actual recorded payments vs Estimated booking contract values
  const actualPaymentsCents = payments.reduce((acc, p) => {
    return acc + (p.paymentType === 'REFUND' ? -p.amountCents : p.amountCents);
  }, 0);

  const estimatedContractValueCents = bookings
    .filter((b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE' || b.status === 'COMPLETED')
    .reduce((acc, b) => acc + b.totalAmountCents, 0);

  const bookingStatusData = [
    { status: 'Pending', count: bookings.filter((b) => b.status === 'PENDING').length },
    { status: 'Confirmed', count: bookings.filter((b) => b.status === 'CONFIRMED').length },
    { status: 'Active', count: bookings.filter((b) => b.status === 'ACTIVE').length },
    { status: 'Completed', count: bookings.filter((b) => b.status === 'COMPLETED').length },
    { status: 'Cancelled', count: bookings.filter((b) => b.status === 'CANCELLED').length },
  ];

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoShowroom(profile);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {activeVehicles.length === 0 && (
        <div className="bg-[#202020] border border-[#20D94B]/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Initialize Showroom Inventory</p>
            <p className="text-xs text-[#A6A6A6]">
              Your database is empty. Populate sample brands, categories, and 6 certified vehicles to test end-to-end workflows, or add your own vehicles manually.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeed}
            className="px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs inline-flex items-center gap-2 hover:brightness-110 transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            {seeding ? 'Seeding Database...' : 'Seed Sample Showroom'}
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-1">
          <p className="text-xs text-[#A6A6A6]">Active Fleet Inventory</p>
          <p className="text-3xl font-extrabold font-mono tabular-nums text-white">{activeVehicles.length}</p>
          <p className="text-xs text-[#A6A6A6] tabular-nums">
            {availableVehicles.length} live · {saleVehicles.length} sale · {rentalVehicles.length} rental
          </p>
        </div>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-1">
          <p className="text-xs text-[#A6A6A6]">Rental Pipeline</p>
          <p className="text-3xl font-extrabold font-mono tabular-nums text-amber-400">{pendingBookings.length}</p>
          <p className="text-xs text-[#A6A6A6] tabular-nums">
            pending · {confirmedOrActive.length} confirmed / active
          </p>
        </div>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-1">
          <p className="text-xs text-[#A6A6A6]">Actual Recorded Payments</p>
          <p className="text-3xl font-extrabold font-mono tabular-nums text-[#20D94B]">
            {formatMoney(actualPaymentsCents, setting.currency)}
          </p>
          <p className="text-xs text-[#A6A6A6] tabular-nums">
            Contracted value: {formatMoney(estimatedContractValueCents, setting.currency)}
          </p>
        </div>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-1">
          <p className="text-xs text-[#A6A6A6]">Customers & Inquiries</p>
          <p className="text-3xl font-extrabold font-mono tabular-nums text-white">{customers.length}</p>
          <p className="text-xs text-[#A6A6A6] tabular-nums">
            {newInquiries.length} new sales inquiries ({inquiries.length} total)
          </p>
        </div>
      </div>

      {/* Quick Actions & Booking Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Booking Lifecycle Distribution</h2>
            <span className="text-xs text-[#A6A6A6] font-mono tabular-nums">
              {bookings.length} total records
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#353535" vertical={false} />
                <XAxis dataKey="status" stroke="#A6A6A6" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#A6A6A6" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    border: '1px solid #353535',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" fill="#20D94B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white">Quick Operations</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('vehicles')}
              className="p-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#20D94B] flex items-center justify-between text-left transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-white">Add or Publish Vehicle</p>
                <p className="text-xs text-[#A6A6A6]">Manage fleet specs, pricing, and photos</p>
              </div>
              <Plus className="w-4 h-4 text-[#20D94B]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="p-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#20D94B] flex items-center justify-between text-left transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-white">Review Pending Bookings ({pendingBookings.length})</p>
                <p className="text-xs text-[#A6A6A6]">Approve with atomic conflict checking</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#20D94B]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('payments')}
              className="p-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#20D94B] flex items-center justify-between text-left transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-white">Record Manual Payment</p>
                <p className="text-xs text-[#A6A6A6]">Log cash, bank transfer, or security deposits</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#20D94B]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="p-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#20D94B] flex items-center justify-between text-left transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-white">Export Financial & Fleet Reports</p>
                <p className="text-xs text-[#A6A6A6]">Download CSV ledgers and analytics</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#20D94B]" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Bookings & Inquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Recent Rental Bookings</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="text-xs text-[#20D94B] font-semibold cursor-pointer"
            >
              Manage All
            </button>
          </div>
          {bookings.length === 0 ? (
            <p className="text-xs text-[#A6A6A6]">No rental bookings recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {bookings.slice(0, 5).map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{b.vehicleName}</p>
                    <p className="text-xs text-[#A6A6A6] truncate font-mono">
                      {b.bookingReference || `#${b.id.slice(0, 6).toUpperCase()}`} · {b.customerName} · {b.pickupAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-white">{b.status}</p>
                    <p className="text-xs font-mono tabular-nums text-[#20D94B]">{formatMoney(b.totalAmountCents, b.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Recent Sales Inquiries</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('inquiries')}
              className="text-xs text-[#20D94B] font-semibold cursor-pointer"
            >
              Manage All
            </button>
          </div>
          {inquiries.length === 0 ? (
            <p className="text-xs text-[#A6A6A6]">No sales inquiries submitted yet.</p>
          ) : (
            <div className="space-y-2.5">
              {inquiries.slice(0, 5).map((inq) => (
                <div key={inq.id} className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{inq.vehicleName}</p>
                    <p className="text-xs text-[#A6A6A6] truncate font-mono">
                      {inq.inquiryReference || `#${inq.id.slice(0, 6).toUpperCase()}`} · {inq.customerName}
                      {inq.preferredBudgetCents ? ` · ${formatMoney(inq.preferredBudgetCents, inq.currency || setting.currency)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#20D94B] shrink-0">
                    {inq.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
