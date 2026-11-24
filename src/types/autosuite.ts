export type BusinessMode = 'SALES_ONLY' | 'RENTAL_ONLY' | 'COMBINED';
export type UserRole = 'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'STAFF' | 'CUSTOMER';
export type ListingType = 'SALE' | 'RENTAL' | 'BOTH';
export type TransmissionType = 'Automatic' | 'Manual' | 'Dual-Clutch' | 'Single-Speed EV';
export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';

// Car Sales Workflow Types
export type SalePaymentPreference = 'CASH' | 'BANK_FINANCING' | 'OTHER';
export type PurchaseTimeline =
  | 'IMMEDIATELY'
  | 'WITHIN_ONE_MONTH'
  | 'WITHIN_THREE_MONTHS'
  | 'LATER';
export type InquiryStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'NEGOTIATING'
  | 'INSPECTION_SCHEDULED'
  | 'OFFER_SENT'
  | 'SOLD'
  | 'CLOSED_UNSUCCESSFUL';

// Car Rental Workflow Types
export type RentalMode = 'SELF_DRIVE' | 'CHAUFFEUR';
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';
export type PaymentType = 'DEPOSIT' | 'RENTAL_PAYMENT' | 'REFUND';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'OTHER';

export interface BusinessSetting {
  id: string;
  businessName: string;
  tagline: string;
  businessMode: BusinessMode;
  currency: string;
  currencyFormat?: string;
  language: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  websiteDomain?: string;
  authDomain?: string;
  authDomainVerified?: boolean;
  supportEmail?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutContent: string;
  rentalPolicy: string;
  depositPercent: number;
  chauffeurFeePerDayCents: number;
  locations: string[];
  logoUrl: string;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  driverLicenseNo?: string;
  role: UserRole;
  permissions: string[];
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Brand {
  id: string;
  name: string;
  country?: string;
  createdAt?: unknown;
}

export interface VehicleCategory {
  id: string;
  name: string;
  description?: string;
  createdAt?: unknown;
}

export interface Vehicle {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  listingType: ListingType;
  mileageKm: number;
  transmission: TransmissionType;
  fuelType: FuelType;
  engineCapacity: string;
  color: string;
  seats: number;
  description: string;
  features: string[];
  images: string[];
  mainImage: string;
  salePriceCents: number;
  rentalPricePerDayCents: number;
  chauffeurAvailable: boolean;
  available: boolean;
  published: boolean;
  archived: boolean;
  featured: boolean;
  location: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VehiclePrivate {
  vehicleId: string;
  registrationNumber: string;
  vin?: string;
  internalNotes?: string;
  updatedAt?: unknown;
}

export interface ScheduleSlot {
  bookingId: string;
  pickupAt: string;
  returnAt: string;
}

export interface VehicleSchedule {
  vehicleId: string;
  slots: ScheduleSlot[];
  updatedAt?: unknown;
}

export interface Favorite {
  id: string;
  userId: string;
  vehicleId: string;
  createdAt?: unknown;
}

export interface InquiryNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface SaleInquiry {
  id: string;
  inquiryReference: string;
  customerId: string;
  vehicleId: string;
  vehicleName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  preferredBudgetCents: number;
  currency: string;
  preferredPaymentMethod: SalePaymentPreference;
  purchaseTimeline: PurchaseTimeline;
  needsFinancing: boolean;
  preferredInspectionDate?: string;
  message?: string;
  status: InquiryStatus;
  assignedStaffId?: string;
  assignedStaffName?: string;
  followUpDate?: string;
  notes: InquiryNote[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RentalBooking {
  id: string;
  bookingReference: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleId: string;
  vehicleName: string;
  pickupLocation: string;
  returnLocation: string;
  pickupAt: string;
  returnAt: string;
  rentalMode: RentalMode;
  additionalServices: string[];
  specialRequests?: string;
  days: number;
  currency: string;
  dailyRateCents: number;
  chauffeurFeeCents: number;
  additionalServicesCents: number;
  totalAmountCents: number;
  requiredDepositCents: number;
  paidAmountCents: number;
  status: BookingStatus;
  contractReference?: string;
  pickupInspectionNote?: string;
  returnInspectionNote?: string;
  assignedStaffId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RentalPayment {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  amountCents: number;
  currency: string;
  paymentType: PaymentType;
  method: PaymentMethod;
  reference: string;
  notes: string;
  paidAt: string;
  recordedBy: string;
  createdAt?: unknown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  audience: 'USER' | 'ADMIN';
  title: string;
  message: string;
  type: 'BOOKING' | 'INQUIRY' | 'PAYMENT' | 'SYSTEM';
  read: boolean;
  link?: string;
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt?: unknown;
}

export type SupportCategory = 'BOOKING' | 'PURCHASE' | 'PAYMENT' | 'ACCOUNT' | 'GENERAL';

export interface SupportRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  category: SupportCategory;
  relatedRef?: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt?: unknown;
  updatedAt?: unknown;
}
