import { Check } from 'lucide-react';
import { markNotificationRead } from '../../services/autosuiteService';
import type { AuditLog, NotificationItem } from '../../types/autosuite';

export function AdminNotificationsTab({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Operations Notifications</h2>
        <p className="text-xs text-[#A6A6A6]">Real-time alerts for new rental bookings, sales inquiries, and payments.</p>
      </div>
      {notifications.length === 0 ? (
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center text-sm text-[#A6A6A6]">
          No administrative notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="bg-[#202020] border border-[#353535] rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{n.title}</p>
                <p className="text-xs text-[#A6A6A6] mt-0.5">{n.message}</p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => void markNotificationRead(n.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-[#20D94B] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAuditLogsTab({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Security & Audit Trail</h2>
        <p className="text-xs text-[#A6A6A6]">Immutable log of administrative, booking, payment, and role changes.</p>
      </div>

      <div className="bg-[#202020] border border-[#353535] rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#353535] text-[#A6A6A6]">
              <th className="py-3.5 px-4">Actor</th>
              <th className="py-3.5 px-4">Action</th>
              <th className="py-3.5 px-4">Entity</th>
              <th className="py-3.5 px-4">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#353535]">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-[#A6A6A6]">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 px-4 text-white font-medium">{log.actorEmail}</td>
                  <td className="py-3 px-4 font-mono text-[#20D94B]">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-[#A6A6A6]">{log.entityType}</td>
                  <td className="py-3 px-4 text-[#A6A6A6]">{log.summary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
