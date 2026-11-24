import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Heart,
  MapPin,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { VehicleCard } from '../components/VehicleCard';
import { VehicleImage } from '../components/VehicleImage';
import { RentalBookingForm } from '../components/rentals/RentalBookingForm';
import { PurchaseInquiryForm } from '../components/sales/PurchaseInquiryForm';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { toggleFavorite } from '../services/autosuiteService';
import type {
  BusinessSetting,
  Favorite,
  ScheduleSlot,
  Vehicle,
} from '../types/autosuite';
import { formatMoney } from '../utils/money';

interface VehicleDetailPageProps {
  setting: BusinessSetting;
  vehicles: Vehicle[];
  favorites: Favorite[];
}

export function VehicleDetailPage({ setting, vehicles, favorites }: VehicleDetailPageProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isEmailVerified } = useAuth();
  const isAuthenticated = Boolean(profile && isEmailVerified);

  const vehicle = vehicles.find((v) => v.id === id);
  const [activeImage, setActiveImage] = useState(0);
  const [bookedSlots, setBookedSlots] = useState<ScheduleSlot[]>([]);
  const [activeFlow, setActiveFlow] = useState<'NONE' | 'BUY' | 'RENT'>('NONE');

  const canBuy =
    (setting.businessMode === 'SALES_ONLY' || setting.businessMode === 'COMBINED') &&
    (vehicle?.listingType === 'SALE' || vehicle?.listingType === 'BOTH') &&
    (vehicle?.salePriceCents || 0) > 0;

  const canRent =
    (setting.businessMode === 'RENTAL_ONLY' || setting.businessMode === 'COMBINED') &&
    (vehicle?.listingType === 'RENTAL' || vehicle?.listingType === 'BOTH') &&
    (vehicle?.rentalPricePerDayCents || 0) > 0;

  const requestedMode = searchParams.get('mode');

  useEffect(() => {
    setActiveImage(0);
    if (requestedMode === 'BUY' && canBuy) {
      setActiveFlow('BUY');
    } else if (requestedMode === 'RENT' && canRent) {
      setActiveFlow('RENT');
    } else if (canBuy && !canRent) {
      setActiveFlow('BUY');
    } else if (canRent && !canBuy) {
      setActiveFlow('RENT');
    } else {
      setActiveFlow('NONE');
    }
  }, [id, requestedMode, canBuy, canRent]);

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

  if (!vehicle) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-white">Vehicle Not Found</h1>
        <p className="text-sm text-[#A6A6A6]">This listing may have been archived or unpublished.</p>
        <Link
          to="/fleet"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Showroom
        </Link>
      </div>
    );
  }

  const gallery = vehicle.images.length > 0 ? vehicle.images : [vehicle.mainImage];
  const favId = favorites.find((f) => f.vehicleId === vehicle.id)?.id;
  const similarVehicles = vehicles
    .filter((v) => v.id !== vehicle.id && v.published && !v.archived && v.category === vehicle.category)
    .slice(0, 3);

  const backTarget =
    activeFlow === 'BUY' ? '/sales' : activeFlow === 'RENT' ? '/rentals' : '/fleet';
  const backLabel =
    activeFlow === 'BUY'
      ? 'Back to Cars for Sale'
      : activeFlow === 'RENT'
        ? 'Back to Cars for Rent'
        : 'Back to Fleet';

  const startPurchaseFlow = () => {
    const target = `/cars-for-sale/${vehicle.id}/inquiry`;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=purchase`);
      return;
    }
    navigate(target);
  };

  const startRentalFlow = () => {
    const target = `/cars-for-rent/${vehicle.id}/book`;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(target)}&intent=rental`);
      return;
    }
    navigate(target);
  };

  const handleSaveFavorite = () => {
    if (!isAuthenticated || !profile) {
      navigate(
        `/login?redirect=${encodeURIComponent(`/vehicles/${vehicle.id}`)}&intent=favorite`
      );
      return;
    }
    void toggleFavorite(profile.uid, vehicle.id, favId);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-16">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={backTarget}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#A6A6A6] hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
        <button
          type="button"
          onClick={handleSaveFavorite}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] transition cursor-pointer"
        >
          <Heart className={`w-4 h-4 ${favId ? 'fill-[#20D94B] text-[#20D94B]' : ''}`} />
          {favId ? 'Saved to Favorites' : 'Save Vehicle'}
        </button>
      </div>

      {/* Main Split: Gallery & Specs Left, Completely Separate Purchase or Rental Flow Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-[#171717] border border-[#353535]">
              <VehicleImage src={gallery[activeImage]} alt={vehicle.name} />
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {gallery.map((img, idx) => (
                  <button
                    key={img + idx}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    className={`aspect-[4/3] rounded-xl overflow-hidden border transition cursor-pointer ${
                      idx === activeImage ? 'border-[#20D94B]' : 'border-[#353535] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <VehicleImage src={img} alt={`${vehicle.name} view ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Technical Specifications */}
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Vehicle Specifications</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Model Year</p>
                <p className="font-mono tabular-nums font-bold text-white mt-0.5">{vehicle.year}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Mileage</p>
                <p className="font-mono tabular-nums font-bold text-white mt-0.5">
                  {vehicle.mileageKm.toLocaleString()} km
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Transmission</p>
                <p className="font-semibold text-white mt-0.5">{vehicle.transmission}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Fuel Type</p>
                <p className="font-semibold text-white mt-0.5">{vehicle.fuelType}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Powertrain</p>
                <p className="font-semibold text-white mt-0.5">{vehicle.engineCapacity}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Exterior Finish</p>
                <p className="font-semibold text-white mt-0.5">{vehicle.color}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Seating</p>
                <p className="font-mono tabular-nums font-semibold text-white mt-0.5">{vehicle.seats} seats</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#353535]">
                <p className="text-xs text-[#A6A6A6]">Showroom Hub</p>
                <p className="font-semibold text-white mt-0.5 truncate">{vehicle.location}</p>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-bold text-white">Overview</h3>
              <p className="text-sm text-[#A6A6A6] leading-relaxed">{vehicle.description}</p>
            </div>

            {vehicle.features.length > 0 && (
              <div className="pt-2 space-y-2.5">
                <h3 className="text-sm font-bold text-white">Equipment & Options</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[#A6A6A6]">
                  {vehicle.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#20D94B] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Separated Action & Dedicated Form Panel */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-6">
          <div className="space-y-2 border-b border-[#353535] pb-5">
            <p className="text-xs text-[#A6A6A6]">
              {vehicle.brand} · {vehicle.category} · {vehicle.available ? 'Available' : 'Currently Reserved'}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{vehicle.name}</h1>

            <div className="flex flex-wrap items-baseline gap-6 pt-2">
              {canBuy && (
                <div>
                  <span className="block text-xs text-[#A6A6A6]">Purchase Price</span>
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-white">
                    {formatMoney(vehicle.salePriceCents, setting.currency)}
                  </span>
                </div>
              )}
              {canRent && (
                <div>
                  <span className="block text-xs text-[#A6A6A6]">Daily Rental Rate</span>
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-[#20D94B]">
                    {formatMoney(vehicle.rentalPricePerDayCents, setting.currency)}
                    <span className="text-xs font-normal text-[#A6A6A6]">/day</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dedicated Workflow Entry Buttons */}
          {canBuy && !canRent && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={startPurchaseFlow}
                className="w-full h-12 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                I&apos;m Interested in Buying
              </button>
              {isAuthenticated ? (
                <PurchaseInquiryForm vehicle={vehicle} setting={setting} />
              ) : (
                <p className="text-xs text-[#A6A6A6] leading-relaxed">
                  Sign in or create an account to submit your purchase inquiry and track advisor updates.
                </p>
              )}
            </div>
          )}

          {canRent && !canBuy && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={startRentalFlow}
                className="w-full h-12 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                Book This Car
              </button>
              {isAuthenticated ? (
                <RentalBookingForm
                  vehicle={vehicle}
                  setting={setting}
                  bookedSlots={bookedSlots}
                />
              ) : (
                <p className="text-xs text-[#A6A6A6] leading-relaxed">
                  Sign in or create an account to reserve rental dates and manage your booking online.
                </p>
              )}
            </div>
          )}

          {canBuy && canRent && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      startPurchaseFlow();
                    } else {
                      setActiveFlow('BUY');
                    }
                  }}
                  className={`h-11 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeFlow === 'BUY'
                      ? 'bg-[#20D94B] text-[#080808]'
                      : 'bg-[#171717] border border-[#353535] text-white hover:border-[#20D94B]'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Buy This Car
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      startRentalFlow();
                    } else {
                      setActiveFlow('RENT');
                    }
                  }}
                  className={`h-11 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeFlow === 'RENT'
                      ? 'bg-[#20D94B] text-[#080808]'
                      : 'bg-[#171717] border border-[#353535] text-white hover:border-[#20D94B]'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  Rent This Car
                </button>
              </div>

              {isAuthenticated && activeFlow === 'BUY' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">Purchase Requirements Form</p>
                    <Link
                      to={`/cars-for-sale/${vehicle.id}/inquiry`}
                      className="text-[11px] font-semibold text-[#20D94B] hover:underline"
                    >
                      Open Full Page
                    </Link>
                  </div>
                  <PurchaseInquiryForm vehicle={vehicle} setting={setting} />
                </div>
              )}

              {isAuthenticated && activeFlow === 'RENT' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">Rental Booking Form</p>
                    <Link
                      to={`/cars-for-rent/${vehicle.id}/book`}
                      className="text-[11px] font-semibold text-[#20D94B] hover:underline"
                    >
                      Open Full Page
                    </Link>
                  </div>
                  <RentalBookingForm
                    vehicle={vehicle}
                    setting={setting}
                    bookedSlots={bookedSlots}
                  />
                </div>
              )}

              {!isAuthenticated && (
                <p className="text-xs text-[#A6A6A6] leading-relaxed">
                  Select <span className="text-white font-semibold">Buy This Car</span> or{' '}
                  <span className="text-white font-semibold">Rent This Car</span> to sign in and
                  continue directly to your form.
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-[#353535] text-xs text-[#A6A6A6] space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#20D94B]" />
              <span>Located at {vehicle.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20D94B]" />
              <span>Concierge line: {setting.contactPhone}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Similar Vehicles */}
      {similarVehicles.length > 0 && (
        <section className="space-y-6 pt-6 border-t border-[#353535]">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Similar Vehicles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {similarVehicles.map((sv) => (
              <VehicleCard
                key={sv.id}
                vehicle={sv}
                currency={setting.currency}
                businessMode={setting.businessMode}
                contextMode={activeFlow === 'BUY' ? 'SALE' : activeFlow === 'RENT' ? 'RENTAL' : 'ALL'}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
