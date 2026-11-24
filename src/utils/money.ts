/**
 * Centralized monetary parsing and RWF-first formatting helpers.
 * Uses integer minor units (cents) and safe Decimal conversion without
 * performing floating-point arithmetic on persisted totals.
 */

export const DEFAULT_CURRENCY = 'RWF';
export const DEFAULT_CURRENCY_FORMAT = 'RWF_WHOLE';

export type DecimalLike =
  | number
  | string
  | { toNumber?: () => number; toString?: () => string }
  | null
  | undefined;

const ZERO_DECIMAL_CURRENCIES = new Set(['RWF', 'BIF', 'UGX', 'JPY', 'KRW']);

export function normalizeCurrency(currency?: string | null): string {
  const cleaned = String(currency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) {
    return cleaned;
  }
  return DEFAULT_CURRENCY;
}

export function isZeroDecimalCurrency(currency: string = DEFAULT_CURRENCY): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(normalizeCurrency(currency));
}

export function toDecimalNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[^0-9.-]/g, '');
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      const num = value.toNumber();
      return Number.isFinite(num) ? num : 0;
    }
    if (typeof value.toString === 'function') {
      const cleaned = value.toString().trim().replace(/[^0-9.-]/g, '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
  }
  return 0;
}

export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  switch (normalizeCurrency(currency)) {
    case 'RWF':
      return 'RWF ';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'KES':
      return 'KES ';
    case 'AED':
      return 'AED ';
    default:
      return `${normalizeCurrency(currency)} `;
  }
}

/**
 * Formats a major-unit monetary value (Decimal, number, or numeric string).
 * Defaults to Rwanda Franc (`RWF 150,000`) with whole-number formatting.
 */
export function formatCurrency(
  amount: DecimalLike,
  currency: string = DEFAULT_CURRENCY
): string {
  const code = normalizeCurrency(currency);
  const numeric = toDecimalNumber(amount);
  const sign = numeric < 0 ? '-' : '';
  const abs = Math.abs(numeric);

  if (isZeroDecimalCurrency(code)) {
    const whole = Math.round(abs);
    const formatted = new Intl.NumberFormat('en-RW', {
      maximumFractionDigits: 0,
    }).format(whole);
    return `${sign}${code} ${formatted}`;
  }

  const symbol = getCurrencySymbol(code);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${symbol}${formatted}`;
}

/**
 * Formats integer minor units (e.g., 45000000 -> "RWF 450,000").
 */
export function formatMoney(
  cents: DecimalLike,
  currency: string = DEFAULT_CURRENCY
): string {
  const code = normalizeCurrency(currency);
  const safeCents = Math.round(toDecimalNumber(cents));

  if (isZeroDecimalCurrency(code)) {
    const majorWhole = Math.round(safeCents / 100);
    return formatCurrency(majorWhole, code);
  }

  const sign = safeCents < 0 ? '-' : '';
  const absCents = Math.abs(safeCents);
  const whole = Math.trunc(absCents / 100);
  const fraction = absCents % 100;
  const formattedWhole = new Intl.NumberFormat('en-US').format(whole);
  const symbol = getCurrencySymbol(code);

  if (fraction === 0) {
    return `${sign}${symbol}${formattedWhole}`;
  }
  return `${sign}${symbol}${formattedWhole}.${String(fraction).padStart(2, '0')}`;
}

/**
 * Parses a user-entered major-unit monetary amount into integer minor units (cents).
 */
export function amountToCents(raw: DecimalLike): number {
  const str = String(
    typeof raw === 'object' && raw !== null && typeof raw.toString === 'function'
      ? raw.toString()
      : raw ?? ''
  )
    .trim()
    .replace(/[^0-9.]/g, '');
  if (!str) return 0;
  const [wholePart = '0', fracPart = ''] = str.split('.');
  const parsedWhole = Number.parseInt(wholePart || '0', 10);
  const paddedFrac = (fracPart + '00').slice(0, 2);
  const parsedFrac = Number.parseInt(paddedFrac || '0', 10);
  if (!Number.isFinite(parsedWhole) || !Number.isFinite(parsedFrac)) return 0;
  return parsedWhole * 100 + parsedFrac;
}

export function centsToInputString(cents: DecimalLike): string {
  const safe = Math.max(0, Math.round(toDecimalNumber(cents)));
  const whole = Math.trunc(safe / 100);
  const frac = safe % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}
