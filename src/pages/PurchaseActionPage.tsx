import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, ShieldCheck } from 'lucide-react';
import { VehicleImage } from '../components/VehicleImage';
import { PurchaseInquiryForm } from '../components/sales/PurchaseInquiryForm';
import type { BusinessSetting, Vehicle } from '../types/autosuite';
import { formatMoney } from '../utils/money';

interface PurchaseActionPageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  catalogLoading: boolean;
}

export function PurchaseActionPage({
  setting,
  vehicles,
  catalogLoading,
}: PurchaseActionPageProps) {
  const { vehicleId } = useParams();
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (catalogLoading && !vehicle) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="h-96 rounded-2xl bg-[#202020] border border-[#353535] animate-pulse" />
      </div>
    );
  }

  const canBuy =
    vehicle &&
    (setting.businessMode === 'SALES_ONLY' || setting.businessMode === 'COMBINED') &&
    (vehicle.listingType === 'SALE' || vehicle.listingType === 'BOTH') &&
    vehicle.salePriceCents > 0;

  if (!vehicle || !canBuy) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-white">Vehicle Not Available for Purchase</h1>
        <p className="text-sm text-[#A6A6A6]">
          This listing may have been sold, archived, or is only offered for rental.
        </p>
        <Link
          to="/sales"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Cars for Sale
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/vehicles/${vehicle.id}?mode=BUY`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#A6A6A6] hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vehicle Details
        </Link>
        <span className="text-xs font-semibold text-[#20D94B]">
          Cars for Sale · Purchase Inquiry
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-5 bg-[#202020] border border-[#353535] rounded-2xl overflow-hidden">
          <div className="aspect-[16/10] bg-[#171717]">
            <VehicleImage src={vehicle.mainImage || vehicle.images[0]} alt={vehicle.name} />
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-[#A6A6A6]">
                {vehicle.brand} · {vehicle.category} · {vehicle.year}
              </p>
              <h2 className="text-xl font-extrabold text-white mt-1">{vehicle.name}</h2>
            </div>

            <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between">
              <span className="text-xs text-[#A6A6A6]">Listed Purchase Price</span>
              <span className="text-lg font-mono font-extrabold tabular-nums text-[#20D94B]">
                {formatMoney(vehicle.salePriceCents, setting.currency)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                <span className="text-[#A6A6A6] block">Mileage</span>
                <span className="font-mono font-semibold text-white">
                  {vehicle.mileageKm.toLocaleString()} km
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                <span className="text-[#A6A6A6] block">Powertrain</span>
                <span className="font-semibold text-white truncate block">
                  {vehicle.fuelType} · {vehicle.transmission}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#353535] text-xs text-[#A6A6A6] space-y-2">
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#20D94B]" />
                Showroom: {vehicle.location}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#20D94B]" />
                Direct concierge: {setting.contactPhone}
              </p>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1 border-b border-[#353535] pb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Submit Purchase Requirements
            </h1>
            <p className="text-xs text-[#A6A6A6]">
              Complete your acquisition details below. Review your summary before submitting to our
              sales advisors.
            </p>
          </div>
          <PurchaseInquiryForm vehicle={vehicle} setting={setting} />
        </section>
      </div>
    </div>
  );
}
