import React, { useState } from 'react';
import { ChevronDown, Mail, MapPin, Phone, Send } from 'lucide-react';
import type { BusinessSetting } from '../types/autosuite';

export function AboutPage({ setting }: { setting: BusinessSetting }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-14 space-y-12">
      <div className="space-y-3 border-b border-[#353535] pb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          About {setting.businessName}
        </h1>
        <p className="text-base text-[#A6A6A6] max-w-2xl">{setting.tagline}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-7 space-y-6">
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-3">
            <h2 className="text-xl font-bold text-white">Our Dealership & Fleet Standards</h2>
            <p className="text-sm text-[#A6A6A6] leading-relaxed whitespace-pre-line">
              {setting.aboutContent}
            </p>
          </div>
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-3">
            <h2 className="text-xl font-bold text-white">Rental Terms & Deposit Policy</h2>
            <p className="text-sm text-[#A6A6A6] leading-relaxed whitespace-pre-line">
              {setting.rentalPolicy}
            </p>
            <p className="text-xs font-mono tabular-nums text-[#20D94B] pt-2">
              Standard Security Deposit: {setting.depositPercent}% of rental total
            </p>
          </div>
        </div>

        <div className="md:col-span-5 space-y-6">
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Locations & Hubs</h2>
            <ul className="space-y-3 text-sm text-[#A6A6A6]">
              {setting.locations.map((loc) => (
                <li key={loc} className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#20D94B] mt-0.5 shrink-0" />
                  <span>{loc}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-[#353535] space-y-2 text-sm text-[#A6A6A6]">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#20D94B]" />
                {setting.contactPhone}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#20D94B]" />
                {setting.contactEmail}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactPage({ setting }: { setting: BusinessSetting }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitted(true);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5 space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Contact Concierge</h1>
        <p className="text-sm text-[#A6A6A6] leading-relaxed">
          Reach our showroom advisors for private viewings, corporate fleet inquiries, or chauffeur arrangements.
        </p>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4 text-sm">
          <div>
            <p className="text-xs text-[#A6A6A6]">Headquarters</p>
            <p className="font-semibold text-white mt-0.5">{setting.address}</p>
          </div>
          <div>
            <p className="text-xs text-[#A6A6A6]">Direct Phone</p>
            <p className="font-semibold text-white mt-0.5">{setting.contactPhone}</p>
          </div>
          <div>
            <p className="text-xs text-[#A6A6A6]">Email</p>
            <p className="font-semibold text-white mt-0.5">{setting.contactEmail}</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Send a Direct Message</h2>
        {submitted && (
          <div className="mb-5 p-4 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-sm text-[#20D94B]">
            Thank you. Our concierge team has received your message and will respond shortly.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Inquiry Details</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full p-3.5 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-6 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center gap-2 hover:brightness-110 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: 'How are rental dates confirmed without double-booking?',
    a: 'Every confirmed rental atomically reserves its vehicle schedule inside a database transaction. Overlapping dates are automatically blocked before approval.',
  },
  {
    q: 'What payment methods are accepted for deposits and rentals?',
    a: 'Deposits and rental balances can be settled via bank transfer, cash at the showroom desk, or approved terminal methods recorded directly against your booking ledger.',
  },
  {
    q: 'Can I request a pre-purchase inspection before buying a vehicle?',
    a: 'Yes. Select Purchase / Inspection on any vehicle listed for sale and submit an inspection request with your preferred timing.',
  },
  {
    q: 'Do you offer chauffeur-driven rentals?',
    a: 'Select vehicles support chauffeur-driven mode. You can toggle Self-Drive or Chauffeur-Driven directly inside the booking quote calculator.',
  },
];

export function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-14 space-y-8">
      <div className="space-y-2 border-b border-[#353535] pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Frequently Asked Questions</h1>
        <p className="text-sm text-[#A6A6A6]">Clear answers on vehicle sales, rental deposits, and scheduling.</p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={item.q} className="bg-[#202020] border border-[#353535] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left font-bold text-sm text-white cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-[#A6A6A6] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-6 pb-5 text-sm text-[#A6A6A6] leading-relaxed border-t border-[#353535]/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
