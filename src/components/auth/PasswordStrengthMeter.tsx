import { Check, Circle } from 'lucide-react';

export interface PasswordValidationResult {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  score: number;
  isValid: boolean;
  label: string;
}

export function evaluatePasswordStrength(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const score = [hasMinLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  let label = 'Too weak';
  if (score === 2) label = 'Fair';
  else if (score === 3) label = 'Good';
  else if (score === 4) label = 'Strong';

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    score,
    isValid,
    label,
  };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const strength = evaluatePasswordStrength(password);

  const barColors = [
    'bg-red-500',
    'bg-amber-500',
    'bg-amber-400',
    'bg-[#20D94B]',
  ];

  const activeColor = barColors[Math.max(0, strength.score - 1)] || 'bg-red-500';

  const rules = [
    { ok: strength.hasMinLength, text: 'At least 8 characters' },
    { ok: strength.hasUppercase, text: 'One uppercase letter' },
    { ok: strength.hasLowercase, text: 'One lowercase letter' },
    { ok: strength.hasNumber, text: 'One number' },
  ];

  return (
    <div className="pt-2 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#A6A6A6]">Password strength</span>
        <span
          className={`font-semibold ${
            strength.isValid ? 'text-[#20D94B]' : strength.score >= 2 ? 'text-amber-400' : 'text-red-400'
          }`}
        >
          {strength.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1 rounded-full transition-colors ${
              strength.score >= step ? activeColor : 'bg-[#353535]'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {rules.map((r) => (
          <div
            key={r.text}
            className={`flex items-center gap-1.5 ${r.ok ? 'text-[#20D94B]' : 'text-[#A6A6A6]'}`}
          >
            {r.ok ? <Check className="w-3 h-3 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
            <span>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
