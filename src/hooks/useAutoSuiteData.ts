import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { applyVerifiedCustomAuthDomain, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { DEFAULT_BUSINESS_SETTING } from '../services/autosuiteService';
import type {
  AuditLog,
  Brand,
  BusinessSetting,
  Favorite,
  NotificationItem,
  RentalBooking,
  RentalPayment,
  SaleInquiry,
  SupportRequest,
  UserProfile,
  Vehicle,
  VehicleCategory,
} from '../types/autosuite';

export function useAutoSuiteData() {
  const { firebaseUser, profile, isAdmin, isStaffOrAdmin, loading: authLoading } = useAuth();

  const [setting, setSetting] = useState<BusinessSetting>(DEFAULT_BUSINESS_SETTING);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [inquiries, setInquiries] = useState<SaleInquiry[]>([]);
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Public listeners: settings, brands, categories, vehicles
  useEffect(() => {
    const unsubSetting = onSnapshot(
      doc(db, 'settings', 'business'),
      (snap) => {
        if (snap.exists()) {
          const nextSetting = {
            id: snap.id,
            ...(snap.data() as Omit<BusinessSetting, 'id'>),
          };
          setSetting(nextSetting);
          applyVerifiedCustomAuthDomain(
            nextSetting.authDomain,
            nextSetting.authDomainVerified
          );
        } else {
          setSetting(DEFAULT_BUSINESS_SETTING);
          applyVerifiedCustomAuthDomain(
            DEFAULT_BUSINESS_SETTING.authDomain,
            DEFAULT_BUSINESS_SETTING.authDomainVerified
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/business')
    );

    const unsubBrands = onSnapshot(
      collection(db, 'brands'),
      (snap) => {
        setBrands(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Brand, 'id'>) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'brands')
    );

    const unsubCats = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        setCategories(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleCategory, 'id'>) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    return () => {
      unsubSetting();
      unsubBrands();
      unsubCats();
    };
  }, []);

  // Vehicles listener depends on role
  useEffect(() => {
    if (authLoading) return;
    setCatalogLoading(true);
    const vehiclesQuery = isStaffOrAdmin
      ? collection(db, 'vehicles')
      : query(
          collection(db, 'vehicles'),
          where('published', '==', true),
          where('archived', '==', false)
        );

    const unsubVehicles = onSnapshot(
      vehiclesQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, 'id'>) }));
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year);
        setVehicles(list);
        setCatalogLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    return () => unsubVehicles();
  }, [authLoading, isStaffOrAdmin]);

  // Authenticated user & RBAC listeners
  useEffect(() => {
    if (authLoading || !firebaseUser || !firebaseUser.emailVerified || !profile) {
      setFavorites([]);
      setInquiries([]);
      setBookings([]);
      setPayments([]);
      setNotifications([]);
      setUsers([]);
      setAuditLogs([]);
      setSupportRequests([]);
      return;
    }

    const unsubFavs = onSnapshot(
      query(collection(db, 'favorites'), where('userId', '==', profile.uid)),
      (snap) => {
        setFavorites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Favorite, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'favorites')
    );

    const inquiriesQuery = isStaffOrAdmin
      ? collection(db, 'inquiries')
      : query(collection(db, 'inquiries'), where('customerId', '==', profile.uid));

    const unsubInquiries = onSnapshot(
      inquiriesQuery,
      (snap) => {
        setInquiries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SaleInquiry, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'inquiries')
    );

    const bookingsQuery = isStaffOrAdmin
      ? collection(db, 'bookings')
      : query(collection(db, 'bookings'), where('customerId', '==', profile.uid));

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RentalBooking, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
    );

    const paymentsQuery = isStaffOrAdmin
      ? collection(db, 'payments')
      : query(collection(db, 'payments'), where('customerId', '==', profile.uid));

    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RentalPayment, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    const notifQuery = isStaffOrAdmin
      ? query(collection(db, 'notifications'), where('audience', '==', 'ADMIN'))
      : query(collection(db, 'notifications'), where('userId', '==', profile.uid));

    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    let unsubUsers = () => {};
    if (isStaffOrAdmin) {
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
    }

    let unsubAudit = () => {};
    if (isAdmin) {
      unsubAudit = onSnapshot(
        collection(db, 'audit_logs'),
        (snap) => {
          setAuditLogs(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
      );
    }

    const supportQuery = isStaffOrAdmin
      ? collection(db, 'support_requests')
      : query(collection(db, 'support_requests'), where('customerId', '==', profile.uid));

    const unsubSupport = onSnapshot(
      supportQuery,
      (snap) => {
        setSupportRequests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportRequest, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'support_requests')
    );

    return () => {
      unsubFavs();
      unsubInquiries();
      unsubBookings();
      unsubPayments();
      unsubNotifs();
      unsubUsers();
      unsubAudit();
      unsubSupport();
    };
  }, [authLoading, firebaseUser, profile, isAdmin, isStaffOrAdmin]);

  return {
    setting,
    brands,
    categories,
    vehicles,
    favorites,
    inquiries,
    bookings,
    payments,
    notifications,
    users,
    auditLogs,
    supportRequests,
    catalogLoading,
  };
}
