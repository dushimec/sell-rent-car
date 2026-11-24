import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  CarFront,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldAlert,
  ShoppingBag,
  UserCog,
  Users,
} from 'lucide-react';
import { AdminBookingsTab } from '../components/admin/AdminBookingsTab';
import { AdminInquiriesTab } from '../components/admin/AdminInquiriesTab';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminPaymentsTab } from '../components/admin/AdminPaymentsTab';
import { AdminReportsTab } from '../components/admin/AdminReportsTab';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminAuditLogsTab, AdminNotificationsTab } from '../components/admin/AdminSystemTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminVehiclesTab } from '../components/admin/AdminVehiclesTab';
import { useAuth } from '../context/AuthContext';
import type {
  AuditLog,
  Brand,
  BusinessSetting,
  NotificationItem,
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  UserProfile,
  Vehicle,
  VehicleCategory,
} from '../types/autosuite';

interface AdminDashboardPageProps {
  setting: BusinessSetting;
  brands: Brand[];
  categories: VehicleCategory[];
  vehicles: Vehicle[];
  inquiries: SaleInquiry[];
  bookings: RentalBooking[];
  payments: RentalPayment[];
  notifications: NotificationItem[];
  users: UserProfile[];
  auditLogs: AuditLog[];
}

export function AdminDashboardPage({
  setting,
  brands,
  categories,
  vehicles,
  inquiries,
  bookings,
  payments,
  notifications,
  users,
  auditLogs,
}: AdminDashboardPageProps) {
  const { profile, loading, isEmailVerified, isAdmin, isStaffOrAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [preselectedBookingId, setPreselectedBookingId] = useState<string | undefined>();

  useEffect(() => {
    if (!loading && (!profile || !isEmailVerified || !isStaffOrAdmin)) {
      navigate('/login', { replace: true });
    }
  }, [loading, profile, isEmailVerified, isStaffOrAdmin, navigate]);

  if (!profile || !isEmailVerified || !isStaffOrAdmin) return null;

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const navGroups = [
    {
      heading: 'Showroom Core',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
        { id: 'vehicles', label: 'Vehicles', icon: CarFront, adminOnly: false },
      ],
    },
    {
      heading: 'Sales Management',
      items: [
        { id: 'inquiries', label: `Sales Inquiries (${inquiries.length})`, icon: ShoppingBag, adminOnly: false },
      ],
    },
    {
      heading: 'Rental Management',
      items: [
        { id: 'bookings', label: `Rental Bookings (${bookings.length})`, icon: Calendar, adminOnly: false },
        { id: 'calendar', label: 'Booking Calendar', icon: CalendarDays, adminOnly: false },
        { id: 'payments', label: 'Payments & Deposits', icon: CreditCard, adminOnly: false },
      ],
    },
    {
      heading: 'Operations & System',
      items: [
        { id: 'customers', label: 'Customers', icon: Users, adminOnly: false },
        { id: 'staff', label: 'Staff & Roles', icon: UserCog, adminOnly: true },
        { id: 'reports', label: 'Reports', icon: BarChart3, adminOnly: false },
        { id: 'settings', label: 'Business Settings', icon: Settings, adminOnly: true },
        { id: 'notifications', label: `Notifications (${unreadNotifs})`, icon: Bell, adminOnly: false },
        { id: 'audit', label: 'Audit Logs', icon: ShieldAlert, adminOnly: true },
      ],
    },
  ].map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  }));

  const flatItems = navGroups.flatMap((g) => g.items);
  const currentNav = flatItems.find((i) => i.id === activeTab) || flatItems[0];

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col lg:flex-row">
      {/* Sidebar with separated Sales Management and Rental Management sections */}
      <aside className="lg:w-68 bg-[#1B1B1B] border-b lg:border-b-0 lg:border-r border-[#353535] p-5 flex flex-col justify-between gap-6 shrink-0">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-lg font-extrabold tracking-tight text-white truncate">
              {setting.businessName}
            </p>
            <p className="text-xs text-[#A6A6A6] font-mono">{profile.role}</p>
          </div>

          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.heading} className="space-y-1.5">
                <p className="px-3 text-[11px] font-semibold text-[#A6A6A6] uppercase tracking-wider">
                  {group.heading}
                </p>
                <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-[#20D94B] text-[#080808]'
                            : 'text-[#A6A6A6] hover:text-white hover:bg-[#202020]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-4 border-t border-[#353535] text-xs">
          <Link
            to="/"
            className="px-3.5 py-2 rounded-xl bg-[#202020] border border-[#353535] text-white inline-flex items-center justify-between hover:border-[#20D94B] transition"
          >
            <span>Public Storefront</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#20D94B]" />
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="px-3.5 py-2 rounded-xl text-[#A6A6A6] hover:text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 border-b border-[#353535] bg-[#080808] flex items-center justify-between gap-4">
          <div className="text-sm text-[#A6A6A6] flex items-center gap-2 truncate">
            <span>Administration</span>
            <span>/</span>
            <span className="text-white font-semibold">{currentNav?.label}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#A6A6A6]">{profile.email}</span>
            <Link
              to="/"
              className="lg:hidden px-3 py-1.5 rounded-lg bg-[#202020] border border-[#353535] text-xs font-semibold text-white"
            >
              Website
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <AdminOverviewTab
              profile={profile}
              setting={setting}
              vehicles={vehicles}
              bookings={bookings}
              inquiries={inquiries}
              payments={payments}
              users={users}
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'vehicles' && (
            <AdminVehiclesTab
              profile={profile}
              setting={setting}
              vehicles={vehicles}
              brands={brands}
              categories={categories}
            />
          )}
          {activeTab === 'inquiries' && (
            <AdminInquiriesTab
              profile={profile}
              inquiries={inquiries}
              users={users}
              vehicles={vehicles}
              currency={setting.currency}
            />
          )}
          {(activeTab === 'bookings' || activeTab === 'calendar') && (
            <AdminBookingsTab
              profile={profile}
              bookings={bookings}
              vehicles={vehicles}
              currency={setting.currency}
              initialViewMode={activeTab === 'calendar' ? 'calendar' : 'list'}
              onRecordPaymentForBooking={(bid) => {
                setPreselectedBookingId(bid);
                setActiveTab('payments');
              }}
            />
          )}
          {activeTab === 'payments' && (
            <AdminPaymentsTab
              profile={profile}
              setting={setting}
              bookings={bookings}
              payments={payments}
              preselectedBookingId={preselectedBookingId}
            />
          )}
          {activeTab === 'customers' && (
            <AdminUsersTab
              profile={profile}
              users={users}
              bookings={bookings}
              inquiries={inquiries}
              payments={payments}
              currency={setting.currency}
              mode="customers"
            />
          )}
          {activeTab === 'staff' && isAdmin && (
            <AdminUsersTab
              profile={profile}
              users={users}
              bookings={bookings}
              inquiries={inquiries}
              payments={payments}
              currency={setting.currency}
              mode="staff"
            />
          )}
          {activeTab === 'reports' && (
            <AdminReportsTab
              setting={setting}
              vehicles={vehicles}
              bookings={bookings}
              payments={payments}
              inquiries={inquiries}
              users={users}
            />
          )}
          {activeTab === 'settings' && isAdmin && (
            <AdminSettingsTab profile={profile} setting={setting} />
          )}
          {activeTab === 'notifications' && (
            <AdminNotificationsTab notifications={notifications} />
          )}
          {activeTab === 'audit' && isAdmin && (
            <AdminAuditLogsTab auditLogs={auditLogs} />
          )}
        </main>
      </div>
    </div>
  );
}
