import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import type {
  BusinessSetting,
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  UserProfile,
  Vehicle,
} from '../../types/autosuite';
import { formatMoney } from '../../utils/money';

interface AdminReportsTabProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  bookings: RentalBooking[];
  payments: RentalPayment[];
  inquiries: SaleInquiry[];
  users: UserProfile[];
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminReportsTab({
  setting,
  vehicles,
  bookings,
  payments,
  inquiries,
  users,
}: AdminReportsTabProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportType, setReportType] = useState<'revenue' | 'inventory' | 'bookings' | 'inquiries' | 'customers'>('revenue');

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (fromDate && p.paidAt < fromDate) return false;
      if (toDate && p.paidAt > toDate) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = b.pickupAt.slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [bookings, fromDate, toDate]);

  const paymentTrend = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((p) => {
      const delta = p.paymentType === 'REFUND' ? -p.amountCents : p.amountCents;
      map.set(p.paidAt, (map.get(p.paidAt) || 0) + delta);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cents]) => ({ date, amount: cents / 100 }));
  }, [filteredPayments]);

  const handleExport = () => {
    if (reportType === 'inventory') {
      downloadCsv(
        'autosuite-inventory-report.csv',
        ['Name', 'Brand', 'Category', 'Year', 'ListingType', 'SalePrice', 'DailyRental', 'Available', 'Published'],
        vehicles.map((v) => [
          v.name,
          v.brand,
          v.category,
          v.year,
          v.listingType,
          formatMoney(v.salePriceCents, setting.currency),
          formatMoney(v.rentalPricePerDayCents, setting.currency),
          String(v.available),
          String(v.published),
        ])
      );
    } else if (reportType === 'bookings') {
      downloadCsv(
        'autosuite-bookings-report.csv',
        ['BookingRef', 'BookingID', 'Customer', 'Phone', 'Vehicle', 'Pickup', 'Return', 'Days', 'Total', 'Paid', 'Status'],
        filteredBookings.map((b) => [
          b.bookingReference || '',
          b.id,
          b.customerName,
          b.customerPhone || '',
          b.vehicleName,
          b.pickupAt,
          b.returnAt,
          b.days,
          formatMoney(b.totalAmountCents, b.currency),
          formatMoney(b.paidAmountCents || 0, b.currency),
          b.status,
        ])
      );
    } else if (reportType === 'inquiries') {
      downloadCsv(
        'autosuite-inquiries-report.csv',
        ['InquiryRef', 'Vehicle', 'Customer', 'Phone', 'Email', 'Budget', 'PaymentMethod', 'Timeline', 'NeedsFinancing', 'Status', 'AssignedAdvisor'],
        inquiries.map((i) => [
          i.inquiryReference || '',
          i.vehicleName,
          i.customerName,
          i.customerPhone || '',
          i.customerEmail || '',
          formatMoney(i.preferredBudgetCents || 0, i.currency || setting.currency),
          i.preferredPaymentMethod,
          i.purchaseTimeline,
          String(i.needsFinancing),
          i.status,
          i.assignedStaffName || 'Unassigned',
        ])
      );
    } else if (reportType === 'customers') {
      downloadCsv(
        'autosuite-customers-report.csv',
        ['Name', 'Email', 'Phone', 'Role', 'Active'],
        users
          .filter((u) => u.role === 'CUSTOMER')
          .map((u) => [u.fullName, u.email, u.phone || '', u.role, String(u.active)])
      );
    } else {
      downloadCsv(
        'autosuite-payments-report.csv',
        ['Date', 'Customer', 'Type', 'Method', 'Reference', 'Amount'],
        filteredPayments.map((p) => [
          p.paidAt,
          p.customerName,
          p.paymentType,
          p.method,
          p.reference,
          formatMoney(p.amountCents, p.currency),
        ])
      );
    }
  };

  const totalCollected = filteredPayments.reduce(
    (sum, p) => sum + (p.paymentType === 'REFUND' ? -p.amountCents : p.amountCents),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Reports & Analytics</h2>
          <p className="text-xs text-[#A6A6A6]">
            All figures are computed directly from persisted Firestore records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as typeof reportType)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          >
            <option value="revenue">Payments & Revenue Report</option>
            <option value="inventory">Vehicle Inventory Report</option>
            <option value="bookings">Rental Bookings Report</option>
            <option value="inquiries">Sales Inquiries Report</option>
            <option value="customers">Customer Report</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />

          <button
            type="button"
            onClick={handleExport}
            className="h-10 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Recorded Payments (Filtered)</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#20D94B] mt-1">
            {formatMoney(totalCollected, setting.currency)}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Filtered Bookings</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {filteredBookings.length}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Published Fleet</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {vehicles.filter((v) => v.published && !v.archived).length}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Total Inquiries</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {inquiries.length}
          </p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Recorded Payment Timeline</h3>
        {paymentTrend.length === 0 ? (
          <p className="text-xs text-[#A6A6A6] py-10 text-center">
            No recorded payments in this date range to plot.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paymentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#353535" vertical={false} />
                <XAxis dataKey="date" stroke="#A6A6A6" fontSize={12} />
                <YAxis stroke="#A6A6A6" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    border: '1px solid #353535',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="amount" stroke="#20D94B" fill="#20D94B" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
