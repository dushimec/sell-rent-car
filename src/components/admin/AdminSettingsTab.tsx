import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, Save, ShieldCheck } from 'lucide-react';
import {
  getEffectiveAuthDomain,
  isDefaultFirebaseAuthDomain,
  normalizeDomainHost,
} from '../../lib/firebase';
import { saveBusinessSettings } from '../../services/autosuiteService';
import type { BusinessMode, BusinessSetting, UserProfile } from '../../types/autosuite';
import {
  amountToCents,
  centsToInputString,
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_FORMAT,
  formatCurrency,
  normalizeCurrency,
} from '../../utils/money';

interface AdminSettingsTabProps {
  profile: UserProfile;
  setting: BusinessSetting;
}

export function AdminSettingsTab({ profile, setting }: AdminSettingsTabProps) {
  const [businessName, setBusinessName] = useState(setting.businessName);
  const [tagline, setTagline] = useState(setting.tagline);
  const [businessMode, setBusinessMode] = useState<BusinessMode>(setting.businessMode);
  const [currency, setCurrency] = useState(normalizeCurrency(setting.currency));
  const [currencyFormat, setCurrencyFormat] = useState(
    setting.currencyFormat || DEFAULT_CURRENCY_FORMAT
  );
  const [language, setLanguage] = useState(setting.language);
  const [contactEmail, setContactEmail] = useState(setting.contactEmail);
  const [contactPhone, setContactPhone] = useState(setting.contactPhone);
  const [address, setAddress] = useState(setting.address);
  const [websiteDomain, setWebsiteDomain] = useState(setting.websiteDomain || '');
  const [authDomain, setAuthDomain] = useState(setting.authDomain || '');
  const [authDomainVerified, setAuthDomainVerified] = useState(
    Boolean(setting.authDomainVerified)
  );
  const [supportEmail, setSupportEmail] = useState(setting.supportEmail || '');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(setting.privacyPolicyUrl || '');
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState(setting.termsOfServiceUrl || '');
  const [heroTitle, setHeroTitle] = useState(setting.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(setting.heroSubtitle);
  const [aboutContent, setAboutContent] = useState(setting.aboutContent);
  const [rentalPolicy, setRentalPolicy] = useState(setting.rentalPolicy);
  const [depositPercent, setDepositPercent] = useState(setting.depositPercent);
  const [chauffeurFee, setChauffeurFee] = useState(
    centsToInputString(setting.chauffeurFeePerDayCents)
  );
  const [locationsText, setLocationsText] = useState(setting.locations.join('\n'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setBusinessName(setting.businessName);
    setTagline(setting.tagline);
    setBusinessMode(setting.businessMode);
    setCurrency(normalizeCurrency(setting.currency));
    setCurrencyFormat(setting.currencyFormat || DEFAULT_CURRENCY_FORMAT);
    setLanguage(setting.language);
    setContactEmail(setting.contactEmail);
    setContactPhone(setting.contactPhone);
    setAddress(setting.address);
    setWebsiteDomain(setting.websiteDomain || '');
    setAuthDomain(setting.authDomain || '');
    setAuthDomainVerified(Boolean(setting.authDomainVerified));
    setSupportEmail(setting.supportEmail || '');
    setPrivacyPolicyUrl(setting.privacyPolicyUrl || '');
    setTermsOfServiceUrl(setting.termsOfServiceUrl || '');
    setHeroTitle(setting.heroTitle);
    setHeroSubtitle(setting.heroSubtitle);
    setAboutContent(setting.aboutContent);
    setRentalPolicy(setting.rentalPolicy);
    setDepositPercent(setting.depositPercent);
    setChauffeurFee(centsToInputString(setting.chauffeurFeePerDayCents));
    setLocationsText(setting.locations.join('\n'));
  }, [setting]);

  const effectiveAuthDomain = getEffectiveAuthDomain();
  const stillDefaultFirebaseDomain = isDefaultFirebaseAuthDomain(effectiveAuthDomain);
  const normalizedInputAuthDomain = normalizeDomainHost(authDomain);
  const previewHandlerUri = normalizedInputAuthDomain
    ? `https://${normalizedInputAuthDomain}/__/auth/handler`
    : `https://${effectiveAuthDomain}/__/auth/handler`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanedAuthDomain = authDomain.trim() ? normalizeDomainHost(authDomain) : '';
    if (authDomain.trim() && !cleanedAuthDomain) {
      setValidationError(
        'Enter a valid custom authentication hostname (for example, auth.yourdealership.rw).'
      );
      return;
    }
    if (authDomainVerified && !cleanedAuthDomain) {
      setValidationError(
        'Provide a custom authentication domain before marking it verified and active.'
      );
      return;
    }

    const cleanedWebsite = websiteDomain.trim() ? normalizeDomainHost(websiteDomain) : '';
    if (websiteDomain.trim() && !cleanedWebsite) {
      setValidationError(
        'Enter a valid website hostname (for example, www.yourdealership.rw).'
      );
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const locations = locationsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 25);

      await saveBusinessSettings(
        {
          businessName: businessName.trim(),
          tagline: tagline.trim(),
          businessMode,
          currency: normalizeCurrency(currency || DEFAULT_CURRENCY),
          currencyFormat: currencyFormat || DEFAULT_CURRENCY_FORMAT,
          language,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          address: address.trim(),
          websiteDomain: cleanedWebsite,
          authDomain: cleanedAuthDomain,
          authDomainVerified: Boolean(authDomainVerified && cleanedAuthDomain),
          supportEmail: supportEmail.trim(),
          privacyPolicyUrl: privacyPolicyUrl.trim(),
          termsOfServiceUrl: termsOfServiceUrl.trim(),
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          aboutContent: aboutContent.trim(),
          rentalPolicy: rentalPolicy.trim(),
          depositPercent: Number(depositPercent),
          chauffeurFeePerDayCents: amountToCents(chauffeurFee),
          locations,
          logoUrl: setting.logoUrl || '',
        },
        profile
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-bold text-white">Business Settings & Website Content</h2>
        <p className="text-[#A6A6A6]">
          Customize your public storefront branding, business model (Sales / Rental / Combined), RWF currency display, custom auth domain, and policies.
        </p>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400">
          {validationError}
        </div>
      )}

      {saved && (
        <div className="p-3.5 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-[#20D94B]">
          Business settings and website branding updated live.
        </div>
      )}

      <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Brand Identity, Operating Mode & Currency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[#A6A6A6] mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Business Mode</label>
            <select
              value={businessMode}
              onChange={(e) => setBusinessMode(e.target.value as BusinessMode)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            >
              <option value="COMBINED">Combined Sales & Rental</option>
              <option value="SALES_ONLY">Car Sales Dealership Only</option>
              <option value="RENTAL_ONLY">Car Rental Company Only</option>
            </select>
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Primary Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            >
              <option value="RWF">RWF — Rwandan Franc</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="AED">AED — UAE Dirham</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
          <div>
            <label className="block text-[#A6A6A6] mb-1">Currency Display Format</label>
            <select
              value={currencyFormat}
              onChange={(e) => setCurrencyFormat(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#202020] border border-[#353535] text-white"
            >
              <option value="RWF_WHOLE">Whole Units — {formatCurrency(150000, currency)}</option>
            </select>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[#A6A6A6]">Active Storefront Preview</span>
            <span className="font-mono tabular-nums text-sm font-bold text-[#20D94B] mt-0.5">
              {currency} · {formatCurrency(150000, currency)} / {formatCurrency(1500000, currency)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[#A6A6A6] mb-1">Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[#A6A6A6] mb-1">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Contact Phone</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Showroom Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
        </div>
      </div>

      {/* Domain, Custom Auth & Google OAuth Branding */}
      <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#20D94B]" />
              Domain, Custom Auth &amp; Google OAuth Branding
            </h3>
            <p className="text-[#A6A6A6] mt-0.5">
              Replace default <span className="font-mono">.firebaseapp.com</span> Google account chooser prompts with your own business authentication domain.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg border text-[11px] font-mono inline-flex items-center gap-1.5 shrink-0 ${
              stillDefaultFirebaseDomain
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-[#20D94B]/10 border-[#20D94B]/40 text-[#20D94B]'
            }`}
          >
            {stillDefaultFirebaseDomain ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Runtime authDomain: {effectiveAuthDomain}
          </span>
        </div>

        {stillDefaultFirebaseDomain && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-amber-300">
              External DNS &amp; Google Cloud OAuth Verification Pending
            </p>
            <p>
              Google Sign-In currently displays <span className="font-mono">{effectiveAuthDomain}</span> until you connect your custom auth domain in Firebase Hosting, authorize the domain in Firebase Authentication, and update your Google Cloud OAuth Consent Screen &amp; Web Client Redirect URI:
            </p>
            <p className="font-mono text-[11px] text-white bg-[#171717] px-3 py-2 rounded-lg border border-[#353535] break-all">
              Authorized Redirect URI: {previewHandlerUri}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[#A6A6A6] mb-1">Business Website Domain</label>
            <input
              type="text"
              value={websiteDomain}
              onChange={(e) => setWebsiteDomain(e.target.value)}
              placeholder="www.yourdealership.rw"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Custom Authentication Domain</label>
            <input
              type="text"
              value={authDomain}
              onChange={(e) => setAuthDomain(e.target.value)}
              placeholder="auth.yourdealership.rw"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#171717] border border-[#353535] cursor-pointer">
          <input
            type="checkbox"
            checked={authDomainVerified}
            onChange={(e) => setAuthDomainVerified(e.target.checked)}
            className="mt-0.5 accent-[#20D94B]"
          />
          <span className="space-y-0.5">
            <span className="block font-semibold text-white">
              Custom Auth Domain Verified &amp; Active
            </span>
            <span className="block text-[#A6A6A6]">
              Enable only after DNS records, Firebase Hosting SSL, and Google Cloud OAuth redirect URI (<span className="font-mono">{previewHandlerUri}</span>) are live. Leaving this unchecked keeps existing Google Sign-In working on the fallback Firebase domain.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[#A6A6A6] mb-1">OAuth Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@yourdealership.rw"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Privacy Policy URL</label>
            <input
              type="url"
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
              placeholder="https://yourdealership.rw/privacy"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Terms of Service URL</label>
            <input
              type="url"
              value={termsOfServiceUrl}
              onChange={(e) => setTermsOfServiceUrl(e.target.value)}
              placeholder="https://yourdealership.rw/terms"
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
            />
          </div>
        </div>

        <p className="text-[11px] text-[#A6A6A6] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#20D94B] shrink-0" />
          App name (<span className="text-white">{businessName || 'Your Business'}</span>) and support email should match your Google Cloud Console OAuth Consent Screen.
        </p>
      </div>

      <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Public Website Copy &amp; Rental Rules</h3>
        <div>
          <label className="block text-[#A6A6A6] mb-1">Homepage Hero Headline</label>
          <input
            type="text"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>
        <div>
          <label className="block text-[#A6A6A6] mb-1">Homepage Hero Supporting Text</label>
          <textarea
            rows={2}
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[#A6A6A6] mb-1">Required Security Deposit (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={depositPercent}
              onChange={(e) => setDepositPercent(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[#A6A6A6] mb-1">Chauffeur Fee / Day ({currency})</label>
            <input
              type="text"
              value={chauffeurFee}
              onChange={(e) => setChauffeurFee(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-[#A6A6A6] mb-1">Pickup / Return Locations (one per line)</label>
          <textarea
            rows={3}
            value={locationsText}
            onChange={(e) => setLocationsText(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>
        <div>
          <label className="block text-[#A6A6A6] mb-1">About Page Content</label>
          <textarea
            rows={3}
            value={aboutContent}
            onChange={(e) => setAboutContent(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>
        <div>
          <label className="block text-[#A6A6A6] mb-1">Rental Policy</label>
          <textarea
            rows={3}
            value={rentalPolicy}
            onChange={(e) => setRentalPolicy(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="h-11 px-7 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving Configuration...' : 'Save Settings & Branding'}
      </button>
    </form>
  );
}
