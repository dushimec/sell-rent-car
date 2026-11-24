import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CalendarClock, MapPin, ShieldCheck } from 'lucide-react';
import { VehicleImage } from '../components/VehicleImage';
import { RentalBookingForm } from '../components/rentals/RentalBookingForm';
import { db } from '../lib/firebase';
import type { BusinessSetting, ScheduleSlot, Vehicle } from '../types/autosuite';
import { formatMoney } from '../utils/money';

interface RentalActionPageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  catalogLoading: boolean;
}

export function RentalActionPage({
  setting,
  vehicles,
  catalogLoading,
}: RentalActionPageProps) {
  const { vehicleId } = useParams();
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const [bookedSlots, setBookedSlots] = useState<ScheduleSlot[]>([]);

  useEffect(() => {
    if (!vehicle) return;
    getDoc(doc(db, 'vehicle_schedules', vehicle.id))
      .then((snap) => {
        if (snap.exists()) {
          setBookedSlots((snap.data().slots as ScheduleSlot[]) || []);
        } else {
          setBookedSlots([]);
        }
      })
      .catch(() => setBookedSlots([]));
  }, [vehicle]);

  if (catalogLoading && !vehicle) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="h-96 rounded-2xl bg-[#202020] border border-[#353535] animate-pulse" />
      </div>
    );
  }

  const canRent =
    vehicle &&
    (setting.businessMode === 'RENTAL_ONLY' || setting.businessMode === 'COMBINED') &&
    (vehicle.listingType === 'RENTAL' || vehicle.listingType === 'BOTH') &&
    vehicle.rentalPricePerDayCents > 0;

  if (!vehicle || !canRent) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-white">Vehicle Not Available for Rent</h1>
        <p className="text-sm text-[#A6A6A6]">
          This listing may have been archived or is exclusively offered for purchase.
        </p>
        <Link
          to="/rentals"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Cars for Rent
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/vehicles/${vehicle.id}?mode=RENT`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#A6A6A6] hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vehicle Details
        </Link>
        <span className="text-xs font-semibold text-[#20D94B]">
          Cars for Rent · Reservation Request
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
              <span className="text-xs text-[#A6A6A6]">Daily Rental Rate</span>
              <span className="text-lg font-mono font-extrabold tabular-nums text-[#20D94B]">
                {formatMoney(vehicle.rentalPricePerDayCents, setting.currency)}
                <span className="text-xs font-normal text-[#A6A6A6]">/day</span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs text-[#A6A6A6] space-y-1.5">
              <p className="font-semibold text-white flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-[#20D94B]" />
                Rental Deposit &amp; Terms
              </p>
              <p className="leading-relaxed">{setting.rentalPolicy}</p>
            </div>

            <div className="pt-3 border-t border-[#353535] text-xs text-[#A6A6A6] space-y-2">
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#20D94B]" />
                Base Hub: {vehicle.location}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#20D94B]" />
                Fleet Desk: {setting.contactPhone}
              </p>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-7 bg-[#202020] border border-[#353535] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1 border-b border-[#353535] pb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Complete Your Rental Booking
            </h1>
            <p className="text-xs text-[#A6A6A6]">
              Select your dates, pickup hub, driving option, and additional services. You will review
              the full total before submitting.
            </p>
          </div>
          <RentalBookingForm vehicle={vehicle} setting={setting} bookedSlots={bookedSlots} />
        </section>
      </div>
    </div>
  );
}
