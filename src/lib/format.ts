type Fmt = { currency_code: string; locale: string; timezone?: string };

export function money(value: number | string | null | undefined, b: Fmt): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(b.locale, { style: 'currency', currency: b.currency_code }).format(n);
  } catch {
    return `${b.currency_code} ${n.toFixed(2)}`;
  }
}

export function dateTime(iso: string, b: Fmt): string {
  try {
    return new Intl.DateTimeFormat(b.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: b.timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** Fecha local YYYY-MM-DD en la zona horaria indicada. */
export function dayKey(d: Date | string, timeZone: string): string {
  try {
    return new Date(d).toLocaleDateString('en-CA', { timeZone });
  } catch {
    return new Date(d).toISOString().slice(0, 10);
  }
}

export function addDays(key: string, n: number): string {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function shortDay(key: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(key + 'T00:00:00Z'));
  } catch {
    return key.slice(5);
  }
}

export function currencyName(code: string, locale = 'es'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcula totales con la misma fórmula que la función create_sale de la base de datos (solo para mostrar). */
export function computeTotals(gross: number, discount: number, taxRate: number, pricesIncludeTax: boolean) {
  const base = Math.max(0, gross - discount);
  if (pricesIncludeTax) {
    const total = round2(base);
    const tax = round2(total - total / (1 + taxRate / 100));
    return { subtotal: round2(total - tax), tax, total };
  }
  const subtotal = round2(base);
  const tax = round2(subtotal * (taxRate / 100));
  return { subtotal, tax, total: round2(subtotal + tax) };
}
