import { useState } from 'react';
import { updateUserRoleAndStatus } from '../../services/autosuiteService';
import type {
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  UserProfile,
  UserRole,
} from '../../types/autosuite';
import { formatMoney } from '../../utils/money';

interface AdminUsersTabProps {
  profile: UserProfile;
  users: UserProfile[];
  bookings: RentalBooking[];
  inquiries: SaleInquiry[];
  payments: RentalPayment[];
  currency: string;
  mode: 'customers' | 'staff';
}

const AVAILABLE_PERMISSIONS = [
  'vehicles.manage',
  'inquiries.manage',
  'bookings.manage',
  'payments.manage',
  'customers.view',
  'reports.view',
];

export function AdminUsersTab({
  profile,
  users,
  bookings,
  inquiries,
  payments,
  currency,
  mode,
}: AdminUsersTabProps) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const canManageRoles = profile.role === 'SUPER_ADMIN' || profile.role === 'BUSINESS_ADMIN';

  const list = users.filter((u) => {
    const matchesMode = mode === 'customers' ? u.role === 'CUSTOMER' : u.role !== 'CUSTOMER';
    if (!matchesMode) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleTogglePermission = async (user: UserProfile, perm: string) => {
    const nextPerms = user.permissions.includes(perm)
      ? user.permissions.filter((p) => p !== perm)
      : [...user.permissions, perm];
    await updateUserRoleAndStatus(
      user.uid,
      { role: user.role, permissions: nextPerms, active: user.active },
      profile
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            {mode === 'customers' ? 'Customer Directory' : 'Staff & Role Management'}
          </h2>
          <p className="text-xs text-[#A6A6A6]">
            {mode === 'customers'
              ? 'Inspect customer bookings, sales inquiries, and payment totals.'
              : 'Assign roles, module permissions, and active account status.'}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="h-10 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
        />
      </div>

      <div className="bg-[#202020] border border-[#353535] rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#353535] text-[#A6A6A6]">
              <th className="py-3.5 px-4">Account</th>
              <th className="py-3.5 px-4">Contact</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Status</th>
              {mode === 'customers' ? (
                <th className="py-3.5 px-4 text-right">Activity</th>
              ) : (
                <th className="py-3.5 px-4">Permissions</th>
              )}
              {canManageRoles && <th className="py-3.5 px-4 text-right">Controls</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#353535]">
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#A6A6A6]">
                  No {mode} accounts found.
                </td>
              </tr>
            ) : (
              list.map((u) => {
                const custBookings = bookings.filter((b) => b.customerId === u.uid);
                const custInquiries = inquiries.filter((i) => i.customerId === u.uid);
                const custPaid = payments
                  .filter((p) => p.customerId === u.uid)
                  .reduce((sum, p) => sum + (p.paymentType === 'REFUND' ? -p.amountCents : p.amountCents), 0);

                return (
                  <tr key={u.uid} className="hover:bg-[#1B1B1B]/50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{u.fullName}</p>
                      <p className="text-[#A6A6A6]">{u.email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-[#A6A6A6]">
                      {u.phone || '—'}
                      {u.driverLicenseNo ? ` · DL ${u.driverLicenseNo}` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      {canManageRoles ? (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            void updateUserRoleAndStatus(
                              u.uid,
                              {
                                role: e.target.value as UserRole,
                                permissions: u.permissions,
                                active: u.active,
                              },
                              profile
                            )
                          }
                          className="h-8 px-2 rounded-lg bg-[#171717] border border-[#353535] text-white"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="STAFF">STAFF</option>
                          <option value="BUSINESS_ADMIN">BUSINESS_ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      ) : (
                        <span className="font-semibold text-white">{u.role}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={u.active ? 'text-[#20D94B] font-semibold' : 'text-red-400 font-semibold'}>
                        {u.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    {mode === 'customers' ? (
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white">
                        {custBookings.length} bookings · {custInquiries.length} inquiries ·{' '}
                        {formatMoney(custPaid, currency)}
                      </td>
                    ) : (
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {AVAILABLE_PERMISSIONS.map((perm) => {
                            const has = u.permissions.includes('ALL') || u.permissions.includes(perm);
                            return (
                              <button
                                key={perm}
                                type="button"
                                disabled={!canManageRoles || u.permissions.includes('ALL')}
                                onClick={() => void handleTogglePermission(u, perm)}
                                className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer ${
                                  has
                                    ? 'bg-[#20D94B]/15 border-[#20D94B]/50 text-[#20D94B]'
                                    : 'bg-[#171717] border-[#353535] text-[#A6A6A6]'
                                }`}
                              >
                                {perm}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                    {canManageRoles && (
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {mode === 'customers' && (
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(u)}
                            className="px-2.5 py-1 rounded-lg bg-[#171717] border border-[#353535] text-white cursor-pointer"
                          >
                            History
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void updateUserRoleAndStatus(
                              u.uid,
                              { role: u.role, permissions: u.permissions, active: !u.active },
                              profile
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#171717] border border-[#353535] text-[#A6A6A6] hover:text-white cursor-pointer"
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-[#353535] pb-3">
            <div>
              <h3 className="text-base font-bold text-white">{selectedCustomer.fullName} — Account History</h3>
              <p className="text-[#A6A6A6]">{selectedCustomer.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-[#A6A6A6] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-bold text-white">Bookings</p>
              {bookings
                .filter((b) => b.customerId === selectedCustomer.uid)
                .map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg bg-[#171717] flex justify-between">
                    <span>{b.vehicleName} ({b.status})</span>
                    <span className="font-mono">{formatMoney(b.totalAmountCents, b.currency)}</span>
                  </div>
                ))}
            </div>
            <div className="space-y-2">
              <p className="font-bold text-white">Sales Inquiries</p>
              {inquiries
                .filter((i) => i.customerId === selectedCustomer.uid)
                .map((i) => (
                  <div key={i.id} className="p-2.5 rounded-lg bg-[#171717] flex justify-between">
                    <span>{i.vehicleName}</span>
                    <span className="text-[#20D94B]">{i.status}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
