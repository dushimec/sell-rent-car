import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  BusinessSetting,
  UserProfile,
  UserRole,
  Vehicle,
  VehiclePrivate,
} from '../types/autosuite';

export const DEFAULT_BUSINESS_SETTING: BusinessSetting = {
  id: 'business',
  businessName: 'Veloce Motors & Fleet',
  tagline: 'Curated automotive sales and executive vehicle rentals',
  businessMode: 'COMBINED',
  currency: 'RWF',
  currencyFormat: 'RWF_WHOLE',
  language: 'en',
  contactEmail: 'concierge@velocemotors.example',
  contactPhone: '+250 788 000 100',
  address: 'KG 7 Avenue, Kigali Heights, Suite 100',
  websiteDomain: '',
  authDomain: '',
  authDomainVerified: false,
  supportEmail: 'concierge@velocemotors.example',
  privacyPolicyUrl: '',
  termsOfServiceUrl: '',
  heroTitle: 'Precision Vehicles. Delivered Without Friction.',
  heroSubtitle:
    'Browse certified luxury and executive vehicles for direct purchase or flexible daily and chauffeur-driven rental.',
  aboutContent:
    'Our dealership combines transparent multi-point vehicle inspections with an executive rental fleet managed end-to-end from a single showroom floor.',
  rentalPolicy:
    'Valid driver license and refundable security deposit required prior to vehicle release. Cancellations are permitted while bookings remain pending.',
  depositPercent: 25,
  chauffeurFeePerDayCents: 6000000,
  locations: ['Main Showroom — Kigali Downtown', 'Kigali International Airport', 'Nyarutarama Executive Hub'],
  logoUrl: '',
};

export async function writeAuditLog(
  actor: UserProfile,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorId: actor.uid,
      actorEmail: actor.email,
      action,
      entityType,
      entityId,
      summary,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
  }
}

export async function createNotification(payload: {
  userId: string;
  audience: 'USER' | 'ADMIN';
  title: string;
  message: string;
  type: 'BOOKING' | 'INQUIRY' | 'PAYMENT' | 'SYSTEM';
  link?: string;
}) {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'notifications');
  }
}

export async function dispatchTransactionalEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; configured: boolean }> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { sent: false, configured: false };
    const res = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!res.ok) return { sent: false, configured: false };
    const data = await res.json();
    return { sent: Boolean(data.sent), configured: Boolean(data.configured) };
  } catch {
    return { sent: false, configured: false };
  }
}

export async function saveBusinessSettings(
  data: Omit<BusinessSetting, 'id' | 'updatedAt'>,
  actor: UserProfile
) {
  const ref = doc(db, 'settings', 'business');
  try {
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(actor, 'UPDATE_SETTINGS', 'BusinessSetting', 'business', `Updated business settings for ${data.businessName}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/business');
  }
}

export async function createBrand(name: string, country: string, actor: UserProfile) {
  try {
    const docRef = await addDoc(collection(db, 'brands'), {
      name: name.trim(),
      country: country.trim(),
      createdAt: serverTimestamp(),
    });
    await writeAuditLog(actor, 'CREATE_BRAND', 'Brand', docRef.id, `Created brand ${name}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'brands');
  }
}

export async function deleteBrand(id: string, actor: UserProfile) {
  try {
    await deleteDoc(doc(db, 'brands', id));
    await writeAuditLog(actor, 'DELETE_BRAND', 'Brand', id, `Deleted brand ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `brands/${id}`);
  }
}

export async function createCategory(name: string, description: string, actor: UserProfile) {
  try {
    const docRef = await addDoc(collection(db, 'categories'), {
      name: name.trim(),
      description: description.trim(),
      createdAt: serverTimestamp(),
    });
    await writeAuditLog(actor, 'CREATE_CATEGORY', 'Category', docRef.id, `Created category ${name}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'categories');
  }
}

export async function deleteCategory(id: string, actor: UserProfile) {
  try {
    await deleteDoc(doc(db, 'categories', id));
    await writeAuditLog(actor, 'DELETE_CATEGORY', 'Category', id, `Deleted category ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
  }
}

export async function saveVehicle(
  vehiclePayload: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>,
  privatePayload: { registrationNumber: string; vin?: string; internalNotes?: string },
  actor: UserProfile,
  existingVehicleId?: string
): Promise<string> {
  const vehicleId = existingVehicleId || doc(collection(db, 'vehicles')).id;
  const vehicleRef = doc(db, 'vehicles', vehicleId);
  const privateRef = doc(db, 'vehicle_private', vehicleId);

  try {
    if (existingVehicleId) {
      const existingSnap = await getDoc(vehicleRef);
      const createdAt = existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp();
      await setDoc(vehicleRef, {
        ...vehiclePayload,
        createdAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(vehicleRef, {
        ...vehiclePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(privateRef, {
      vehicleId,
      registrationNumber: privatePayload.registrationNumber.trim(),
      vin: (privatePayload.vin || '').trim(),
      internalNotes: (privatePayload.internalNotes || '').trim(),
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog(
      actor,
      existingVehicleId ? 'UPDATE_VEHICLE' : 'CREATE_VEHICLE',
      'Vehicle',
      vehicleId,
      `${existingVehicleId ? 'Updated' : 'Created'} vehicle ${vehiclePayload.name}`
    );

    return vehicleId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `vehicles/${vehicleId}`);
  }
}

export async function updateVehicleFlags(
  vehicle: Vehicle,
  updates: Partial<Pick<Vehicle, 'published' | 'archived' | 'available' | 'featured'>>,
  actor: UserProfile
) {
  const ref = doc(db, 'vehicles', vehicle.id);
  try {
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      actor,
      'UPDATE_VEHICLE_STATUS',
      'Vehicle',
      vehicle.id,
      `Updated status flags on ${vehicle.name}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicle.id}`);
  }
}

export async function fetchVehiclePrivate(vehicleId: string): Promise<VehiclePrivate | null> {
  try {
    const snap = await getDoc(doc(db, 'vehicle_private', vehicleId));
    return snap.exists() ? (snap.data() as VehiclePrivate) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `vehicle_private/${vehicleId}`);
  }
}

export async function toggleFavorite(userId: string, vehicleId: string, existingFavId?: string) {
  if (existingFavId) {
    try {
      await deleteDoc(doc(db, 'favorites', existingFavId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `favorites/${existingFavId}`);
    }
    return;
  }

  try {
    await addDoc(collection(db, 'favorites'), {
      userId,
      vehicleId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'favorites');
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: { fullName: string; phone: string; address: string; driverLicenseNo: string }
) {
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      fullName: updates.fullName.trim(),
      phone: updates.phone.trim(),
      address: updates.address.trim(),
      driverLicenseNo: updates.driverLicenseNo.trim(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateUserRoleAndStatus(
  targetUid: string,
  updates: { role: UserRole; permissions: string[]; active: boolean },
  actor: UserProfile
) {
  const ref = doc(db, 'users', targetUid);
  try {
    await updateDoc(ref, {
      role: updates.role,
      permissions: updates.permissions,
      active: updates.active,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      actor,
      'UPDATE_USER_ACCESS',
      'UserProfile',
      targetUid,
      `Updated role to ${updates.role} (active=${updates.active})`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notificationIds: string[]) {
  await Promise.all(
    notificationIds.map((id) => updateDoc(doc(db, 'notifications', id), { read: true }))
  );
}

export async function submitSupportRequest(
  payload: {
    subject: string;
    category: 'BOOKING' | 'PURCHASE' | 'PAYMENT' | 'ACCOUNT' | 'GENERAL';
    relatedRef?: string;
    message: string;
  },
  actor: UserProfile
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'support_requests'), {
      customerId: actor.uid,
      customerName: actor.fullName,
      customerEmail: actor.email,
      subject: payload.subject.trim(),
      category: payload.category,
      relatedRef: (payload.relatedRef || '').trim(),
      message: payload.message.trim(),
      status: 'OPEN',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: actor.uid,
      audience: 'ADMIN',
      title: `Support Request: ${payload.subject.trim().slice(0, 60)}`,
      message: `${actor.fullName} submitted a ${payload.category.toLowerCase()} support inquiry.`,
      type: 'SYSTEM',
      link: '/admin',
    });

    await writeAuditLog(
      actor,
      'CREATE_SUPPORT_REQUEST',
      'SupportRequest',
      docRef.id,
      `Submitted support request: ${payload.subject.trim()}`
    );

    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'support_requests');
  }
}

export async function seedDemoShowroom(actor: UserProfile): Promise<void> {
  await saveBusinessSettings(
    {
      businessName: DEFAULT_BUSINESS_SETTING.businessName,
      tagline: DEFAULT_BUSINESS_SETTING.tagline,
      businessMode: DEFAULT_BUSINESS_SETTING.businessMode,
      currency: DEFAULT_BUSINESS_SETTING.currency,
      currencyFormat: DEFAULT_BUSINESS_SETTING.currencyFormat,
      language: DEFAULT_BUSINESS_SETTING.language,
      contactEmail: DEFAULT_BUSINESS_SETTING.contactEmail,
      contactPhone: DEFAULT_BUSINESS_SETTING.contactPhone,
      address: DEFAULT_BUSINESS_SETTING.address,
      websiteDomain: DEFAULT_BUSINESS_SETTING.websiteDomain,
      authDomain: DEFAULT_BUSINESS_SETTING.authDomain,
      authDomainVerified: DEFAULT_BUSINESS_SETTING.authDomainVerified,
      supportEmail: DEFAULT_BUSINESS_SETTING.supportEmail,
      privacyPolicyUrl: DEFAULT_BUSINESS_SETTING.privacyPolicyUrl,
      termsOfServiceUrl: DEFAULT_BUSINESS_SETTING.termsOfServiceUrl,
      heroTitle: DEFAULT_BUSINESS_SETTING.heroTitle,
      heroSubtitle: DEFAULT_BUSINESS_SETTING.heroSubtitle,
      aboutContent: DEFAULT_BUSINESS_SETTING.aboutContent,
      rentalPolicy: DEFAULT_BUSINESS_SETTING.rentalPolicy,
      depositPercent: DEFAULT_BUSINESS_SETTING.depositPercent,
      chauffeurFeePerDayCents: DEFAULT_BUSINESS_SETTING.chauffeurFeePerDayCents,
      locations: DEFAULT_BUSINESS_SETTING.locations,
      logoUrl: DEFAULT_BUSINESS_SETTING.logoUrl,
    },
    actor
  );

  const brands = [
    { id: 'brand-aston', name: 'Aston Martin', country: 'United Kingdom' },
    { id: 'brand-mercedes', name: 'Mercedes-Benz', country: 'Germany' },
    { id: 'brand-audi', name: 'Audi', country: 'Germany' },
    { id: 'brand-landrover', name: 'Land Rover', country: 'United Kingdom' },
  ];
  for (const b of brands) {
    await setDoc(doc(db, 'brands', b.id), {
      name: b.name,
      country: b.country,
      createdAt: serverTimestamp(),
    });
  }

  const categories = [
    { id: 'cat-gt', name: 'Grand Tourer', description: 'High-performance luxury coupes built for continental travel.' },
    { id: 'cat-sedan', name: 'Executive Sedan', description: 'Flagship chauffeur-ready sedans with rear cabin comfort.' },
    { id: 'cat-suv', name: 'Performance SUV', description: 'All-weather luxury sport utility vehicles.' },
    { id: 'cat-ev', name: 'Electric Sport', description: 'Zero-emission dual-motor grand touring performance.' },
  ];
  for (const c of categories) {
    await setDoc(doc(db, 'categories', c.id), {
      name: c.name,
      description: c.description,
      createdAt: serverTimestamp(),
    });
  }

  const sampleVehicles: Array<{
    id: string;
    vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
    priv: { registrationNumber: string; vin: string; internalNotes: string };
  }> = [
    {
      id: 'veh-dbs-gt',
      vehicle: {
        name: '2025 Aston Martin DBS Superleggera',
        brand: 'Aston Martin',
        model: 'DBS Superleggera',
        year: 2025,
        category: 'Grand Tourer',
        listingType: 'BOTH',
        mileageKm: 1850,
        transmission: 'Automatic',
        fuelType: 'Petrol',
        engineCapacity: '5.2L Twin-Turbo V12',
        color: 'Satin Obsidian Black',
        seats: 4,
        description:
          'Hand-built flagship grand tourer finished in satin obsidian with carbon ceramic brakes, Bang & Olufsen audio, and full dealership inspection history.',
        features: ['Carbon Ceramic Brakes', 'Bang & Olufsen Audio', 'Alcantara Headliner', '360° Camera', 'Adaptive Damping'],
        images: ['/src/assets/images/hero_flagship_gt_1795470694244.jpg'],
        mainImage: '/src/assets/images/hero_flagship_gt_1795470694244.jpg',
        salePriceCents: 32000000000,
        rentalPricePerDayCents: 95000000,
        chauffeurAvailable: true,
        available: true,
        published: true,
        archived: false,
        featured: true,
        location: 'Main Showroom — Kigali Downtown',
      },
      priv: {
        registrationNumber: 'VM-001-GT',
        vin: 'SCFRMFAW8PGL01842',
        internalNotes: 'Showroom centerpiece. Full PPF applied.',
      },
    },
    {
      id: 'veh-s580-exec',
      vehicle: {
        name: '2025 Mercedes-Benz S 580 Executive',
        brand: 'Mercedes-Benz',
        model: 'S 580 4MATIC',
        year: 2025,
        category: 'Executive Sedan',
        listingType: 'BOTH',
        mileageKm: 4200,
        transmission: 'Automatic',
        fuelType: 'Hybrid',
        engineCapacity: '4.0L V8 Mild-Hybrid',
        color: 'Obsidian Black Metallic',
        seats: 5,
        description:
          'Flagship executive saloon with Rear Executive Lounge seating, Burmester 4D surround sound, and active road-scanning air suspension.',
        features: ['Rear Executive Lounge', 'Burmester 4D Sound', 'Air Suspension', 'Night Vision Assist', 'Soft-Close Doors'],
        images: ['/src/assets/images/fleet_executive_sedan_1795470695128.jpg'],
        mainImage: '/src/assets/images/fleet_executive_sedan_1795470695128.jpg',
        salePriceCents: 14500000000,
        rentalPricePerDayCents: 48000000,
        chauffeurAvailable: true,
        available: true,
        published: true,
        archived: false,
        featured: true,
        location: 'Kigali International Airport',
      },
      priv: {
        registrationNumber: 'VM-002-EX',
        vin: 'W1K6G7GB5SA091234',
        internalNotes: 'Primary airport chauffeur VIP transfer unit.',
      },
    },
    {
      id: 'veh-rsq8-perf',
      vehicle: {
        name: '2025 Audi RS Q8 Performance',
        brand: 'Audi',
        model: 'RS Q8',
        year: 2025,
        category: 'Performance SUV',
        listingType: 'SALE',
        mileageKm: 3100,
        transmission: 'Automatic',
        fuelType: 'Petrol',
        engineCapacity: '4.0L TFSI V8',
        color: 'Daytona Matte Graphite',
        seats: 5,
        description:
          'Twin-turbocharged V8 performance SUV with all-wheel steering, RS sport exhaust, and quilted Valcona leather sports seats.',
        features: ['All-Wheel Steering', 'RS Sport Exhaust', 'Matrix LED Headlamps', 'Panoramic Roof', 'Head-Up Display'],
        images: ['/src/assets/images/fleet_performance_suv_1795470696155.jpg'],
        mainImage: '/src/assets/images/fleet_performance_suv_1795470696155.jpg',
        salePriceCents: 15800000000,
        rentalPricePerDayCents: 0,
        chauffeurAvailable: false,
        available: true,
        published: true,
        archived: false,
        featured: true,
        location: 'Main Showroom — Kigali Downtown',
      },
      priv: {
        registrationNumber: 'VM-003-RS',
        vin: 'WA1VVBF12SD044710',
        internalNotes: 'Certified pre-owned warranty valid through 2029.',
      },
    },
    {
      id: 'veh-etron-gt',
      vehicle: {
        name: '2025 Audi RS e-tron GT',
        brand: 'Audi',
        model: 'RS e-tron GT',
        year: 2025,
        category: 'Electric Sport',
        listingType: 'BOTH',
        mileageKm: 1200,
        transmission: 'Single-Speed EV',
        fuelType: 'Electric',
        engineCapacity: 'Dual-Motor AWD 800V',
        color: 'Florett Silver Metallic',
        seats: 4,
        description:
          '800-volt rapid-charging electric sportback delivering instant dual-motor torque, adaptive air suspension, and carbon roof.',
        features: ['800V Fast Charging', 'Carbon Fiber Roof', 'Matrix Laser Lights', 'Apple CarPlay / Android Auto', 'Adaptive Air Ride'],
        images: ['/src/assets/images/fleet_electric_coupe_1795470695796.jpg'],
        mainImage: '/src/assets/images/fleet_electric_coupe_1795470695796.jpg',
        salePriceCents: 16200000000,
        rentalPricePerDayCents: 45000000,
        chauffeurAvailable: true,
        available: true,
        published: true,
        archived: false,
        featured: true,
        location: 'Nyarutarama Executive Hub',
      },
      priv: {
        registrationNumber: 'VM-004-EV',
        vin: 'WAUZZZFW9S7003921',
        internalNotes: 'Includes 22kW home wallbox kit for sale buyers.',
      },
    },
    {
      id: 'veh-db12-volante',
      vehicle: {
        name: '2025 Aston Martin DB12 Volante',
        brand: 'Aston Martin',
        model: 'DB12 Volante',
        year: 2025,
        category: 'Grand Tourer',
        listingType: 'RENTAL',
        mileageKm: 2600,
        transmission: 'Automatic',
        fuelType: 'Petrol',
        engineCapacity: '4.0L Twin-Turbo V8',
        color: 'Satin Pearl White',
        seats: 4,
        description:
          'Open-top grand touring convertible tailored for coastal drives and executive weekend escapes with saddle tan hand-stitched leather.',
        features: ['Acoustic Soft Top', 'Heated & Ventilated Seats', 'Bowers & Wilkins Audio', 'Electronic Rear Diff', 'Wireless Charging'],
        images: ['/src/assets/images/fleet_convertible_roadster_1795470696507.jpg'],
        mainImage: '/src/assets/images/fleet_convertible_roadster_1795470696507.jpg',
        salePriceCents: 0,
        rentalPricePerDayCents: 78000000,
        chauffeurAvailable: true,
        available: true,
        published: true,
        archived: false,
        featured: true,
        location: 'Main Showroom — Kigali Downtown',
      },
      priv: {
        registrationNumber: 'VM-005-VL',
        vin: 'SCFRMFAW2SGL08211',
        internalNotes: 'Dedicated weekend rental fleet asset.',
      },
    },
    {
      id: 'veh-defender-110',
      vehicle: {
        name: '2025 Land Rover Defender 110 Expedition',
        brand: 'Land Rover',
        model: 'Defender 110 V8',
        year: 2025,
        category: 'Performance SUV',
        listingType: 'BOTH',
        mileageKm: 5400,
        transmission: 'Automatic',
        fuelType: 'Petrol',
        engineCapacity: '5.0L Supercharged V8',
        color: 'Carpathian Grey Satin',
        seats: 5,
        description:
          'Expedition-outfitted 4x4 equipped with integrated roof rack, terrain response pro, air suspension, and Meridian surround audio.',
        features: ['Terrain Response Pro', 'Expedition Roof System', 'Wade Sensing', 'Meridian Surround', 'Tow Hitch & Winch Ready'],
        images: ['/src/assets/images/fleet_adventure_4x4_1795470697169.jpg'],
        mainImage: '/src/assets/images/fleet_adventure_4x4_1795470697169.jpg',
        salePriceCents: 12800000000,
        rentalPricePerDayCents: 38000000,
        chauffeurAvailable: true,
        available: true,
        published: true,
        archived: false,
        featured: false,
        location: 'Nyarutarama Executive Hub',
      },
      priv: {
        registrationNumber: 'VM-006-4X',
        vin: 'SALE2FEU8S2190442',
        internalNotes: 'All-terrain tires rotated at 5,000 km service.',
      },
    },
  ];

  for (const item of sampleVehicles) {
    await setDoc(doc(db, 'vehicles', item.id), {
      ...item.vehicle,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'vehicle_private', item.id), {
      vehicleId: item.id,
      ...item.priv,
      updatedAt: serverTimestamp(),
    });
  }

  await writeAuditLog(
    actor,
    'SEED_DEMO_SHOWROOM',
    'System',
    'showroom',
    'Seeded sample brands, categories, business settings, and 6 vehicles'
  );
}
