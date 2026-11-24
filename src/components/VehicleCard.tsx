import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart } from 'lucide-react';
import type { BusinessMode, Vehicle } from '../types/autosuite';
import { formatMoney } from '../utils/money';
import { VehicleImage } from './VehicleImage';

interface VehicleCardProps {
  vehicle: Vehicle;
  currency: string;
  businessMode: BusinessMode;
  contextMode?: 'ALL' | 'SALE' | 'RENTAL';
  isFavorite?: boolean;
  onToggleFavorite?: (vehicleId: string) => void;
  layout?: 'grid' | 'list';
}

export function VehicleCard({
  vehicle,
  currency,
  businessMode,
  contextMode = 'ALL',
  isFavorite = false,
  onToggleFavorite,
  layout = 'grid',
}: VehicleCardProps) {
  const showSale =
    (businessMode === 'SALES_ONLY' || businessMode === 'COMBINED') &&
    (vehicle.listingType === 'SALE' || vehicle.listingType === 'BOTH') &&
    vehicle.salePriceCents > 0;

  const showRent =
    (businessMode === 'RENTAL_ONLY' || businessMode === 'COMBINED') &&
    (vehicle.listingType === 'RENTAL' || vehicle.listingType === 'BOTH') &&
    vehicle.rentalPricePerDayCents > 0;

  const primaryPrice =
    contextMode === 'RENTAL' && showRent
      ? `${formatMoney(vehicle.rentalPricePerDayCents, currency)}/day`
      : contextMode === 'SALE' && showSale
        ? formatMoney(vehicle.salePriceCents, currency)
        : showSale
          ? formatMoney(vehicle.salePriceCents, currency)
          : showRent
            ? `${formatMoney(vehicle.rentalPricePerDayCents, currency)}/day`
            : 'Price on inquiry';

  const secondaryPrice =
    contextMode === 'ALL' && showSale && showRent
      ? `${formatMoney(vehicle.rentalPricePerDayCents, currency)}/day rental`
      : contextMode === 'RENTAL' && vehicle.chauffeurAvailable
        ? 'Self-drive or Chauffeur'
        : null;

  const detailUrl =
    contextMode === 'SALE'
      ? `/vehicles/${vehicle.id}?mode=BUY`
      : contextMode === 'RENTAL'
        ? `/vehicles/${vehicle.id}?mode=RENT`
        : `/vehicles/${vehicle.id}`;

  const ctaLabel =
    contextMode === 'SALE'
      ? 'Buy / Inquire'
      : contextMode === 'RENTAL'
        ? 'Book This Car'
        : 'Inspect';

  return (
    <article
      className={`group bg-[#202020] border border-[#353535] rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#20D94B]/60 ${
        layout === 'list' ? 'grid grid-cols-1 md:grid-cols-12' : 'flex flex-col'
      }`}
    >
      {/* 65-75% dominant vehicle photography */}
      <div
        className={`relative overflow-hidden bg-[#171717] ${
          layout === 'list' ? 'md:col-span-5 aspect-[4/3]' : 'aspect-[4/3] w-full'
        }`}
      >
        <Link to={detailUrl} className="block w-full h-full">
          <VehicleImage
            src={vehicle.mainImage || vehicle.images[0]}
            alt={vehicle.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(vehicle.id)}
            aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-[#080808]/75 backdrop-blur-sm border border-[#353535] flex items-center justify-center text-white hover:border-[#20D94B] transition cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-[#20D94B] text-[#20D94B]' : 'text-white'}`}
            />
          </button>
        )}
      </div>

      {/* Clean unboxed metadata & pricing */}
      <div
        className={`p-5 flex flex-col justify-between gap-4 ${
          layout === 'list' ? 'md:col-span-7' : 'flex-1'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[#A6A6A6]">
            <span>{vehicle.brand} · {vehicle.category}</span>
            <span>{vehicle.available ? 'Available' : 'Reserved'}</span>
          </div>

          <Link
            to={detailUrl}
            className="block text-lg font-bold text-white tracking-tight group-hover:text-[#20D94B] transition-colors line-clamp-1"
          >
            {vehicle.name}
          </Link>

          <p className="text-xs text-[#A6A6A6] tabular-nums">
            {vehicle.year} · {vehicle.transmission} · {vehicle.fuelType} · {vehicle.mileageKm.toLocaleString()} km
          </p>

          {layout === 'list' && (
            <p className="text-sm text-[#A6A6A6] line-clamp-2 pt-1">{vehicle.description}</p>
          )}
        </div>

        <div className="pt-3 border-t border-[#353535] flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold font-mono tabular-nums text-white">
              {primaryPrice}
            </p>
            {secondaryPrice && (
              <p className="text-xs font-mono tabular-nums text-[#A6A6A6]">{secondaryPrice}</p>
            )}
          </div>

          <Link
            to={detailUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs whitespace-nowrap shrink-0 hover:brightness-110 transition"
          >
            {ctaLabel}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
