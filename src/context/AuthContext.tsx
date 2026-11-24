import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getRedirectResult,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, testFirestoreConnection } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type { UserProfile, UserRole } from '../types/autosuite';

const BOOTSTRAP_ADMIN_EMAIL = 'dushimec515@gmail.com';

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface ConfirmResetPayload {
  oobCode?: string;
  token?: string;
  newPassword: string;
  confirmPassword: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  serverSessionToken: string | null;
  sessionExpiresAt: number | null;
  isEmailVerified: boolean;
  isGoogleLinked: boolean;
  isPasswordLinked: boolean;
  signInWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  registerWithEmail: (payload: RegisterPayload) => Promise<{ emailSent: boolean }>;
  signInWithGoogle: (rememberMe?: boolean) => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyFirebaseResetCode: (oobCode: string) => Promise<string>;
  confirmResetPassword: (payload: ConfirmResetPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isStaffOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Sign in or reset your password instead.';
    case 'auth/weak-password':
      return 'Password does not meet security requirements. Use at least 8 characters with uppercase, lowercase, and numbers.';
    case 'auth/too-many-requests':
      return 'Too many attempts detected. Please wait a few minutes before trying again.';
    case 'auth/user-disabled':
      return 'This account has been deactivated. Contact your dealership administrator for assistance.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before completion.';
    case 'auth/popup-blocked':
      return 'Browser blocked the Google pop-up. Continuing via redirect...';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In in Firebase Console -> Authentication -> Settings -> Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is not yet enabled in Firebase Console -> Authentication -> Sign-in method.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a password. Sign in with your password, then link Google from My Profile.';
    case 'auth/credential-already-in-use':
      return 'This Google account is already connected to a different user profile.';
    case 'auth/provider-already-linked':
      return 'Google Sign-In is already linked to this account.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'This verification or password reset link is invalid or has expired. Please request a new one.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before modifying linked sign-in methods.';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting authentication servers. Please try again.';
    default:
      return err instanceof Error ? err.message : 'Authentication request failed.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [serverSessionToken, setServerSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

  const rememberMeRef = useRef<boolean>(true);
  const pendingSignupMetaRef = useRef<{ fullName: string; phone: string } | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const exchangeBackendSession = useCallback(async (user: User, rememberMe: boolean) => {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, rememberMe }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        sessionToken?: string;
        expiresAt?: number;
      };
      if (data.sessionToken && typeof data.expiresAt === 'number') {
        setServerSessionToken(data.sessionToken);
        setSessionExpiresAt(data.expiresAt);
      }
    } catch {
      // Keep client Firebase auth intact if transient network issue occurs during session exchange
    }
  }, []);

  useEffect(() => {
    void testFirestoreConnection();

    void getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await exchangeBackendSession(result.user, rememberMeRef.current);
        }
      })
      .catch((err) => {
        setAuthError(mapFirebaseAuthError(err));
      });

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setProfile(null);
        setServerSessionToken(null);
        setSessionExpiresAt(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const isBootAdmin =
            user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified;
          const signupMeta = pendingSignupMetaRef.current;
          pendingSignupMetaRef.current = null;

          const newProfile = {
            uid: user.uid,
            email: user.email || '',
            fullName:
              signupMeta?.fullName?.trim() ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'Client Account',
            phone: signupMeta?.phone?.trim() || user.phoneNumber || '',
            address: '',
            driverLicenseNo: '',
            role: (isBootAdmin ? 'SUPER_ADMIN' : 'CUSTOMER') as UserRole,
            permissions: isBootAdmin ? ['ALL'] : [],
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
        }

        void exchangeBackendSession(user, rememberMeRef.current);

        unsubscribeProfile = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }
        );
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [exchangeBackendSession]);

  const logout = useCallback(async () => {
    try {
      if (serverSessionToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${serverSessionToken}` },
        }).catch(() => undefined);
      }
    } finally {
      setServerSessionToken(null);
      setSessionExpiresAt(null);
      await signOut(auth);
    }
  }, [serverSessionToken]);

  // Enforce automatic expiration of server session lifetime
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      void logout();
      return;
    }
    const maxTimeout = Math.min(remainingMs, 2147483647);
    const timer = window.setTimeout(() => {
      if (Date.now() >= sessionExpiresAt) {
        void logout();
      }
    }, maxTimeout);
    return () => window.clearTimeout(timer);
  }, [sessionExpiresAt, logout]);

  const signInWithEmail = async (email: string, password: string, rememberMe: boolean) => {
    setAuthError(null);
    rememberMeRef.current = rememberMe;
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await exchangeBackendSession(cred.user, rememberMe);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const registerWithEmail = async (
    payload: RegisterPayload
  ): Promise<{ emailSent: boolean }> => {
    setAuthError(null);
    rememberMeRef.current = true;
    pendingSignupMetaRef.current = {
      fullName: payload.fullName.trim(),
      phone: payload.phone.trim(),
    };

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(
        auth,
        payload.email.trim(),
        payload.password
      );
      if (payload.fullName.trim()) {
        await updateProfile(cred.user, { displayName: payload.fullName.trim() });
      }
      let emailSent = false;
      try {
        await sendEmailVerification(cred.user, {
          url: `${window.location.origin}/login`,
        });
        emailSent = true;
      } catch {
        emailSent = false;
      }
      await exchangeBackendSession(cred.user, true);
      return { emailSent };
    } catch (err) {
      pendingSignupMetaRef.current = null;
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async (rememberMe = true) => {
    setAuthError(null);
    rememberMeRef.current = rememberMe;
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithPopup(auth, googleProvider);
      await exchangeBackendSession(cred.user, rememberMe);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const linkGoogleAccount = async () => {
    if (!auth.currentUser) {
      throw new Error('You must be signed in to link a Google account.');
    }
    setAuthError(null);
    try {
      const cred = await linkWithPopup(auth.currentUser, googleProvider);
      await cred.user.reload();
      setFirebaseUser({ ...cred.user });
      await exchangeBackendSession(cred.user, rememberMeRef.current);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No active account session found.');
    }
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/login`,
      });
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthError(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const updated = auth.currentUser;
      setFirebaseUser(updated ? ({ ...updated } as User) : null);
      if (updated?.emailVerified) {
        await exchangeBackendSession(updated, rememberMeRef.current);
        return true;
      }
      return false;
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const requestPasswordReset = async (email: string) => {
    setAuthError(null);
    const trimmed = email.trim();
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Please enter a valid email address.');
    }

    try {
      await sendPasswordResetEmail(auth, trimmed, {
        url: `${window.location.origin}/login`,
      });
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      // Never disclose account existence when user-not-found is returned
      if (code === 'auth/user-not-found') {
        return;
      }
      if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') {
        throw new Error(mapFirebaseAuthError(err));
      }
    }
  };

  const verifyFirebaseResetCode = async (oobCode: string): Promise<string> => {
    try {
      return await verifyPasswordResetCode(auth, oobCode);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const confirmResetPassword = async (payload: ConfirmResetPayload) => {
    setAuthError(null);
    const res = await fetch('/api/auth/reset-password/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Password reset validation failed.');
    }

    if (payload.oobCode) {
      try {
        await confirmPasswordReset(auth, payload.oobCode, payload.newPassword);
      } catch (err) {
        throw new Error(mapFirebaseAuthError(err));
      }
    }
  };

  const hasRole = (roles: UserRole[]) => {
    if (!profile || !profile.active || !firebaseUser?.emailVerified) return false;
    return roles.includes(profile.role);
  };

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);
  const isGoogleLinked = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'google.com')
  );
  const isPasswordLinked = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'password')
  );

  const isAdmin = Boolean(
    isEmailVerified &&
      profile?.active &&
      (profile.role === 'SUPER_ADMIN' || profile.role === 'BUSINESS_ADMIN')
  );
  const isStaffOrAdmin = Boolean(
    isEmailVerified &&
      profile?.active &&
      (profile.role === 'SUPER_ADMIN' ||
        profile.role === 'BUSINESS_ADMIN' ||
        profile.role === 'STAFF')
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        clearAuthError,
        serverSessionToken,
        sessionExpiresAt,
        isEmailVerified,
        isGoogleLinked,
        isPasswordLinked,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        linkGoogleAccount,
        resendVerificationEmail,
        refreshVerificationStatus,
        requestPasswordReset,
        verifyFirebaseResetCode,
        confirmResetPassword,
        logout,
        hasRole,
        isAdmin,
        isStaffOrAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
