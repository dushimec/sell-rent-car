import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CarFront,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Heart,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MailCheck,
  MapPin,
  Menu,
  Phone,
  Send,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { VehicleCard } from '../components/VehicleCard';
import { VehicleImage } from '../components/VehicleImage';
import { useAuth } from '../context/AuthContext';
import {
  markAllNotificationsRead,
  markNotificationRead,
  submitSupportRequest,
  toggleFavorite,
  updateOwnProfile,
} from '../services/autosuiteService';
import { cancelOwnPendingBooking } from '../services/rentalService';
import type {
  BookingStatus,
  BusinessSetting,
  Favorite,
  InquiryStatus,
  NotificationItem,
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  SupportCategory,
  SupportRequest,
  Vehicle,
} from '../types/autosuite';
import { formatMoney } from '../utils/money';
import { RENTAL_ADDONS } from '../utils/rentalCalc';

interface CustomerPortalPageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  favorites: Favorite[];
  bookings: RentalBooking[];
  inquiries: SaleInquiry[];
  payments: RentalPayment[];
  notifications: NotificationItem[];
  supportRequests: SupportRequest[];
}

type PortalTab =
  | 'overview'
  | 'bookings'
  | 'purchase-inquiries'
  | 'favorites'
  | 'payments'
  | 'notifications'
  | 'profile'
  | 'support';

const TIMELINE_LABELS: Record<string, string> = {
  IMMEDIATELY: 'Immediately',
  WITHIN_ONE_MONTH: 'Within One Month',
  WITHIN_THREE_MONTHS: 'Within Three Months',
  LATER: 'Later / Exploring',
};

const PAYMENT_PREF_LABELS: Record<string, string> = {
  CASH: 'Cash / Wire Transfer',
  BANK_FINANCING: 'Bank Financing',
  OTHER: 'Other Method',
};

const RENTAL_STEPS: BookingStatus[] = ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED'];
const RENTAL_STEP_LABELS: Record<string, string> = {
  PENDING: 'Submitted',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

const INQUIRY_STEPS: InquiryStatus[] = [
  'NEW',
  'CONTACTED',
  'NEGOTIATING',
  'INSPECTION_SCHEDULED',
  'OFFER_SENT',
  'SOLD',
];
const INQUIRY_STEP_LABELS: Record<InquiryStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  NEGOTIATING: 'Negotiating',
  INSPECTION_SCHEDULED: 'Inspection',
  OFFER_SENT: 'Offer Sent',
  SOLD: 'Sold',
  CLOSED_UNSUCCESSFUL: 'Closed',
};

const PORTAL_FAQS = [
  {
    q: 'How do I modify or cancel a pending rental request?',
    a: 'Pending rental bookings that have not yet been approved can be cancelled directly from My Rental Bookings. Once confirmed, please submit a support request with your booking reference.',
  },
  {
    q: 'Are car purchase inquiries binding contracts?',
    a: 'No. Submitting a purchase inquiry assigns a dedicated advisor to review your budget, preferred payment method, and inspection schedule before any offer is finalized.',
  },
  {
    q: 'How are rental security deposits calculated and refunded?',
    a: 'Security deposits represent a fixed percentage of your rental quote and are recorded transparently in Payments upon desk verification, then refunded after return inspection.',
  },
];

function formatDateValue(raw: unknown): string {
  if (!raw) return 'Recently';
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate().toLocaleDateString(undefined, {
        dateStyle: 'medium',
      });
    } catch {
      return 'Recently';
    }
  }
  return 'Recently';
}

function extractTimestampMs(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === 'string') {
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function CustomerPortalPage({
  setting,
  vehicles,
  favorites,
  bookings,
  inquiries,
  payments,
  notifications,
  supportRequests,
}: CustomerPortalPageProps) {
  const {
    firebaseUser,
    profile,
    loading,
    isEmailVerified,
    isGoogleLinked,
    isPasswordLinked,
    linkGoogleAccount,
    requestPasswordReset,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const resolveTabFromPath = (pathname: string): PortalTab => {
    if (pathname.endsWith('/bookings')) return 'bookings';
    if (pathname.endsWith('/purchase-inquiries') || pathname.endsWith('/inquiries')) {
      return 'purchase-inquiries';
    }
    if (pathname.endsWith('/favorites')) return 'favorites';
    if (pathname.endsWith('/payments')) return 'payments';
    if (pathname.endsWith('/notifications')) return 'notifications';
    if (pathname.endsWith('/profile')) return 'profile';
    if (pathname.endsWith('/support')) return 'support';
    return 'overview';
  };

  const [tab, setTab] = useState<PortalTab>(() => resolveTabFromPath(location.pathname));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Rental cancellation modal state
  const [bookingToCancel, setBookingToCancel] = useState<RentalBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Favorites filter
  const [favFilter, setFavFilter] = useState<'ALL' | 'SALE' | 'RENTAL'>('ALL');

  // Notifications filter
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [license, setLicense] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resetSentMessage, setResetSentMessage] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);

  // Support state
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState<SupportCategory>('GENERAL');
  const [supportRelatedRef, setSupportRelatedRef] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSubmittedId, setSupportSubmittedId] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useEffect(() => {
    setTab(resolveTabFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const refParam = searchParams.get('ref');
    const catParam = searchParams.get('category');
    if (refParam) setSupportRelatedRef(refParam);
    if (
      catParam === 'BOOKING' ||
      catParam === 'PURCHASE' ||
      catParam === 'PAYMENT' ||
      catParam === 'ACCOUNT' ||
      catParam === 'GENERAL'
    ) {
      setSupportCategory(catParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && (!profile || !isEmailVerified)) {
      const target = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=account`, {
        replace: true,
      });
    }
  }, [loading, profile, isEmailVerified, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setLicense(profile.driverLicenseNo || '');
    }
  }, [profile]);

  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const favMap = useMemo(() => new Map(favorites.map((f) => [f.vehicleId, f.id])), [favorites]);
  const bookingMap = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const favoriteVehicles = useMemo(
    () => vehicles.filter((v) => favorites.some((f) => f.vehicleId === v.id)),
    [vehicles, favorites]
  );

  const filteredFavoriteVehicles = useMemo(() => {
    return favoriteVehicles.filter((v) => {
      if (favFilter === 'SALE') return v.listingType === 'SALE' || v.listingType === 'BOTH';
      if (favFilter === 'RENTAL') return v.listingType === 'RENTAL' || v.listingType === 'BOTH';
      return true;
    });
  }, [favoriteVehicles, favFilter]);

  const recentActivity = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      status: string;
      ts: number;
      dateLabel: string;
      link: string;
      kind: 'BOOKING' | 'INQUIRY' | 'PAYMENT' | 'SUPPORT';
    }> = [];

    for (const b of bookings) {
      items.push({
        id: `b-${b.id}`,
        title: `Rental Booking ${b.bookingReference}`,
        subtitle: `${b.vehicleName} · ${b.pickupAt.slice(0, 10)} (${b.days} days)`,
        status: b.status,
        ts: extractTimestampMs(b.createdAt) || extractTimestampMs(b.pickupAt),
        dateLabel: formatDateValue(b.createdAt || b.pickupAt),
        link: '/account/bookings',
        kind: 'BOOKING',
      });
    }

    for (const inq of inquiries) {
      items.push({
        id: `i-${inq.id}`,
        title: `Purchase Inquiry ${inq.inquiryReference}`,
        subtitle: `${inq.vehicleName} · Budget ${formatMoney(inq.preferredBudgetCents, inq.currency || setting.currency)}`,
        status: inq.status.replace(/_/g, ' '),
        ts: extractTimestampMs(inq.createdAt),
        dateLabel: formatDateValue(inq.createdAt),
        link: '/account/purchase-inquiries',
        kind: 'INQUIRY',
      });
    }

    for (const p of payments) {
      const b = bookingMap.get(p.bookingId);
      items.push({
        id: `p-${p.id}`,
        title: `Payment ${p.reference || p.id.slice(0, 8).toUpperCase()}`,
        subtitle: `${b?.vehicleName || 'Rental Ledger'} · ${formatMoney(p.amountCents, p.currency)}`,
        status: p.paymentType.replace(/_/g, ' '),
        ts: extractTimestampMs(p.paidAt) || extractTimestampMs(p.createdAt),
        dateLabel: formatDateValue(p.paidAt || p.createdAt),
        link: '/account/payments',
        kind: 'PAYMENT',
      });
    }

    for (const sr of supportRequests) {
      items.push({
        id: `s-${sr.id}`,
        title: `Support Ticket: ${sr.subject}`,
        subtitle: `${sr.category} · ${sr.relatedRef || 'General Concierge'}`,
        status: sr.status.replace(/_/g, ' '),
        ts: extractTimestampMs(sr.createdAt),
        dateLabel: formatDateValue(sr.createdAt),
        link: '/account/support',
        kind: 'SUPPORT',
      });
    }

    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [bookings, inquiries, payments, supportRequests, bookingMap, setting.currency]);

  if (!profile || !isEmailVerified) return null;

  const selectTab = (next: PortalTab) => {
    setTab(next);
    setMobileNavOpen(false);
    navigate(next === 'overview' ? '/account' : `/account/${next}`);
  };

  const pendingBookingsCount = bookings.filter((b) => b.status === 'PENDING').length;
  const activeRentalsCount = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE'
  ).length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const totalOutstandingCents = bookings
    .filter((b) => b.status !== 'CANCELLED' && b.status !== 'REJECTED')
    .reduce((acc, b) => acc + Math.max(0, b.totalAmountCents - (b.paidAmountCents || 0)), 0);

  const totalPaidCents = payments.reduce((acc, p) => {
    if (p.paymentType === 'REFUND') return acc - p.amountCents;
    return acc + p.amountCents;
  }, 0);

  const initials = profile.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'C';

  const navItems: Array<{
    id: PortalTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'My Rental Bookings', icon: Calendar, badge: bookings.length },
    {
      id: 'purchase-inquiries',
      label: 'My Purchase Inquiries',
      icon: ShoppingBag,
      badge: inquiries.length,
    },
    { id: 'favorites', label: 'Saved Vehicles', icon: Heart, badge: favoriteVehicles.length },
    { id: 'payments', label: 'Payments', icon: CreditCard, badge: payments.length },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'support', label: 'Help & Support', icon: LifeBuoy },
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateOwnProfile(profile.uid, {
        fullName,
        phone,
        address,
        driverLicenseNo: license,
      });

      const idToken = await firebaseUser?.getIdToken().catch(() => null);
      if (idToken) {
        await fetch('/api/customer/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            driverLicenseNo: license.trim(),
          }),
        }).catch(() => undefined);
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    setCancellingBooking(true);
    try {
      await cancelOwnPendingBooking(bookingToCancel, profile);
      setBookingToCancel(null);
    } finally {
      setCancellingBooking(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarkingAllRead(true);
    try {
      await markAllNotificationsRead(unreadIds);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportError(null);
    setSupportSubmittedId(null);

    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportError('Please enter a subject and message for our concierge team.');
      return;
    }

    setSupportSubmitting(true);
    try {
      const id = await submitSupportRequest(
        {
          subject: supportSubject,
          category: supportCategory,
          relatedRef: supportRelatedRef,
          message: supportMessage,
        },
        profile
      );
      setSupportSubmittedId(id);
      setSupportSubject('');
      setSupportRelatedRef('');
      setSupportMessage('');
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : 'Unable to send support request.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  const handleTriggerPasswordReset = async () => {
    setResetSending(true);
    setResetSentMessage(null);
    try {
      await requestPasswordReset(profile.email);
      setResetSentMessage(
        `Password reset instructions have been sent to ${profile.email}.`
      );
    } finally {
      setResetSending(false);
    }
  };

  const displayedNotifications =
    notifFilter === 'UNREAD' ? notifications.filter((n) => !n.read) : notifications;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between gap-6">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] flex items-center gap-3">
          {firebaseUser?.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={profile.fullName}
              className="w-10 h-10 rounded-full object-cover border border-[#353535] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#20D94B]/15 border border-[#20D94B]/40 text-[#20D94B] font-extrabold text-sm flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile.fullName}</p>
            <p className="text-[11px] text-[#A6A6A6] truncate">{profile.email}</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
                  active
                    ? 'bg-[#20D94B] text-[#080808]'
                    : 'text-[#A6A6A6] hover:bg-[#1B1B1B] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums shrink-0 ${
                      active
                        ? 'bg-[#080808]/20 text-[#080808]'
                        : item.id === 'notifications'
                          ? 'bg-[#20D94B]/20 text-[#20D94B]'
                          : 'bg-[#171717] text-[#A6A6A6]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="w-full px-3.5 py-2.5 rounded-xl bg-[#171717] border border-[#353535] text-xs font-semibold text-[#A6A6A6] hover:text-white hover:border-red-500/40 inline-flex items-center justify-center gap-2 cursor-pointer transition"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 overflow-x-hidden">
      {/* Portal Top Bar */}
      <div className="bg-[#1B1B1B] border border-[#353535] rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Toggle portal menu"
            className="lg:hidden p-2.5 rounded-xl bg-[#171717] border border-[#353535] text-white cursor-pointer shrink-0"
          >
            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#20D94B]">
              {setting.businessName} · Client Portal
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white truncate">
              Welcome back, {profile.fullName}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => selectTab('notifications')}
            className="h-10 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] inline-flex items-center gap-2 cursor-pointer"
          >
            <Bell className="w-4 h-4 text-[#20D94B]" />
            <span>Alerts</span>
            {unreadNotifs > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#20D94B] text-[#080808] font-mono text-[11px] font-bold">
                {unreadNotifs}
              </span>
            )}
          </button>
          <Link
            to="/sales"
            className="h-10 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs inline-flex items-center whitespace-nowrap shrink-0 hover:brightness-110 transition"
          >
            Cars for Sale
          </Link>
          <Link
            to="/rentals"
            className="h-10 px-4 rounded-xl bg-[#202020] border border-[#353535] text-white font-bold text-xs inline-flex items-center whitespace-nowrap shrink-0 hover:border-[#20D94B] transition"
          >
            Cars for Rent
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden mb-6 bg-[#202020] border border-[#353535] rounded-2xl p-4">
          {sidebarContent}
        </div>
      )}

      {/* Main Split: Desktop Sidebar Left + Content Area Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24 bg-[#202020] border border-[#353535] rounded-2xl p-4">
          {sidebarContent}
        </aside>

        <div className="lg:col-span-9 min-w-0 space-y-6">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Welcome back, {profile.fullName}
                  </h2>
                  <p className="text-sm text-[#A6A6A6] mt-1">
                    Your automotive journey, all in one place.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#A6A6A6]">
                  Currency: <strong className="text-white">{setting.currency}</strong>
                </span>
              </div>

              {/* 6 Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Total Rental Bookings</p>
                  <p className="text-3xl font-extrabold font-mono tabular-nums text-white mt-2">
                    {bookings.length}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Active Rentals</p>
                  <p className="text-3xl font-extrabold font-mono tabular-nums text-[#20D94B] mt-2">
                    {activeRentalsCount}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Pending Booking Requests</p>
                  <p className="text-3xl font-extrabold font-mono tabular-nums text-amber-400 mt-2">
                    {pendingBookingsCount}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Purchase Inquiries</p>
                  <p className="text-3xl font-extrabold font-mono tabular-nums text-white mt-2">
                    {inquiries.length}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Saved Vehicles</p>
                  <p className="text-3xl font-extrabold font-mono tabular-nums text-white mt-2">
                    {favoriteVehicles.length}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Outstanding Rental Balance</p>
                  <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-2 truncate">
                    {formatMoney(totalOutstandingCents, setting.currency)}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Link
                  to="/sales"
                  className="p-4 rounded-2xl bg-[#202020] border border-[#353535] hover:border-[#20D94B] transition flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Explore Cars for Sale</p>
                    <p className="text-[11px] text-[#A6A6A6] mt-0.5">Browse purchase inventory</p>
                  </div>
                  <ShoppingBag className="w-4 h-4 text-[#20D94B] shrink-0" />
                </Link>
                <Link
                  to="/rentals"
                  className="p-4 rounded-2xl bg-[#202020] border border-[#353535] hover:border-[#20D94B] transition flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Explore Cars for Rent</p>
                    <p className="text-[11px] text-[#A6A6A6] mt-0.5">Check fleet dates</p>
                  </div>
                  <CarFront className="w-4 h-4 text-[#20D94B] shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => selectTab('bookings')}
                  className="p-4 rounded-2xl bg-[#202020] border border-[#353535] hover:border-[#20D94B] transition flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-white">View My Bookings</p>
                    <p className="text-[11px] text-[#A6A6A6] mt-0.5">Rental status &amp; contracts</p>
                  </div>
                  <Calendar className="w-4 h-4 text-[#20D94B] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('favorites')}
                  className="p-4 rounded-2xl bg-[#202020] border border-[#353535] hover:border-[#20D94B] transition flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-white">View Saved Vehicles</p>
                    <p className="text-[11px] text-[#A6A6A6] mt-0.5">
                      {favoriteVehicles.length} saved
                    </p>
                  </div>
                  <Heart className="w-4 h-4 text-[#20D94B] shrink-0" />
                </button>
              </div>

              {/* Recent Activity Timeline */}
              <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                  <span className="text-xs text-[#A6A6A6]">Live account ledger</span>
                </div>

                {recentActivity.length === 0 ? (
                  <p className="text-sm text-[#A6A6A6]">
                    No account activity yet. Explore Cars for Sale or Cars for Rent to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((act) => (
                      <Link
                        key={act.id}
                        to={act.link}
                        className="p-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#20D94B]/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#202020] border border-[#353535] text-[#20D94B]">
                              {act.kind}
                            </span>
                            <span className="text-[11px] text-[#A6A6A6]">{act.dateLabel}</span>
                          </div>
                          <p className="text-sm font-bold text-white mt-1 truncate">{act.title}</p>
                          <p className="text-xs text-[#A6A6A6] truncate">{act.subtitle}</p>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0">
                          {act.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MY RENTAL BOOKINGS */}
          {tab === 'bookings' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">My Rental Bookings</h2>
                  <p className="text-xs text-[#A6A6A6]">
                    Track schedule approvals, security deposits, contracts, and active rentals.
                  </p>
                </div>
                <Link
                  to="/rentals"
                  className="px-4 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs"
                >
                  Browse Cars for Rent
                </Link>
              </div>

              {bookings.length === 0 ? (
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center space-y-4">
                  <p className="text-base font-bold text-white">
                    You haven&apos;t booked a vehicle yet.
                  </p>
                  <p className="text-sm text-[#A6A6A6]">
                    Select any vehicle from Cars for Rent to request dates and receive a quote.
                  </p>
                  <Link
                    to="/rentals"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs"
                  >
                    Explore Cars for Rent
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                bookings.map((b) => {
                  const vehicle = vehicleMap.get(b.vehicleId);
                  const bookingPayments = payments.filter((p) => p.bookingId === b.id);
                  const outstandingCents = Math.max(0, b.totalAmountCents - (b.paidAmountCents || 0));
                  const addonLabels = (b.additionalServices || []).map(
                    (id) => RENTAL_ADDONS.find((a) => a.id === id)?.label || id
                  );
                  const activeStepIdx = RENTAL_STEPS.indexOf(b.status);
                  const isTerminalNegative = b.status === 'CANCELLED' || b.status === 'REJECTED';

                  return (
                    <div
                      key={b.id}
                      className="bg-[#202020] border border-[#353535] rounded-2xl p-5 sm:p-6 space-y-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#353535] pb-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-24 h-16 rounded-xl overflow-hidden bg-[#171717] border border-[#353535] shrink-0">
                            {vehicle ? (
                              <VehicleImage
                                src={vehicle.mainImage || vehicle.images[0]}
                                alt={b.vehicleName}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#A6A6A6]">
                                <CarFront className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-[#A6A6A6] font-mono">
                              Ref: {b.bookingReference || `#${b.id.slice(0, 8).toUpperCase()}`}
                              {b.contractReference ? ` · Contract ${b.contractReference}` : ''}
                            </p>
                            <h3 className="text-lg font-bold text-white mt-0.5 truncate">
                              {b.vehicleName}
                            </h3>
                            <p className="text-xs text-[#A6A6A6] mt-0.5 truncate">
                              {b.pickupLocation} → {b.returnLocation} ·{' '}
                              {b.rentalMode === 'CHAUFFEUR' ? 'Chauffeur-Driven' : 'Self-Drive'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <span
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg bg-[#171717] border ${
                              b.status === 'COMPLETED' || b.status === 'ACTIVE'
                                ? 'border-[#20D94B]/50 text-[#20D94B]'
                                : isTerminalNegative
                                  ? 'border-red-500/40 text-red-400'
                                  : 'border-[#353535] text-white'
                            }`}
                          >
                            {b.status}
                          </span>

                          <Link
                            to={`/account/support?ref=${encodeURIComponent(b.bookingReference)}&category=BOOKING`}
                            className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B]"
                          >
                            Contact Business
                          </Link>

                          {b.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setBookingToCancel(b)}
                              className="px-3 py-1.5 rounded-lg border border-red-500/40 text-xs font-semibold text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              Cancel Request
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Timeline */}
                      {isTerminalNegative ? (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                          This booking request is {b.status.toLowerCase()}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {RENTAL_STEPS.map((stepStatus, idx) => {
                            const reached = activeStepIdx >= idx;
                            return (
                              <div key={stepStatus} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    reached ? 'bg-[#20D94B]' : 'bg-[#353535]'
                                  }`}
                                />
                                <p
                                  className={`text-[11px] font-semibold ${
                                    reached ? 'text-white' : 'text-[#A6A6A6]'
                                  }`}
                                >
                                  {RENTAL_STEP_LABELS[stepStatus]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[#A6A6A6] block">Schedule ({b.days} days)</span>
                          <span className="font-mono tabular-nums text-white font-semibold">
                            {b.pickupAt.replace('T', ' ')} → {b.returnAt.replace('T', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Total Booking Amount</span>
                          <span className="font-mono tabular-nums text-white font-bold">
                            {formatMoney(b.totalAmountCents, b.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Paid Amount</span>
                          <span className="font-mono tabular-nums text-[#20D94B] font-bold">
                            {formatMoney(b.paidAmountCents || 0, b.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Balance Due</span>
                          <span className="font-mono tabular-nums text-amber-400 font-bold">
                            {formatMoney(outstandingCents, b.currency)}
                          </span>
                        </div>
                      </div>

                      {(addonLabels.length > 0 ||
                        b.specialRequests ||
                        b.pickupInspectionNote ||
                        b.returnInspectionNote) && (
                        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs text-[#A6A6A6] space-y-1.5">
                          {addonLabels.length > 0 && (
                            <p>
                              Additional Services:{' '}
                              <span className="text-white">{addonLabels.join(', ')}</span>
                            </p>
                          )}
                          {b.specialRequests && (
                            <p>
                              Special Requests:{' '}
                              <span className="text-white">{b.specialRequests}</span>
                            </p>
                          )}
                          {b.pickupInspectionNote && (
                            <p>
                              Pickup Inspection Note:{' '}
                              <span className="text-white">{b.pickupInspectionNote}</span>
                            </p>
                          )}
                          {b.returnInspectionNote && (
                            <p>
                              Return Inspection Note:{' '}
                              <span className="text-white">{b.returnInspectionNote}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {bookingPayments.length > 0 && (
                        <div className="pt-3 border-t border-[#353535] space-y-2">
                          <p className="text-xs font-semibold text-[#A6A6A6] flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-[#20D94B]" />
                            Payment History
                          </p>
                          <div className="space-y-1.5">
                            {bookingPayments.map((pay) => (
                              <div
                                key={pay.id}
                                className="flex items-center justify-between text-xs bg-[#171717] px-3 py-2 rounded-lg"
                              >
                                <span className="text-[#A6A6A6]">
                                  {pay.paidAt} · {pay.paymentType} ({pay.method}) · Ref:{' '}
                                  {pay.reference}
                                </span>
                                <span className="font-mono tabular-nums font-bold text-white">
                                  {formatMoney(pay.amountCents, pay.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* MY PURCHASE INQUIRIES */}
          {tab === 'purchase-inquiries' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">My Purchase Inquiries</h2>
                  <p className="text-xs text-[#A6A6A6]">
                    Dedicated dealership acquisition tracking separate from rental reservations.
                  </p>
                </div>
                <Link
                  to="/sales"
                  className="px-4 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs"
                >
                  Browse Cars for Sale
                </Link>
              </div>

              {inquiries.length === 0 ? (
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center space-y-4">
                  <p className="text-base font-bold text-white">
                    You haven&apos;t submitted a purchase inquiry yet.
                  </p>
                  <p className="text-sm text-[#A6A6A6]">
                    Select any vehicle in Cars for Sale to submit your budget and inspection timing.
                  </p>
                  <Link
                    to="/sales"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs"
                  >
                    Explore Cars for Sale
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                inquiries.map((inq) => {
                  const vehicle = vehicleMap.get(inq.vehicleId);
                  const stepIdx = INQUIRY_STEPS.indexOf(inq.status);
                  const closedNegative = inq.status === 'CLOSED_UNSUCCESSFUL';

                  return (
                    <div
                      key={inq.id}
                      className="bg-[#202020] border border-[#353535] rounded-2xl p-5 sm:p-6 space-y-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#353535] pb-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-24 h-16 rounded-xl overflow-hidden bg-[#171717] border border-[#353535] shrink-0">
                            {vehicle ? (
                              <VehicleImage
                                src={vehicle.mainImage || vehicle.images[0]}
                                alt={inq.vehicleName}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#A6A6A6]">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-[#A6A6A6]">
                              Ref: {inq.inquiryReference || `#${inq.id.slice(0, 8).toUpperCase()}`} ·
                              Submitted {formatDateValue(inq.createdAt)}
                            </p>
                            <h3 className="text-lg font-bold text-white mt-0.5 truncate">
                              {inq.vehicleName}
                            </h3>
                            {inq.assignedStaffName && (
                              <p className="text-xs text-[#20D94B] mt-0.5">
                                Assigned Advisor: {inq.assignedStaffName}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-[#20D94B]">
                            {inq.status.replace(/_/g, ' ')}
                          </span>
                          <Link
                            to={`/account/support?ref=${encodeURIComponent(inq.inquiryReference)}&category=PURCHASE`}
                            className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B]"
                          >
                            Contact Business
                          </Link>
                        </div>
                      </div>

                      {/* Inquiry Progress Timeline */}
                      {closedNegative ? (
                        <div className="p-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-[#A6A6A6]">
                          This purchase inquiry has been closed. Contact our sales desk to revisit or
                          explore alternative inventory.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {INQUIRY_STEPS.map((st, idx) => {
                            const reached = stepIdx >= idx;
                            return (
                              <div key={st} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    reached ? 'bg-[#20D94B]' : 'bg-[#353535]'
                                  }`}
                                />
                                <p
                                  className={`text-[11px] font-semibold truncate ${
                                    reached ? 'text-white' : 'text-[#A6A6A6]'
                                  }`}
                                >
                                  {INQUIRY_STEP_LABELS[st]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[#A6A6A6] block">Preferred Budget</span>
                          <span className="font-mono tabular-nums font-bold text-white">
                            {inq.preferredBudgetCents
                              ? formatMoney(inq.preferredBudgetCents, inq.currency || setting.currency)
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Payment Preference</span>
                          <span className="text-white font-semibold">
                            {PAYMENT_PREF_LABELS[inq.preferredPaymentMethod] ||
                              inq.preferredPaymentMethod}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Purchase Timeline</span>
                          <span className="text-white font-semibold">
                            {TIMELINE_LABELS[inq.purchaseTimeline] || inq.purchaseTimeline}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A6A6A6] block">Financing Requested</span>
                          <span className="text-white font-semibold">
                            {inq.needsFinancing ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>

                      {(inq.preferredInspectionDate ||
                        inq.followUpDate ||
                        inq.message ||
                        (inq.notes && inq.notes.length > 0)) && (
                        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs text-[#A6A6A6] space-y-2">
                          {inq.preferredInspectionDate && (
                            <p className="font-mono">
                              Preferred Inspection Date:{' '}
                              <span className="text-white">{inq.preferredInspectionDate}</span>
                            </p>
                          )}
                          {inq.followUpDate && (
                            <p className="font-mono">
                              Scheduled Follow-Up:{' '}
                              <span className="text-[#20D94B]">{inq.followUpDate}</span>
                            </p>
                          )}
                          {inq.message && (
                            <p>
                              Your Message: <span className="text-white">{inq.message}</span>
                            </p>
                          )}
                          {inq.notes && inq.notes.length > 0 && (
                            <div className="pt-2 border-t border-[#353535] space-y-1.5">
                              <p className="font-semibold text-white">Advisor Updates</p>
                              {inq.notes.map((n) => (
                                <div key={n.id} className="text-xs text-[#A6A6A6]">
                                  <span className="text-[#20D94B] font-semibold">
                                    {n.authorName}:
                                  </span>{' '}
                                  <span className="text-white/90">{n.content}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SAVED VEHICLES */}
          {tab === 'favorites' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Saved Vehicles</h2>
                  <p className="text-xs text-[#A6A6A6]">
                    Shortlisted vehicles saved from Cars for Sale and Cars for Rent.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(
                    [
                      { id: 'ALL', label: 'All' },
                      { id: 'SALE', label: 'Cars for Sale' },
                      { id: 'RENTAL', label: 'Cars for Rent' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFavFilter(f.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        favFilter === f.id
                          ? 'bg-[#20D94B] text-[#080808]'
                          : 'bg-[#171717] border border-[#353535] text-[#A6A6A6] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredFavoriteVehicles.length === 0 ? (
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center space-y-4">
                  <p className="text-base font-bold text-white">
                    Your favorite vehicles will appear here.
                  </p>
                  <p className="text-sm text-[#A6A6A6]">
                    Tap the heart icon on any listing in our showroom to save it for quick access.
                  </p>
                  <Link
                    to="/fleet"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs"
                  >
                    Discover Vehicles
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredFavoriteVehicles.map((v) => (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      currency={setting.currency}
                      businessMode={setting.businessMode}
                      isFavorite
                      onToggleFavorite={(vid) => void toggleFavorite(profile.uid, vid, favMap.get(vid))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS */}
          {tab === 'payments' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">Payments &amp; Ledger</h2>
                <p className="text-xs text-[#A6A6A6]">
                  Verified deposits, rental balance settlements, and refunds recorded on your
                  account.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Total Confirmed Payments</p>
                  <p className="text-2xl font-extrabold font-mono tabular-nums text-[#20D94B] mt-2">
                    {formatMoney(Math.max(0, totalPaidCents), setting.currency)}
                  </p>
                </div>
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5">
                  <p className="text-xs text-[#A6A6A6]">Outstanding Rental Balance</p>
                  <p className="text-2xl font-extrabold font-mono tabular-nums text-amber-400 mt-2">
                    {formatMoney(totalOutstandingCents, setting.currency)}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] text-xs text-[#A6A6A6]">
                Note: This ledger tracks confirmed rental deposits and rental settlements. Vehicle
                purchase agreements and bank financing contracts are finalized separately with your
                assigned sales advisor.
              </div>

              {payments.length === 0 ? (
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center space-y-3">
                  <p className="text-base font-bold text-white">No Confirmed Payments Recorded</p>
                  <p className="text-sm text-[#A6A6A6]">
                    When our desk records a rental deposit or payment against your booking, your
                    receipt will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((pay) => {
                    const booking = bookingMap.get(pay.bookingId);
                    return (
                      <div
                        key={pay.id}
                        className="bg-[#202020] border border-[#353535] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-white">
                              {pay.reference || pay.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#20D94B]/15 text-[#20D94B] text-[10px] font-bold">
                              CONFIRMED
                            </span>
                            <span className="text-xs text-[#A6A6A6]">
                              {pay.paidAt} · {pay.method.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-white truncate">
                            {booking?.vehicleName || 'Rental Payment'}
                          </p>
                          <p className="text-xs text-[#A6A6A6]">
                            Booking Ref: {booking?.bookingReference || pay.bookingId} · Type:{' '}
                            {pay.paymentType.replace(/_/g, ' ')}
                          </p>
                        </div>

                        <span className="text-lg font-mono tabular-nums font-extrabold text-white shrink-0">
                          {formatMoney(pay.amountCents, pay.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {tab === 'notifications' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Notifications</h2>
                  <p className="text-xs text-[#A6A6A6]">
                    Booking confirmations, inquiry status updates, and payment alerts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      notifFilter === 'ALL'
                        ? 'bg-[#20D94B] text-[#080808]'
                        : 'bg-[#171717] border border-[#353535] text-[#A6A6A6]'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('UNREAD')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      notifFilter === 'UNREAD'
                        ? 'bg-[#20D94B] text-[#080808]'
                        : 'bg-[#171717] border border-[#353535] text-[#A6A6A6]'
                    }`}
                  >
                    Unread ({unreadNotifs})
                  </button>
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      disabled={markingAllRead}
                      onClick={() => void handleMarkAllRead()}
                      className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-[#20D94B]" />
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>

              {displayedNotifications.length === 0 ? (
                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center text-sm text-[#A6A6A6]">
                  {notifFilter === 'UNREAD'
                    ? 'You have no unread notifications.'
                    : 'No notifications at this time.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`bg-[#202020] border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        n.read ? 'border-[#353535]' : 'border-[#20D94B]/50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#171717] border border-[#353535] text-[#20D94B]">
                            {n.type}
                          </span>
                          <span className="text-[11px] text-[#A6A6A6]">
                            {formatDateValue(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">{n.title}</p>
                        <p className="text-xs text-[#A6A6A6]">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {n.link && (
                          <Link
                            to={n.link.replace('/portal/inquiries', '/account/purchase-inquiries').replace('/portal', '/account')}
                            className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B]"
                          >
                            View
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-[#20D94B] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MY PROFILE */}
          {tab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {firebaseUser?.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={profile.fullName}
                      className="w-14 h-14 rounded-full object-cover border border-[#353535]"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#20D94B]/15 border border-[#20D94B]/40 text-[#20D94B] font-extrabold text-lg flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-white">{profile.fullName}</h2>
                    <p className="text-xs text-[#A6A6A6]">{profile.email}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
                      <span className="text-[#20D94B] font-semibold inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Email Verified
                      </span>
                      <span className="text-[#A6A6A6]">
                        Member since{' '}
                        {formatDateValue(
                          profile.createdAt || firebaseUser?.metadata.creationTime
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <form
                  onSubmit={handleSaveProfile}
                  className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4"
                >
                  <h3 className="text-lg font-bold text-white">Profile &amp; Driver Details</h3>
                  {profileSaved && (
                    <p className="text-xs text-[#20D94B] bg-[#20D94B]/10 border border-[#20D94B]/40 rounded-xl p-3">
                      Profile details updated successfully.
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                      Driver License Number
                    </label>
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="h-11 px-6 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>

                <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Security &amp; Sign-In Methods</h3>
                    <p className="text-xs text-[#A6A6A6] leading-relaxed">
                      Manage verified credentials linked to {profile.email}.
                    </p>
                  </div>

                  {linkError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
                      {linkError}
                    </div>
                  )}

                  {linkMessage && (
                    <div className="p-3 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-xs text-[#20D94B]">
                      {linkMessage}
                    </div>
                  )}

                  {resetSentMessage && (
                    <div className="p-3 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-xs text-[#20D94B]">
                      {resetSentMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <MailCheck className="w-4 h-4 text-[#20D94B] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">Email &amp; Password</p>
                          <p className="text-xs text-[#A6A6A6] truncate">{profile.email}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#20D94B] shrink-0">
                        {isPasswordLinked ? 'Active' : 'Verified'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Google Sign-In</p>
                          <p className="text-xs text-[#A6A6A6]">
                            {isGoogleLinked
                              ? 'Your Google account is linked to this profile.'
                              : 'Link your Google account for one-click access.'}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            isGoogleLinked ? 'text-[#20D94B]' : 'text-[#A6A6A6]'
                          }`}
                        >
                          {isGoogleLinked ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>

                      {!isGoogleLinked && (
                        <GoogleAuthButton
                          label="Connect Google Account"
                          loading={linkingGoogle}
                          onClick={() => {
                            setLinkError(null);
                            setLinkMessage(null);
                            setLinkingGoogle(true);
                            void linkGoogleAccount()
                              .then(() => {
                                setLinkMessage(
                                  'Google account successfully linked to your profile.'
                                );
                              })
                              .catch((err) => {
                                setLinkError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Unable to link Google account.'
                                );
                              })
                              .finally(() => {
                                setLinkingGoogle(false);
                              });
                          }}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={resetSending}
                      onClick={() => void handleTriggerPasswordReset()}
                      className="w-full h-11 px-4 rounded-xl bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4 text-[#20D94B]" />
                      {resetSending ? 'Sending Reset Email...' : 'Send Password Reset Email'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HELP & SUPPORT */}
          {tab === 'support' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-[#20D94B]">
                      <HelpCircle className="w-5 h-5" />
                      <h2 className="text-lg font-bold text-white">Direct Business Concierge</h2>
                    </div>
                    <p className="text-xs text-[#A6A6A6] leading-relaxed">
                      Need changes to an active rental, financing consultation, or chauffeur pickup
                      coordination? Contact our team directly.
                    </p>
                    <div className="space-y-2.5 text-xs text-[#A6A6A6] pt-2 border-t border-[#353535]">
                      <p className="flex items-center gap-2 text-white">
                        <Phone className="w-3.5 h-3.5 text-[#20D94B]" />
                        {setting.contactPhone}
                      </p>
                      <p className="flex items-center gap-2 text-white">
                        <MailCheck className="w-3.5 h-3.5 text-[#20D94B]" />
                        {setting.contactEmail}
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#20D94B] mt-0.5 shrink-0" />
                        <span>{setting.address}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-3">
                    <h3 className="text-sm font-bold text-white">Common Questions</h3>
                    <div className="space-y-2">
                      {PORTAL_FAQS.map((faq, idx) => {
                        const open = openFaqIdx === idx;
                        return (
                          <div
                            key={faq.q}
                            className="rounded-xl bg-[#171717] border border-[#353535] overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setOpenFaqIdx(open ? null : idx)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-semibold text-white cursor-pointer"
                            >
                              <span>{faq.q}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-[#A6A6A6] shrink-0 transition-transform ${
                                  open ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {open && (
                              <p className="px-3.5 pb-3 text-xs text-[#A6A6A6] leading-relaxed border-t border-[#353535]/60 pt-2">
                                {faq.a}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-5">
                  <h2 className="text-lg font-bold text-white">Submit a Support Request</h2>
                  {supportSubmittedId && (
                    <div className="p-3.5 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-xs text-[#20D94B] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Support ticket registered (Ref: {supportSubmittedId.slice(0, 8).toUpperCase()}
                        ). Our concierge desk will respond shortly.
                      </span>
                    </div>
                  )}
                  {supportError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
                      {supportError}
                    </div>
                  )}

                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                          Category
                        </label>
                        <select
                          value={supportCategory}
                          onChange={(e) => setSupportCategory(e.target.value as SupportCategory)}
                          className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
                        >
                          <option value="BOOKING">Rental Booking</option>
                          <option value="PURCHASE">Car Purchase Inquiry</option>
                          <option value="PAYMENT">Payments &amp; Deposits</option>
                          <option value="ACCOUNT">Account &amp; Profile</option>
                          <option value="GENERAL">General Concierge</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                          Related Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={supportRelatedRef}
                          onChange={(e) => setSupportRelatedRef(e.target.value)}
                          placeholder="RNT-... or INQ-..."
                          className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        placeholder="Request pickup time adjustment or vehicle question"
                        className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A6A6A6] mb-1">
                        Message
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="Share details so our team can assist immediately..."
                        className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={supportSubmitting}
                      className="h-11 px-6 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {supportSubmitting ? 'Submitting Request...' : 'Send Support Request'}
                    </button>
                  </form>

                  {supportRequests.length > 0 && (
                    <div className="pt-4 border-t border-[#353535] space-y-2.5">
                      <h3 className="text-sm font-bold text-white">Your Support Tickets</h3>
                      {supportRequests.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{ticket.subject}</p>
                            <p className="text-[#A6A6A6] truncate">
                              {ticket.category}
                              {ticket.relatedRef ? ` · ${ticket.relatedRef}` : ''} ·{' '}
                              {formatDateValue(ticket.createdAt)}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-[#202020] border border-[#353535] text-[#20D94B] font-semibold shrink-0">
                            {ticket.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Booking Confirmation Dialog */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cancel Pending Rental Request?</h3>
                <p className="text-xs text-[#A6A6A6] mt-1 leading-relaxed">
                  Are you sure you want to cancel booking{' '}
                  <span className="font-mono text-white">{bookingToCancel.bookingReference}</span>{' '}
                  for <span className="text-white">{bookingToCancel.vehicleName}</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={cancellingBooking}
                onClick={() => setBookingToCancel(null)}
                className="h-10 px-4 rounded-xl bg-[#171717] border border-[#353535] text-xs font-semibold text-white cursor-pointer"
              >
                Keep Request
              </button>
              <button
                type="button"
                disabled={cancellingBooking}
                onClick={() => void handleConfirmCancelBooking()}
                className="h-10 px-4 rounded-xl bg-red-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {cancellingBooking ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
