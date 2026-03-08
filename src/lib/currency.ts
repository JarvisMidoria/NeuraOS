export const ALLOWED_CURRENCY_CODES = ["EUR", "USD", "MAD"] as const;

export type AllowedCurrencyCode = (typeof ALLOWED_CURRENCY_CODES)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_CURRENCY_CODES);

export function normalizeCurrencyCode(input?: string | null): AllowedCurrencyCode {
  const upper = (input ?? "").toUpperCase();
  if (ALLOWED_SET.has(upper)) return upper as AllowedCurrencyCode;
  return "USD";
}

export function formatCurrency(
  value: number,
  locale: string,
  currencyCode?: string | null,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizeCurrencyCode(currencyCode),
    maximumFractionDigits,
  }).format(value);
}
