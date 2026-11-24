import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Search, ShieldCheck } from 'lucide-react';
import { VehicleCard } from '../components/VehicleCard';
import { useAuth } from '../context/AuthContext';
import { seedDemoShowroom, toggleFavorite } from '../services/autosuiteService';
import type {
  Brand,
  BusinessSetting,
  Favorite,
  Vehicle,
  VehicleCategory,
} from '../types/autosuite';

interface HomePageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  brands: Brand[];
  categories: VehicleCategory[];
  favorites: Favorite[];
  catalogLoading: boolean;
}

export function HomePage({
  setting,
  vehicles,
  brands,
  categories,
  favorites,
  catalogLoading,
}: HomePageProps) {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [seeding, setSeeding] = useState(false);

  const showSales = setting.businessMode === 'SALES_ONLY' || setting.businessMode === 'COMBINED';
  const showRentals = setting.businessMode === 'RENTAL_ONLY' || setting.businessMode === 'COMBINED';

  const [intent, setIntent] = useState<'SALE' | 'RENTAL'>(
    setting.businessMode === 'SALES_ONLY' ? 'SALE' : 'RENTAL'
  );
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  const saleVehicles = vehicles
    .filter((v) => v.listingType === 'SALE' || v.listingType === 'BOTH')
    .slice(0, 3);
  const rentalVehicles = vehicles
    .filter((v) => v.listingType === 'RENTAL' || v.listingType === 'BOTH')
    .slice(0, 3);

  const favMap = new Map(favorites.map((f) => [f.vehicleId, f.id]));

  const handleToggleFav = async (vehicleId: string) => {
    if (!profile) {
      navigate('/login?redirect=/&intent=favorite');
      return;
    }
    await toggleFavorite(profile.uid, vehicleId, favMap.get(vehicleId));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (category) params.set('category', category);
    if (location) params.set('location', location);
    if (intent === 'RENTAL' && pickupDate) params.set('pickup', pickupDate);
    if (intent === 'SALE' && maxBudget) params.set('budget', maxBudget);
    const targetPath = intent === 'SALE' ? '/sales' : '/rentals';
    navigate(`${targetPath}?${params.toString()}`);
  };

  const handleSeed = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await seedDemoShowroom(profile);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[#353535]">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/hero_flagship_gt_1795470694244.jpg"
            alt={setting.businessName}
            className="w-full h-full object-cover object-center opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/40" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-24 space-y-10">
          <div className="max-w-2xl space-y-6">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]"
              style={{ textWrap: 'balance' }}
            >
              {setting.heroTitle}
            </h1>
            <p className="text-base sm:text-lg text-[#A6A6A6] leading-relaxed max-w-xl">
              {setting.heroSubtitle}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {showSales && (
                <Link
                  to="/sales"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm hover:brightness-110 hover:shadow-[0_0_28px_rgba(32,217,75,0.35)] transition whitespace-nowrap shrink-0"
                >
                  Browse Cars for Sale
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              {showRentals && (
                <Link
                  to="/rentals"
                  className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition whitespace-nowrap shrink-0 ${
                    showSales
                      ? 'bg-[#1B1B1B]/90 border border-[#353535] text-white hover:border-[#20D94B]'
                      : 'bg-[#20D94B] text-[#080808] hover:brightness-110 hover:shadow-[0_0_28px_rgba(32,217,75,0.35)]'
                  }`}
                >
                  Browse Cars for Rent
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Dedicated Workflow Search Panel */}
          <form
            onSubmit={handleSearchSubmit}
            className="bg-[#1B1B1B]/95 backdrop-blur-md border border-[#353535] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Journey</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as 'SALE' | 'RENTAL')}
                className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
              >
                {showSales && <option value="SALE">Cars for Sale</option>}
                {showRentals && <option value="RENTAL">Cars for Rent</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
              >
                <option value="">Any Location</option>
                {setting.locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {intent === 'RENTAL' ? (
              <div>
                <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">Pickup Date</label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[#A6A6A6] mb-1.5">
                  Max Budget ({setting.currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="Any Budget"
                  className="w-full h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm font-mono tabular-nums text-white focus:outline-none focus:border-[#20D94B]"
                />
              </div>
            )}

            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-4 h-4" />
              {intent === 'SALE' ? 'Search For Sale' : 'Search For Rent'}
            </button>
          </form>
        </div>
      </section>

      {/* Empty State / Seeder or Separated Showcases */}
      {catalogLoading ? (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-[#202020] border border-[#353535] rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        </section>
      ) : vehicles.length === 0 ? (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-10 text-center space-y-4">
            <h2 className="text-lg font-bold text-white">No Vehicles Published Yet</h2>
            <p className="text-sm text-[#A6A6A6] max-w-md mx-auto">
              This installation does not have published vehicles in the database yet.
            </p>
            {isAdmin ? (
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeed}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4" />
                {seeding ? 'Populating Showroom...' : 'Seed Sample Dealership Fleet (6 Vehicles)'}
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm"
              >
                Administrator Sign In
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-20 space-y-20">
          {/* Section 1: Cars for Sale */}
          {showSales && saleVehicles.length > 0 && (
            <section className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">
                    Cars for Sale
                  </h2>
                  <p className="text-sm text-[#A6A6A6]">
                    Certified dealership vehicles with direct purchase concierge and scheduled inspections.
                  </p>
                </div>
                <Link
                  to="/sales"
                  className="text-sm font-semibold text-[#20D94B] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  View All Cars for Sale
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {saleVehicles.map((vehicle) => (
                  <VehicleCard
                    key={`sale-${vehicle.id}`}
                    vehicle={vehicle}
                    currency={setting.currency}
                    businessMode={setting.businessMode}
                    contextMode="SALE"
                    isFavorite={favMap.has(vehicle.id)}
                    onToggleFavorite={handleToggleFav}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Cars for Rent */}
          {showRentals && rentalVehicles.length > 0 && (
            <section className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">
                    Cars for Rent
                  </h2>
                  <p className="text-sm text-[#A6A6A6]">
                    Self-drive or chauffeur-driven fleet with real-time availability and instant rate quotes.
                  </p>
                </div>
                <Link
                  to="/rentals"
                  className="text-sm font-semibold text-[#20D94B] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  View All Cars for Rent
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rentalVehicles.map((vehicle) => (
                  <VehicleCard
                    key={`rent-${vehicle.id}`}
                    vehicle={vehicle}
                    currency={setting.currency}
                    businessMode={setting.businessMode}
                    contextMode="RENTAL"
                    isFavorite={favMap.has(vehicle.id)}
                    onToggleFavorite={handleToggleFav}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Why Choose Us & How It Works */}
      <section className="bg-[#1B1B1B] border-y border-[#353535] py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-white" style={{ textWrap: 'balance' }}>
              Dedicated Sales Advisors and Conflict-Free Fleet Rentals
            </h2>
            <p className="text-sm text-[#A6A6A6] leading-relaxed">
              {setting.aboutContent}
            </p>
            <div className="pt-2">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#20D94B] hover:underline"
              >
                Read Rental Policies & Company Background
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-[#202020] border border-[#353535] space-y-2">
              <p className="text-base font-bold text-white">01. Dedicated Purchase Inquiries</p>
              <p className="text-sm text-[#A6A6A6] leading-relaxed">
                Submit structured purchase budgets, financing preferences, and inspection dates directly to sales advisors.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#202020] border border-[#353535] space-y-2">
              <p className="text-base font-bold text-white">02. Conflict-Free Rental Booking</p>
              <p className="text-sm text-[#A6A6A6] leading-relaxed">
                Transactional schedule locks guarantee zero double-booked rental dates across every vehicle.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#202020] border border-[#353535] space-y-2">
              <p className="text-base font-bold text-white">03. Self-Drive or Chauffeur</p>
              <p className="text-sm text-[#A6A6A6] leading-relaxed">
                Choose direct self-drive freedom or dedicated professional chauffeur service with transparent daily rates.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#202020] border border-[#353535] space-y-2">
              <p className="text-base font-bold text-white">04. Separate Client Tracking</p>
              <p className="text-sm text-[#A6A6A6] leading-relaxed">
                Monitor purchase inquiry milestones and active rental contracts independently from your client portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 pt-20">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Ready to Purchase or Reserve a Vehicle?
            </h2>
            <p className="text-sm text-[#A6A6A6]">
              Explore Cars for Sale to submit a purchase inquiry, or Cars for Rent to check real-time booking dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {showSales && (
              <Link
                to="/sales"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm hover:brightness-110 transition whitespace-nowrap shrink-0"
              >
                Cars for Sale
              </Link>
            )}
            {showRentals && (
              <Link
                to="/rentals"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#171717] border border-[#353535] text-white font-bold text-sm hover:border-[#20D94B] transition whitespace-nowrap shrink-0"
              >
                <Calendar className="w-4 h-4 text-[#20D94B]" />
                Cars for Rent
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
