import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAutoSuiteData } from './hooks/useAutoSuiteData';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import {
  AuthPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/AuthPage';
import { CustomerPortalPage } from './pages/CustomerPortalPage';
import { FleetPage } from './pages/FleetPage';
import { HomePage } from './pages/HomePage';
import { AboutPage, ContactPage, FaqPage } from './pages/InfoPages';
import { PurchaseActionPage } from './pages/PurchaseActionPage';
import { RentalActionPage } from './pages/RentalActionPage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';

function RequireVerifiedCustomer({
  intent,
  children,
}: {
  intent: string;
  children: React.ReactNode;
}) {
  const { profile, loading, isEmailVerified } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="h-72 rounded-2xl bg-[#202020] border border-[#353535] animate-pulse" />
      </div>
    );
  }

  if (!profile || !isEmailVerified) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}&intent=${encodeURIComponent(intent)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

function AutoSuiteRoutes() {
  const {
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
  } = useAutoSuiteData();

  useEffect(() => {
    document.title = `${setting.businessName} — Automotive Sales & Fleet Rental`;
  }, [setting.businessName]);

  const portalElement = (
    <RequireVerifiedCustomer intent="account">
      <PublicLayout setting={setting}>
        <CustomerPortalPage
          setting={setting}
          vehicles={vehicles}
          favorites={favorites}
          bookings={bookings}
          inquiries={inquiries}
          payments={payments}
          notifications={notifications}
          supportRequests={supportRequests}
        />
      </PublicLayout>
    </RequireVerifiedCustomer>
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicLayout setting={setting}>
            <HomePage
              setting={setting}
              vehicles={vehicles}
              brands={brands}
              categories={categories}
              favorites={favorites}
              catalogLoading={catalogLoading}
            />
          </PublicLayout>
        }
      />

      <Route
        path="/fleet"
        element={
          <PublicLayout setting={setting}>
            <FleetPage
              setting={setting}
              vehicles={vehicles}
              brands={brands}
              categories={categories}
              favorites={favorites}
              modeFilter="ALL"
              title="Complete Showroom Fleet"
              subtitle="Browse certified vehicles available for purchase or flexible rental."
            />
          </PublicLayout>
        }
      />

      <Route
        path="/sales"
        element={
          <PublicLayout setting={setting}>
            <FleetPage
              setting={setting}
              vehicles={vehicles}
              brands={brands}
              categories={categories}
              favorites={favorites}
              modeFilter="SALE"
              title="Cars for Sale"
              subtitle="Certified vehicles available for purchase, financing consultation, and private inspection."
            />
          </PublicLayout>
        }
      />

      <Route
        path="/rentals"
        element={
          <PublicLayout setting={setting}>
            <FleetPage
              setting={setting}
              vehicles={vehicles}
              brands={brands}
              categories={categories}
              favorites={favorites}
              modeFilter="RENTAL"
              title="Cars for Rent"
              subtitle="Self-drive or chauffeur-driven fleet with verified schedule availability."
            />
          </PublicLayout>
        }
      />

      <Route
        path="/vehicles/:id"
        element={
          <PublicLayout setting={setting}>
            <VehicleDetailPage setting={setting} vehicles={vehicles} favorites={favorites} />
          </PublicLayout>
        }
      />

      <Route
        path="/cars-for-sale/:vehicleId/inquiry"
        element={
          <RequireVerifiedCustomer intent="purchase">
            <PublicLayout setting={setting}>
              <PurchaseActionPage
                setting={setting}
                vehicles={vehicles}
                catalogLoading={catalogLoading}
              />
            </PublicLayout>
          </RequireVerifiedCustomer>
        }
      />

      <Route
        path="/cars-for-rent/:vehicleId/book"
        element={
          <RequireVerifiedCustomer intent="rental">
            <PublicLayout setting={setting}>
              <RentalActionPage
                setting={setting}
                vehicles={vehicles}
                catalogLoading={catalogLoading}
              />
            </PublicLayout>
          </RequireVerifiedCustomer>
        }
      />

      <Route
        path="/about"
        element={
          <PublicLayout setting={setting}>
            <AboutPage setting={setting} />
          </PublicLayout>
        }
      />

      <Route
        path="/contact"
        element={
          <PublicLayout setting={setting}>
            <ContactPage setting={setting} />
          </PublicLayout>
        }
      />

      <Route
        path="/faq"
        element={
          <PublicLayout setting={setting}>
            <FaqPage />
          </PublicLayout>
        }
      />

      <Route path="/login" element={<LoginPage setting={setting} />} />
      <Route path="/register" element={<RegisterPage setting={setting} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage setting={setting} />} />
      <Route path="/reset-password" element={<ResetPasswordPage setting={setting} />} />
      <Route path="/auth" element={<AuthPage setting={setting} />} />

      <Route path="/account/*" element={portalElement} />
      <Route path="/portal/*" element={portalElement} />

      <Route
        path="/admin/*"
        element={
          <AdminDashboardPage
            setting={setting}
            brands={brands}
            categories={categories}
            vehicles={vehicles}
            inquiries={inquiries}
            bookings={bookings}
            payments={payments}
            notifications={notifications}
            users={users}
            auditLogs={auditLogs}
          />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AutoSuiteRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
