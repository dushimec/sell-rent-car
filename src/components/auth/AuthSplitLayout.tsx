import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import authShowroomImg from '../../assets/images/auth_luxury_showroom_1795496302916.jpg';
import type { BusinessSetting } from '../../types/autosuite';

interface AuthSplitLayoutProps {
  setting: BusinessSetting;
  children: React.ReactNode;
}

function getBusinessMonogram(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'AS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

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

export function AuthSplitLayout({ setting, children }: AuthSplitLayoutProps) {
  const monogram = getBusinessMonogram(setting.businessName);
  const safePrivacyUrl = toSafePolicyUrl(setting.privacyPolicyUrl);
  const safeTermsUrl = toSafePolicyUrl(setting.termsOfServiceUrl);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col lg:flex-row">
      {/* Mobile / Tablet Compact Header Banner */}
      <div className="lg:hidden relative h-44 sm:h-52 w-full overflow-hidden border-b border-[#353535] shrink-0">
        <img
          src={authShowroomImg}
          alt={setting.businessName}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/65 to-[#080808]/40" />
        <div className="absolute inset-0 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A6A6A6] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Showroom
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {setting.logoUrl ? (
              <img
                src={setting.logoUrl}
                alt={setting.businessName}
                className="h-9 w-9 rounded-lg object-cover border border-[#353535]"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-[#171717]/90 border border-[#353535] flex items-center justify-center text-xs font-extrabold tracking-tight text-[#20D94B]">
                {monogram}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-extrabold tracking-tight text-white truncate">
                {setting.businessName}
              </p>
              {setting.tagline && (
                <p className="text-xs text-[#A6A6A6] truncate">{setting.tagline}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Left Column: Cinematic Showroom Presentation */}
      <aside className="hidden lg:flex lg:w-1/2 xl:w-[52%] lg:min-h-screen relative overflow-hidden border-r border-[#353535] flex-col justify-between p-10 xl:p-14">
        <img
          src={authShowroomImg}
          alt={`${setting.businessName} showroom`}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/60 to-[#080808]/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/70 via-transparent to-[#080808]/40" />

        {/* Top Row: Brand & Return Link */}
        <div className="relative z-10 flex items-center justify-between gap-6">
          <Link to="/" className="inline-flex items-center gap-3.5 group">
            {setting.logoUrl ? (
              <img
                src={setting.logoUrl}
                alt={setting.businessName}
                className="h-10 w-10 rounded-xl object-cover border border-[#353535]"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-[#171717]/90 border border-[#353535] group-hover:border-[#20D94B]/60 transition-colors flex items-center justify-center text-sm font-extrabold tracking-tight text-[#20D94B]">
                {monogram}
              </div>
            )}
            <div>
              <span className="block text-lg font-extrabold tracking-tight text-white group-hover:text-[#20D94B] transition-colors">
                {setting.businessName}
              </span>
              <span className="block text-xs text-[#A6A6A6]">Client & Fleet Access</span>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A6A6A6] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Showroom
          </Link>
        </div>

        {/* Bottom Editorial Statement */}
        <div className="relative z-10 max-w-lg space-y-4">
          <div className="h-[2px] w-10 bg-[#20D94B]" />
          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-[1.15]">
            {setting.tagline || 'Precision Vehicles & Executive Fleet Access'}
          </h2>
          <p className="text-sm text-[#A6A6A6] leading-relaxed">
            Manage dedicated vehicle purchase inquiries, confirm scheduled fleet reservations,
            and coordinate directly with {setting.businessName}.
          </p>
        </div>
      </aside>

      {/* Right Column: Authentication Form Viewport */}
      <main className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20 bg-[#080808]">
        <div className="w-full max-w-[420px] mx-auto space-y-6">
          {children}
          {(safePrivacyUrl || safeTermsUrl) && (
            <div className="pt-4 border-t border-[#353535]/60 flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#A6A6A6]">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
