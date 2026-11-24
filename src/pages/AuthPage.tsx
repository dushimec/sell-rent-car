import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { AuthSplitLayout } from '../components/auth/AuthSplitLayout';
import { EmailVerificationPanel } from '../components/auth/EmailVerificationPanel';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import {
  evaluatePasswordStrength,
  PasswordStrengthMeter,
} from '../components/auth/PasswordStrengthMeter';
import { useAuth } from '../context/AuthContext';
import type { BusinessSetting } from '../types/autosuite';

function sanitizeRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
    return null;
  }
  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/auth'];
  if (authPaths.some((p) => trimmed === p || trimmed.startsWith(`${p}?`))) {
    return null;
  }
  return trimmed;
}

function buildAuthLink(basePath: string, redirect: string | null, intent: string | null): string {
  const params = new URLSearchParams();
  if (redirect) params.set('redirect', redirect);
  if (intent) params.set('intent', intent);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function RedirectReasonBanner({
  redirectTarget,
  intent,
  activeMode,
}: {
  redirectTarget: string | null;
  intent: string | null;
  activeMode: 'login' | 'register';
}) {
  if (!redirectTarget && !intent) return null;
  const loginHref = buildAuthLink('/login', redirectTarget, intent);
  const registerHref = buildAuthLink('/register', redirectTarget, intent);

  return (
    <div className="p-4 rounded-xl bg-[#171717] border border-[#20D94B]/40 space-y-3">
      <p className="text-xs text-white leading-relaxed">
        Please sign in or create an account to continue. Your account allows you to track your
        purchase inquiries and rental bookings.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={loginHref}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeMode === 'login'
              ? 'bg-[#20D94B] text-[#080808]'
              : 'bg-[#202020] border border-[#353535] text-white hover:border-[#20D94B]'
          }`}
        >
          Sign In
        </Link>
        <Link
          to={registerHref}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeMode === 'register'
              ? 'bg-[#20D94B] text-[#080808]'
              : 'bg-[#202020] border border-[#353535] text-white hover:border-[#20D94B]'
          }`}
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

function useAuthRedirect() {
  const { profile, loading, isEmailVerified, isStaffOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = sanitizeRedirectPath(searchParams.get('redirect'));
  const intent = searchParams.get('intent');

  useEffect(() => {
    if (!loading && profile && isEmailVerified) {
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true });
      } else {
        navigate(isStaffOrAdmin ? '/admin' : '/account', { replace: true });
      }
    }
  }, [loading, profile, isEmailVerified, isStaffOrAdmin, navigate, redirectTarget]);

  return { redirectTarget, intent };
}

function OrDivider() {
  return (
    <div className="relative flex items-center py-1">
      <div className="flex-grow border-t border-[#353535]" />
      <span className="shrink-0 mx-3 text-[11px] font-semibold tracking-widest uppercase text-[#A6A6A6]">
        OR
      </span>
      <div className="flex-grow border-t border-[#353535]" />
    </div>
  );
}

export function LoginPage({ setting }: { setting: BusinessSetting }) {
  const { redirectTarget, intent } = useAuthRedirect();
  const {
    firebaseUser,
    isEmailVerified,
    loading,
    authError,
    clearAuthError,
    signInWithEmail,
    signInWithGoogle,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
    setLocalError(null);
  }, [clearAuthError]);

  if (firebaseUser && !isEmailVerified) {
    return (
      <AuthSplitLayout setting={setting}>
        <EmailVerificationPanel />
      </AuthSplitLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email, password, rememberMe);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    clearAuthError();
    setGoogleBusy(true);
    try {
      await signInWithGoogle(rememberMe);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const displayError = localError || authError;
  const registerHref = buildAuthLink('/register', redirectTarget, intent);

  return (
    <AuthSplitLayout setting={setting}>
      <div className="space-y-6">
        <RedirectReasonBanner
          redirectTarget={redirectTarget}
          intent={intent}
          activeMode="login"
        />

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome Back
          </h1>
          <p className="text-sm text-[#A6A6A6]">Sign in to continue to your account.</p>
        </div>

        {displayError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-semibold text-[#A6A6A6]">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-semibold text-[#A6A6A6]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6A6A6] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="inline-flex items-center gap-2 text-xs text-[#A6A6A6] hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-[#20D94B] bg-[#171717] border-[#353535] cursor-pointer"
              />
              Remember me
            </label>

            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#A6A6A6] hover:text-[#20D94B] transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting || googleBusy || loading}
            className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 hover:shadow-[0_0_24px_rgba(32,217,75,0.25)] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <OrDivider />

        <GoogleAuthButton
          onClick={() => void handleGoogle()}
          loading={googleBusy}
          disabled={submitting || loading}
        />

        <p className="text-center text-xs text-[#A6A6A6] pt-2">
          Don&apos;t have an account?{' '}
          <Link to={registerHref} className="text-white hover:text-[#20D94B] font-semibold transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

export function RegisterPage({ setting }: { setting: BusinessSetting }) {
  const { redirectTarget, intent } = useAuthRedirect();
  const {
    firebaseUser,
    isEmailVerified,
    loading,
    authError,
    clearAuthError,
    registerWithEmail,
    signInWithGoogle,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsPreview, setShowTermsPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
    setLocalError(null);
  }, [clearAuthError]);

  if (firebaseUser && !isEmailVerified) {
    return (
      <AuthSplitLayout setting={setting}>
        <EmailVerificationPanel />
      </AuthSplitLayout>
    );
  }

  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setLocalError('Please complete your full name, email address, and phone number.');
      return;
    }
    if (!strength.isValid) {
      setLocalError('Please choose a stronger password meeting all security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter your confirmation password.');
      return;
    }
    if (!acceptedTerms) {
      setLocalError('Please accept the Terms and Conditions to create your account.');
      return;
    }

    setSubmitting(true);
    try {
      await registerWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    clearAuthError();
    setGoogleBusy(true);
    try {
      await signInWithGoogle(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const displayError = localError || authError;
  const loginHref = buildAuthLink('/login', redirectTarget, intent);

  return (
    <AuthSplitLayout setting={setting}>
      <div className="space-y-5">
        <RedirectReasonBanner
          redirectTarget={redirectTarget}
          intent={intent}
          activeMode="register"
        />

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Create Your Account
          </h1>
          <p className="text-sm text-[#A6A6A6]">
            Register with {setting.businessName} to track purchase inquiries and rental bookings.
          </p>
        </div>

        {displayError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-xs font-semibold text-[#A6A6A6]">
              Full name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jordan Vance"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block text-xs font-semibold text-[#A6A6A6]">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-[#A6A6A6]">
                Phone number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 010-2400"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="block text-xs font-semibold text-[#A6A6A6]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6A6A6] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[#A6A6A6]">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#171717] border focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors ${
                  passwordsMatch
                    ? 'border-[#353535] focus:border-[#20D94B]'
                    : 'border-red-500/70 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6A6A6] hover:text-white transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!passwordsMatch && (
              <p className="text-[11px] text-red-400">Passwords do not match.</p>
            )}
          </div>

          <div className="pt-1 space-y-2">
            <label className="flex items-start gap-2.5 text-xs text-[#A6A6A6] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="w-4 h-4 mt-0.5 rounded accent-[#20D94B] bg-[#171717] border-[#353535] cursor-pointer shrink-0"
              />
              <span>
                I accept the{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsPreview((prev) => !prev)}
                  className="text-white hover:text-[#20D94B] underline underline-offset-2 font-semibold cursor-pointer"
                >
                  Terms and Conditions
                </button>{' '}
                of {setting.businessName}.
              </span>
            </label>

            {showTermsPreview && (
              <div className="p-3 rounded-xl bg-[#171717] border border-[#353535] text-[11px] text-[#A6A6A6] leading-relaxed">
                By creating an account with {setting.businessName}, you agree to provide accurate
                contact and driver identification records for vehicle purchase inquiries and rental
                reservations. {setting.rentalPolicy}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || googleBusy || loading}
            className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 hover:shadow-[0_0_24px_rgba(32,217,75,0.25)] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <OrDivider />

        <GoogleAuthButton
          onClick={() => void handleGoogle()}
          loading={googleBusy}
          disabled={submitting || loading}
        />

        <p className="text-center text-xs text-[#A6A6A6] pt-1">
          Already have an account?{' '}
          <Link to={loginHref} className="text-white hover:text-[#20D94B] font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

export function ForgotPasswordPage({ setting }: { setting: BusinessSetting }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout setting={setting}>
      {submitted ? (
        <div className="space-y-6">
          <div className="w-11 h-11 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-center text-[#20D94B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Check Your Email
            </h1>
            <p className="text-sm text-[#A6A6A6] leading-relaxed">
              If an account matches <span className="text-white font-semibold">{email.trim()}</span>,
              we have sent password recovery instructions to that address.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition"
          >
            Return to Sign In
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A6A6A6] hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Sign In
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Forgot Your Password?
            </h1>
            <p className="text-sm text-[#A6A6A6] leading-relaxed">
              Enter the email address associated with your account and we&apos;ll send instructions to
              reset your password.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#A6A6A6]">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Reset Link
            </button>
          </form>
        </div>
      )}
    </AuthSplitLayout>
  );
}

export function ResetPasswordPage({ setting }: { setting: BusinessSetting }) {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') || '';
  const serverToken = searchParams.get('token') || '';
  const { verifyFirebaseResetCode, confirmResetPassword } = useAuth();

  const [checkingCode, setCheckingCode] = useState(Boolean(oobCode));
  const [targetEmail, setTargetEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setCheckingCode(false);
      return;
    }

    let cancelled = false;
    setCheckingCode(true);
    setCodeError(null);

    void verifyFirebaseResetCode(oobCode)
      .then((email) => {
        if (!cancelled) {
          setTargetEmail(email);
          setCheckingCode(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCodeError(
            err instanceof Error ? err.message : 'This password reset link is invalid or expired.'
          );
          setCheckingCode(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode, verifyFirebaseResetCode]);

  const strength = evaluatePasswordStrength(newPassword);
  const passwordsMatch = !confirmPassword || newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!strength.isValid) {
      setSubmitError('Please enter a password meeting all strength requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmResetPassword({
        oobCode: oobCode || undefined,
        token: serverToken || undefined,
        newPassword,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingCode) {
    return (
      <AuthSplitLayout setting={setting}>
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#20D94B]" />
          <p className="text-sm text-[#A6A6A6]">Verifying password reset link...</p>
        </div>
      </AuthSplitLayout>
    );
  }

  if (success) {
    return (
      <AuthSplitLayout setting={setting}>
        <div className="space-y-6">
          <div className="w-11 h-11 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-center text-[#20D94B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Password Updated
            </h1>
            <p className="text-sm text-[#A6A6A6] leading-relaxed">
              Your account password has been updated. You may now sign in with your new credentials.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center hover:brightness-110 transition"
          >
            Continue to Sign In
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if ((!oobCode && !serverToken) || codeError) {
    return (
      <AuthSplitLayout setting={setting}>
        <div className="space-y-6">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Reset Link Unavailable
            </h1>
            <p className="text-sm text-[#A6A6A6] leading-relaxed">
              {codeError ||
                'This password reset link is incomplete or has expired. Request a new password reset link to continue.'}
            </p>
          </div>
          <div className="space-y-3">
            <Link
              to="/forgot-password"
              className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center hover:brightness-110 transition"
            >
              Request New Reset Link
            </Link>
            <Link
              to="/login"
              className="w-full h-11 px-4 rounded-xl bg-[#171717] border border-[#353535] text-white font-semibold text-sm inline-flex items-center justify-center hover:border-[#4D4D4D] transition"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout setting={setting}>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Set New Password
          </h1>
          <p className="text-sm text-[#A6A6A6]">
            {targetEmail
              ? `Create a new password for ${targetEmail}.`
              : 'Choose a strong password for your account.'}
          </p>
        </div>

        {submitError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-new-pwd" className="block text-xs font-semibold text-[#A6A6A6]">
              New password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reset-new-pwd"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#171717] border border-[#353535] focus:border-[#20D94B] focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6A6A6] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm-pwd" className="block text-xs font-semibold text-[#A6A6A6]">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reset-confirm-pwd"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#171717] border focus:outline-none text-sm text-white placeholder:text-[#A6A6A6]/50 transition-colors ${
                  passwordsMatch
                    ? 'border-[#353535] focus:border-[#20D94B]'
                    : 'border-red-500/70 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6A6A6] hover:text-white transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!passwordsMatch && (
              <p className="text-[11px] text-red-400">Passwords do not match.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}

export function AuthPage({ setting }: { setting: BusinessSetting }) {
  return <LoginPage setting={setting} />;
}
