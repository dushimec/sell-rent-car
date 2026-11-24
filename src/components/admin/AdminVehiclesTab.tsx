import React, { useState } from 'react';
import { Archive, Edit3, Eye, EyeOff, Plus, Trash2, Upload, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  createBrand,
  createCategory,
  deleteBrand,
  deleteCategory,
  fetchVehiclePrivate,
  saveVehicle,
  updateVehicleFlags,
} from '../../services/autosuiteService';
import type {
  Brand,
  BusinessSetting,
  FuelType,
  ListingType,
  TransmissionType,
  UserProfile,
  Vehicle,
  VehicleCategory,
} from '../../types/autosuite';
import { amountToCents, centsToInputString, formatMoney } from '../../utils/money';
import { VehicleImage } from '../VehicleImage';

interface AdminVehiclesTabProps {
  profile: UserProfile;
  setting: BusinessSetting;
  vehicles: Vehicle[];
  brands: Brand[];
  categories: VehicleCategory[];
}

export function AdminVehiclesTab({
  profile,
  setting,
  vehicles,
  brands,
  categories,
}: AdminVehiclesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Brand/Category quick add
  const [newBrand, setNewBrand] = useState('');
  const [newBrandCountry, setNewBrandCountry] = useState('');
  const [newCategory, setNewCategory] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(2025);
  const [category, setCategory] = useState('');
  const [listingType, setListingType] = useState<ListingType>('BOTH');
  const [mileageKm, setMileageKm] = useState(0);
  const [transmission, setTransmission] = useState<TransmissionType>('Automatic');
  const [fuelType, setFuelType] = useState<FuelType>('Petrol');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [color, setColor] = useState('');
  const [seats, setSeats] = useState(5);
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState('');
  const [salePrice, setSalePrice] = useState('0');
  const [rentalPrice, setRentalPrice] = useState('0');
  const [chauffeurAvailable, setChauffeurAvailable] = useState(true);
  const [available, setAvailable] = useState(true);
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [location, setLocation] = useState(setting.locations[0] || 'Main Showroom');

  // Private vehicle fields (stored separately in /vehicle_private/{id})
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vin, setVin] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setBrand(brands[0]?.name || '');
    setModel('');
    setYear(2025);
    setCategory(categories[0]?.name || '');
    setListingType('BOTH');
    setMileageKm(0);
    setTransmission('Automatic');
    setFuelType('Petrol');
    setEngineCapacity('');
    setColor('');
    setSeats(5);
    setDescription('');
    setFeaturesText('');
    setImages([]);
    setMainImage('');
    setSalePrice('0');
    setRentalPrice('0');
    setChauffeurAvailable(true);
    setAvailable(true);
    setPublished(true);
    setFeatured(false);
    setLocation(setting.locations[0] || 'Main Showroom');
    setRegistrationNumber('');
    setVin('');
    setInternalNotes('');
    setUploadError(null);
    setModalOpen(true);
  };

  const openEditModal = async (v: Vehicle) => {
    setEditingId(v.id);
    setName(v.name);
    setBrand(v.brand);
    setModel(v.model);
    setYear(v.year);
    setCategory(v.category);
    setListingType(v.listingType);
    setMileageKm(v.mileageKm);
    setTransmission(v.transmission);
    setFuelType(v.fuelType);
    setEngineCapacity(v.engineCapacity);
    setColor(v.color);
    setSeats(v.seats);
    setDescription(v.description);
    setFeaturesText(v.features.join(', '));
    setImages(v.images);
    setMainImage(v.mainImage || v.images[0] || '');
    setSalePrice(centsToInputString(v.salePriceCents));
    setRentalPrice(centsToInputString(v.rentalPricePerDayCents));
    setChauffeurAvailable(v.chauffeurAvailable);
    setAvailable(v.available);
    setPublished(v.published);
    setFeatured(v.featured);
    setLocation(v.location);
    setUploadError(null);

    const priv = await fetchVehiclePrivate(v.id);
    setRegistrationNumber(priv?.registrationNumber || '');
    setVin(priv?.vin || '');
    setInternalNotes(priv?.internalNotes || '');
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WEBP files are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Maximum image size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setUploadError('Please sign in again before uploading images.');
          return;
        }
        const res = await fetch('/api/uploads/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, dataUrl: reader.result }),
        });
        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error || 'Image upload failed.');
          return;
        }
        setImages((prev) => [...prev, data.url]);
        if (!mainImage) setMainImage(data.url);
      } catch {
        setUploadError('Failed to upload vehicle image.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !registrationNumber.trim()) {
      setUploadError('Vehicle name and private registration number are required.');
      return;
    }
    setSaving(true);
    try {
      const features = featuresText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 30);

      await saveVehicle(
        {
          name: name.trim(),
          brand: brand.trim() || 'Custom',
          model: model.trim() || name.trim(),
          year: Number(year),
          category: category.trim() || 'Sedan',
          listingType,
          mileageKm: Number(mileageKm),
          transmission,
          fuelType,
          engineCapacity: engineCapacity.trim(),
          color: color.trim(),
          seats: Number(seats),
          description: description.trim(),
          features,
          images,
          mainImage: mainImage || images[0] || '',
          salePriceCents: amountToCents(salePrice),
          rentalPricePerDayCents: amountToCents(rentalPrice),
          chauffeurAvailable,
          available,
          published,
          archived: false,
          featured,
          location,
        },
        {
          registrationNumber,
          vin,
          internalNotes,
        },
        profile,
        editingId || undefined
      );
      setModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Vehicle Fleet & Catalog</h2>
          <p className="text-xs text-[#A6A6A6]">
            Private registration numbers and VINs are isolated from public storefront records.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-5 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs inline-flex items-center gap-2 hover:brightness-110 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {/* Fleet Table */}
      <div className="bg-[#202020] border border-[#353535] rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#353535] text-xs text-[#A6A6A6]">
              <th className="py-3.5 px-4 font-semibold">Vehicle</th>
              <th className="py-3.5 px-4 font-semibold">Mode</th>
              <th className="py-3.5 px-4 font-semibold text-right">Sale Price</th>
              <th className="py-3.5 px-4 font-semibold text-right">Daily Rental</th>
              <th className="py-3.5 px-4 font-semibold">Visibility</th>
              <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#353535]">
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-[#A6A6A6]">
                  No vehicles in inventory. Click "Add Vehicle" to create a listing.
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-[#1B1B1B]/60">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-10 rounded-lg overflow-hidden bg-[#171717] shrink-0">
                        <VehicleImage src={v.mainImage || v.images[0]} alt={v.name} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{v.name}</p>
                        <p className="text-xs text-[#A6A6A6]">
                          {v.brand} · {v.category} · {v.year}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#A6A6A6]">{v.listingType}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white">
                    {v.salePriceCents > 0 ? formatMoney(v.salePriceCents, setting.currency) : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#20D94B]">
                    {v.rentalPricePerDayCents > 0
                      ? `${formatMoney(v.rentalPricePerDayCents, setting.currency)}/d`
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={v.archived ? 'text-red-400' : v.published ? 'text-[#20D94B]' : 'text-amber-400'}>
                      {v.archived ? 'Archived' : v.published ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-[#A6A6A6]"> · {v.available ? 'Available' : 'Reserved'}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void updateVehicleFlags(v, { published: !v.published }, profile)}
                        title={v.published ? 'Unpublish' : 'Publish'}
                        className="p-2 rounded-lg bg-[#171717] border border-[#353535] text-[#A6A6A6] hover:text-white cursor-pointer"
                      >
                        {v.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateVehicleFlags(v, { archived: !v.archived }, profile)}
                        title={v.archived ? 'Restore' : 'Archive'}
                        className="p-2 rounded-lg bg-[#171717] border border-[#353535] text-[#A6A6A6] hover:text-amber-400 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditModal(v)}
                        title="Edit Vehicle"
                        className="p-2 rounded-lg bg-[#171717] border border-[#353535] text-[#A6A6A6] hover:text-[#20D94B] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Brands & Categories Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Vehicle Brands</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Brand name (e.g. Porsche)"
              className="flex-1 h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
            />
            <input
              type="text"
              value={newBrandCountry}
              onChange={(e) => setNewBrandCountry(e.target.value)}
              placeholder="Country"
              className="w-28 h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newBrand.trim()) return;
                void createBrand(newBrand, newBrandCountry, profile);
                setNewBrand('');
                setNewBrandCountry('');
              }}
              className="px-4 h-10 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs cursor-pointer"
            >
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs bg-[#171717] px-3 py-2 rounded-xl">
                <span className="text-white font-medium">{b.name} {b.country ? `· ${b.country}` : ''}</span>
                <button
                  type="button"
                  onClick={() => void deleteBrand(b.id, profile)}
                  className="text-[#A6A6A6] hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Vehicle Categories</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category name (e.g. Coupe)"
              className="flex-1 h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newCategory.trim()) return;
                void createCategory(newCategory, '', profile);
                setNewCategory('');
              }}
              className="px-4 h-10 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-xs cursor-pointer"
            >
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-[#171717] px-3 py-2 rounded-xl">
                <span className="text-white font-medium">{c.name}</span>
                <button
                  type="button"
                  onClick={() => void deleteCategory(c.id, profile)}
                  className="text-[#A6A6A6] hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#202020] border border-[#353535] rounded-2xl max-w-3xl w-full p-6 my-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#353535] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Edit Vehicle Listing' : 'Add New Vehicle'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-[#A6A6A6] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="2025 Mercedes-Benz S 580"
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Listing Type</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as ListingType)}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  >
                    <option value="BOTH">Both Sale & Rental</option>
                    <option value="SALE">Sale Only</option>
                    <option value="RENTAL">Rental Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Sale Price ({setting.currency})</label>
                  <input
                    type="text"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Rental / Day ({setting.currency})</label>
                  <input
                    type="text"
                    value={rentalPrice}
                    onChange={(e) => setRentalPrice(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Mileage (km)</label>
                  <input
                    type="number"
                    value={mileageKm}
                    onChange={(e) => setMileageKm(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Seats</label>
                  <input
                    type="number"
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Transmission</label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  >
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                    <option value="Dual-Clutch">Dual-Clutch</option>
                    <option value="Single-Speed EV">Single-Speed EV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Fuel Type</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Engine / Powertrain</label>
                  <input
                    type="text"
                    value={engineCapacity}
                    onChange={(e) => setEngineCapacity(e.target.value)}
                    placeholder="4.0L V8"
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Obsidian Black"
                    className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                  />
                </div>
              </div>

              {/* Private Asset Details (isolated in /vehicle_private) */}
              <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] space-y-3">
                <p className="font-bold text-[#20D94B]">Private Asset Records (Hidden From Public Website)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#A6A6A6] mb-1">Registration Plate *</label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      required
                      placeholder="VM-109-GT"
                      className="w-full h-10 px-3 rounded-xl bg-[#202020] border border-[#353535] text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#A6A6A6] mb-1">VIN / Chassis</label>
                    <input
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#202020] border border-[#353535] text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#A6A6A6] mb-1">Location Hub</label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#202020] border border-[#353535] text-white"
                    >
                      {setting.locations.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[#A6A6A6] mb-1">Internal Asset Notes</label>
                  <input
                    type="text"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#202020] border border-[#353535] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A6A6A6] mb-1">Vehicle Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                />
              </div>

              <div>
                <label className="block text-[#A6A6A6] mb-1">Features (comma-separated)</label>
                <input
                  type="text"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Air Suspension, 360 Camera, Heated Seats"
                  className="w-full h-10 px-3 rounded-xl bg-[#171717] border border-[#353535] text-white"
                />
              </div>

              {/* Images Upload & Main Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[#A6A6A6]">Vehicle Photography (JPEG/PNG/WEBP, max 5MB)</label>
                  <label className="px-3 py-1.5 rounded-lg bg-[#171717] border border-[#353535] text-white hover:border-[#20D94B] cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#20D94B]" />
                    Upload Photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {images.map((url) => (
                      <div
                        key={url}
                        className={`relative aspect-[4/3] rounded-xl overflow-hidden border ${
                          mainImage === url ? 'border-[#20D94B]' : 'border-[#353535]'
                        }`}
                      >
                        <VehicleImage src={url} alt="Uploaded vehicle" />
                        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/75 flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            onClick={() => setMainImage(url)}
                            className="text-[#20D94B] font-bold cursor-pointer"
                          >
                            {mainImage === url ? 'Main' : 'Set Main'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                            className="text-red-400 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <label className="inline-flex items-center gap-2 text-white cursor-pointer">
                  <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-[#20D94B]" />
                  Published on Website
                </label>
                <label className="inline-flex items-center gap-2 text-white cursor-pointer">
                  <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="accent-[#20D94B]" />
                  Available
                </label>
                <label className="inline-flex items-center gap-2 text-white cursor-pointer">
                  <input type="checkbox" checked={chauffeurAvailable} onChange={(e) => setChauffeurAvailable(e.target.checked)} className="accent-[#20D94B]" />
                  Chauffeur Option
                </label>
                <label className="inline-flex items-center gap-2 text-white cursor-pointer">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-[#20D94B]" />
                  Featured on Homepage
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#353535]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#171717] border border-[#353535] text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#20D94B] text-[#080808] font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
