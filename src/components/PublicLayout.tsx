import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { BusinessSetting } from '../types/autosuite';
import { normalizeCurrency } from '../utils/money';

function toSafePolicyUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface PublicLayoutProps {
  setting: BusinessSetting;
  children: React.ReactNode;
}

export function PublicLayout({ setting, children }: PublicLayoutProps) {
  const { profile, isEmailVerified, isStaffOrAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const showSales = setting.businessMode === 'SALES_ONLY' || setting.businessMode === 'COMBINED';
  const showRentals = setting.businessMode === 'RENTAL_ONLY' || setting.businessMode === 'COMBINED';
  const safePrivacyUrl = toSafePolicyUrl(setting.privacyPolicyUrl);
  const safeTermsUrl = toSafePolicyUrl(setting.termsOfServiceUrl);

  const navLinks = [
    { to: '/', label: 'Home' },
    ...(showSales ? [{ to: '/sales', label: 'Cars for Sale' }] : []),
    ...(showRentals ? [{ to: '/rentals', label: 'Cars for Rent' }] : []),
    { to: '/about', label: 'About Us' },
    { to: '/contact', label: 'Contact Us' },
  ].slice(0, 5);

  const isAuthenticated = Boolean(profile && isEmailVerified);
  const primaryActionPath = isAuthenticated ? (isStaffOrAdmin ? '/admin' : '/account') : '/login';
  const primaryActionLabel = isAuthenticated
    ? isStaffOrAdmin
      ? 'Admin Console'
      : 'My Account'
    : 'Sign In';

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-md border-b border-[#353535]">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <Link
            to="/"
            className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#20D94B] transition-colors"
          >
            {setting.businessName}
          </Link>

          {/* Zone 2: 4-5 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A6A6A6]">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-white border-[#20D94B]'
                      : 'border-transparent hover:text-white hover:border-[#353535]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link
              to={primaryActionPath}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm whitespace-nowrap shrink-0 hover:brightness-110 hover:shadow-[0_0_24px_rgba(32,217,75,0.28)] transition"
            >
              {isStaffOrAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {primaryActionLabel}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg border border-[#353535] text-white hover:bg-[#1B1B1B]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile navigation drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#353535] bg-[#1B1B1B] px-6 py-4 space-y-3">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-sm font-medium text-[#A6A6A6] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#353535] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate(primaryActionPath);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm"
              >
                {primaryActionLabel}
              </button>
              {profile && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                  aria-label="Sign out"
                  className="p-2.5 rounded-xl border border-[#353535] text-[#A6A6A6] hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Footer using buyer's brand identity */}
      <footer className="bg-[#1B1B1B] border-t border-[#353535] mt-20">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-3">
            <p className="text-lg font-extrabold tracking-tight text-white">
              {setting.businessName}
            </p>
            <p className="text-sm text-[#A6A6A6] max-w-md leading-relaxed">
              {setting.tagline}
            </p>
            <p className="text-xs text-[#A6A6A6] pt-2">
              {setting.address} · {setting.contactPhone} · {setting.contactEmail}
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-white">Showroom</p>
            <div className="flex flex-col gap-2 text-sm text-[#A6A6A6]">
              {showSales && <Link to="/sales" className="hover:text-white transition-colors">Cars for Sale</Link>}
              {showRentals && <Link to="/rentals" className="hover:text-white transition-colors">Cars for Rent</Link>}
              <Link to="/fleet" className="hover:text-white transition-colors">Complete Fleet</Link>
              <Link to="/faq" className="hover:text-white transition-colors">Frequently Asked Questions</Link>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-white">Client Access</p>
            <div className="flex flex-col gap-2 text-sm text-[#A6A6A6]">
              <Link to="/account/purchase-inquiries" className="hover:text-white transition-colors">My Purchase Inquiries</Link>
              <Link to="/account/bookings" className="hover:text-white transition-colors">My Rental Bookings</Link>
              <Link to="/account/favorites" className="hover:text-white transition-colors">Saved Vehicles</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link>
              <Link to="/about" className="hover:text-white transition-colors">About Us &amp; Policies</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[#353535]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A6A6A6]">
            <span>© {new Date().getFullYear()} {setting.businessName}. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-4">
              {safePrivacyUrl && (
                <a
                  href={safePrivacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </a>
              )}
              {safeTermsUrl && (
                <a
                  href={safeTermsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </a>
              )}
              <span>Currency: {normalizeCurrency(setting.currency)}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
