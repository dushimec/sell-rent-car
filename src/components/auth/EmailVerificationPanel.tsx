import { useState } from 'react';
import { CheckCircle2, Loader2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function EmailVerificationPanel() {
  const {
    firebaseUser,
    resendVerificationEmail,
    refreshVerificationStatus,
    logout,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckVerified = async () => {
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified) {
        setError(
          'Your email is not verified yet. Please click the verification link sent to your inbox, then check again.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resendVerificationEmail();
      setNotice('A fresh verification email has been sent to your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="w-11 h-11 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-center text-[#20D94B] mb-3">
          <MailCheck className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Verify Your Email
        </h1>
        <p className="text-sm text-[#A6A6A6] leading-relaxed">
          We sent a verification link to{' '}
          <span className="text-white font-semibold">{firebaseUser?.email}</span>. Verify your email
          address to activate your account and access your portal.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
          {error}
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-[#20D94B]/10 border border-[#20D94B]/40 text-xs text-[#20D94B] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleCheckVerified()}
          disabled={checking}
          className="w-full h-11 px-4 rounded-xl bg-[#20D94B] text-[#080808] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          I&apos;ve Verified My Email — Continue
        </button>

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resending}
          className="w-full h-11 px-4 rounded-xl bg-[#171717] border border-[#353535] hover:border-[#4D4D4D] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {resending && <Loader2 className="w-4 h-4 animate-spin text-[#A6A6A6]" />}
          Resend Verification Email
        </button>
      </div>

      <div className="pt-4 border-t border-[#353535] flex items-center justify-between text-xs text-[#A6A6A6]">
        <span>Wrong email address?</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-1.5 text-white hover:text-[#20D94B] font-semibold transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
