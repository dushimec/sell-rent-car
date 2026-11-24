import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';
import { VehicleCard } from '../components/VehicleCard';
import { useAuth } from '../context/AuthContext';
import { toggleFavorite } from '../services/autosuiteService';
import type {
  Brand,
  BusinessSetting,
  Favorite,
  Vehicle,
  VehicleCategory,
} from '../types/autosuite';
import { amountToCents } from '../utils/money';

interface FleetPageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  brands: Brand[];
  categories: VehicleCategory[];
  favorites: Favorite[];
  modeFilter?: 'ALL' | 'SALE' | 'RENTAL';
  title: string;
  subtitle: string;
}

export function FleetPage({
  setting,
  vehicles,
  brands,
  categories,
  favorites,
  modeFilter = 'ALL',
  title,
  subtitle,
}: FleetPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [selectedType, setSelectedType] = useState<'ALL' | 'SALE' | 'RENTAL'>(
    modeFilter !== 'ALL'
      ? modeFilter
      : ((searchParams.get('type') as 'ALL' | 'SALE' | 'RENTAL') || 'ALL')
  );
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get('brand') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || '');
  const [maxBudget, setMaxBudget] = useState(searchParams.get('budget') || '');
  const [chauffeurOnly, setChauffeurOnly] = useState(false);
  const [selectedTransmission, setSelectedTransmission] = useState('');
  const [selectedFuel, setSelectedFuel] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'year_desc'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    setSelectedType(
      modeFilter !== 'ALL'
        ? modeFilter
        : ((searchParams.get('type') as 'ALL' | 'SALE' | 'RENTAL') || 'ALL')
    );
    setSelectedBrand(searchParams.get('brand') || '');
    setSelectedCategory(searchParams.get('category') || '');
    setSelectedLocation(searchParams.get('location') || '');
    setMaxBudget(searchParams.get('budget') || '');
    setPage(1);
  }, [modeFilter, searchParams]);

  const favMap = new Map(favorites.map((f) => [f.vehicleId, f.id]));

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const budgetCents = maxBudget.trim() ? amountToCents(maxBudget) : 0;

    const list = vehicles.filter((v) => {
      if (!v.published || v.archived) return false;

      if (selectedType === 'SALE') {
        if (v.listingType === 'RENTAL' || v.salePriceCents <= 0) return false;
      }
      if (selectedType === 'RENTAL') {
        if (v.listingType === 'SALE' || v.rentalPricePerDayCents <= 0) return false;
      }
      if (setting.businessMode === 'SALES_ONLY' && v.listingType === 'RENTAL') return false;
      if (setting.businessMode === 'RENTAL_ONLY' && v.listingType === 'SALE') return false;

      if (selectedBrand && v.brand !== selectedBrand) return false;
      if (selectedCategory && v.category !== selectedCategory) return false;
      if (selectedLocation && v.location !== selectedLocation) return false;
      if (selectedTransmission && v.transmission !== selectedTransmission) return false;
      if (selectedFuel && v.fuelType !== selectedFuel) return false;
      if (onlyAvailable && !v.available) return false;
      if (selectedType === 'RENTAL' && chauffeurOnly && !v.chauffeurAvailable) return false;
      if (selectedType === 'SALE' && budgetCents > 0 && v.salePriceCents > budgetCents) {
        return false;
      }

      if (q) {
        const hay = `${v.name} ${v.brand} ${v.model} ${v.category} ${v.color}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'year_desc') return b.year - a.year;
      if (sortBy === 'price_asc') {
        const pa = selectedType === 'RENTAL' ? a.rentalPricePerDayCents : a.salePriceCents || a.rentalPricePerDayCents;
        const pb = selectedType === 'RENTAL' ? b.rentalPricePerDayCents : b.salePriceCents || b.rentalPricePerDayCents;
        return pa - pb;
      }
      if (sortBy === 'price_desc') {
        const pa = selectedType === 'RENTAL' ? a.rentalPricePerDayCents : a.salePriceCents || a.rentalPricePerDayCents;
        const pb = selectedType === 'RENTAL' ? b.rentalPricePerDayCents : b.salePriceCents || b.rentalPricePerDayCents;
        return pb - pa;
      }
      return Number(b.featured) - Number(a.featured) || b.year - a.year;
    });

    return list;
  }, [
    vehicles,
    queryText,
    selectedType,
    selectedBrand,
    selectedCategory,
    selectedLocation,
    maxBudget,
    chauffeurOnly,
    selectedTransmission,
    selectedFuel,
    onlyAvailable,
    sortBy,
    setting.businessMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleToggleFav = async (vehicleId: string) => {
    if (!profile) {
      const target = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=favorite`);
      return;
    }
    await toggleFavorite(profile.uid, vehicleId, favMap.get(vehicleId));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#353535] pb-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-[#A6A6A6]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-[#A6A6A6]">
            {filtered.length} vehicles matched
          </span>
          <div className="flex items-center bg-[#171717] border border-[#353535] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6] hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#1B1B1B] border border-[#353535] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                setPage(1);
              }}
              placeholder="Search model, brand, color..."
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white placeholder:text-[#A6A6A6] focus:outline-none focus:border-[#20D94B]"
            />
          </div>

          {setting.businessMode === 'COMBINED' && modeFilter === 'ALL' && (
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as 'ALL' | 'SALE' | 'RENTAL');
                setPage(1);
              }}
              className="h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
            >
              <option value="ALL">All Vehicles</option>
              <option value="SALE">Cars for Sale</option>
              <option value="RENTAL">Cars for Rent</option>
            </select>
          )}

          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setPage(1);
            }}
            className="h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {selectedType === 'SALE' && (
            <input
              type="number"
              min={0}
              step={500000}
              value={maxBudget}
              onChange={(e) => {
                setMaxBudget(e.target.value);
                setPage(1);
              }}
              placeholder={`Max Budget (${setting.currency})`}
              className="h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm font-mono tabular-nums text-white placeholder:text-[#A6A6A6] focus:outline-none focus:border-[#20D94B]"
            />
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-11 px-3 rounded-xl bg-[#171717] border border-[#353535] text-sm text-white focus:outline-none focus:border-[#20D94B]"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="year_desc">Year: Newest First</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#353535]">
          <div className="flex flex-wrap items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-[#A6A6A6]" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
            >
              <option value="">Any Hub Location</option>
              {setting.locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            <select
              value={selectedTransmission}
              onChange={(e) => setSelectedTransmission(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
            >
              <option value="">Any Transmission</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="Dual-Clutch">Dual-Clutch</option>
              <option value="Single-Speed EV">Single-Speed EV</option>
            </select>

            <select
              value={selectedFuel}
              onChange={(e) => setSelectedFuel(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs text-white"
            >
              <option value="">Any Fuel Type</option>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>

            {selectedType === 'RENTAL' && (
              <label className="inline-flex items-center gap-2 text-xs text-[#A6A6A6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={chauffeurOnly}
                  onChange={(e) => setChauffeurOnly(e.target.checked)}
                  className="rounded accent-[#20D94B]"
                />
                Chauffeur Available
              </label>
            )}

            <label className="inline-flex items-center gap-2 text-xs text-[#A6A6A6] cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="rounded accent-[#20D94B]"
              />
              Available Now Only
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              setQueryText('');
              setSelectedBrand('');
              setSelectedCategory('');
              setSelectedLocation('');
              setMaxBudget('');
              setChauffeurOnly(false);
              setSelectedTransmission('');
              setSelectedFuel('');
              setOnlyAvailable(false);
              setSelectedType(modeFilter);
              setPage(1);
            }}
            className="text-xs font-medium text-[#A6A6A6] hover:text-white cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Results */}
      {paginated.length === 0 ? (
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-12 text-center space-y-3">
          <p className="text-lg font-bold text-white">No vehicles match your selected filters</p>
          <p className="text-sm text-[#A6A6A6]">Adjust your search terms or reset filters to view available inventory.</p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-5'
          }
        >
          {paginated.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              currency={setting.currency}
              businessMode={setting.businessMode}
              contextMode={selectedType}
              isFavorite={favMap.has(vehicle.id)}
              onToggleFavorite={handleToggleFav}
              layout={viewMode}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`w-10 h-10 rounded-xl text-sm font-mono tabular-nums font-bold transition cursor-pointer ${
                p === currentPage
                  ? 'bg-[#20D94B] text-[#080808]'
                  : 'bg-[#202020] border border-[#353535] text-[#A6A6A6] hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
