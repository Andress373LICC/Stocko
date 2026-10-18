/**
 * Valores SUGERIDOS por país (moneda e impuesto general). Se usan para autocompletar
 * al crear un negocio. El usuario siempre puede modificarlos en Configuración.
 * Las tasas de impuestos cambian con el tiempo: verifica con tu contador.
 */
export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  locale: string;
  taxName: string;
  taxRate: number;
  pricesIncludeTax: boolean;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'HN', name: 'Honduras', currency: 'HNL', locale: 'es-HN', taxName: 'ISV', taxRate: 15, pricesIncludeTax: true },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', locale: 'es-GT', taxName: 'IVA', taxRate: 12, pricesIncludeTax: true },
  { code: 'SV', name: 'El Salvador', currency: 'USD', locale: 'es-SV', taxName: 'IVA', taxRate: 13, pricesIncludeTax: true },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', locale: 'es-NI', taxName: 'IVA', taxRate: 15, pricesIncludeTax: true },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', locale: 'es-CR', taxName: 'IVA', taxRate: 13, pricesIncludeTax: true },
  { code: 'PA', name: 'Panamá', currency: 'USD', locale: 'es-PA', taxName: 'ITBMS', taxRate: 7, pricesIncludeTax: true },
  { code: 'MX', name: 'México', currency: 'MXN', locale: 'es-MX', taxName: 'IVA', taxRate: 16, pricesIncludeTax: true },
  { code: 'CO', name: 'Colombia', currency: 'COP', locale: 'es-CO', taxName: 'IVA', taxRate: 19, pricesIncludeTax: true },
  { code: 'VE', name: 'Venezuela', currency: 'VES', locale: 'es-VE', taxName: 'IVA', taxRate: 16, pricesIncludeTax: true },
  { code: 'EC', name: 'Ecuador', currency: 'USD', locale: 'es-EC', taxName: 'IVA', taxRate: 15, pricesIncludeTax: true },
  { code: 'PE', name: 'Perú', currency: 'PEN', locale: 'es-PE', taxName: 'IGV', taxRate: 18, pricesIncludeTax: true },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', locale: 'es-BO', taxName: 'IVA', taxRate: 13, pricesIncludeTax: true },
  { code: 'CL', name: 'Chile', currency: 'CLP', locale: 'es-CL', taxName: 'IVA', taxRate: 19, pricesIncludeTax: true },
  { code: 'AR', name: 'Argentina', currency: 'ARS', locale: 'es-AR', taxName: 'IVA', taxRate: 21, pricesIncludeTax: true },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', locale: 'es-UY', taxName: 'IVA', taxRate: 22, pricesIncludeTax: true },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', locale: 'es-PY', taxName: 'IVA', taxRate: 10, pricesIncludeTax: true },
  { code: 'BR', name: 'Brasil', currency: 'BRL', locale: 'pt-BR', taxName: 'Impostos', taxRate: 0, pricesIncludeTax: true },
  { code: 'DO', name: 'República Dominicana', currency: 'DOP', locale: 'es-DO', taxName: 'ITBIS', taxRate: 18, pricesIncludeTax: true },
  { code: 'PR', name: 'Puerto Rico', currency: 'USD', locale: 'es-PR', taxName: 'IVU', taxRate: 11.5, pricesIncludeTax: false },
  { code: 'US', name: 'Estados Unidos', currency: 'USD', locale: 'en-US', taxName: 'Sales Tax', taxRate: 0, pricesIncludeTax: false },
  { code: 'CA', name: 'Canadá', currency: 'CAD', locale: 'en-CA', taxName: 'GST', taxRate: 5, pricesIncludeTax: false },
  { code: 'ES', name: 'España', currency: 'EUR', locale: 'es-ES', taxName: 'IVA', taxRate: 21, pricesIncludeTax: true },
  { code: 'PT', name: 'Portugal', currency: 'EUR', locale: 'pt-PT', taxName: 'IVA', taxRate: 23, pricesIncludeTax: true },
  { code: 'FR', name: 'Francia', currency: 'EUR', locale: 'fr-FR', taxName: 'TVA', taxRate: 20, pricesIncludeTax: true },
  { code: 'DE', name: 'Alemania', currency: 'EUR', locale: 'de-DE', taxName: 'MwSt', taxRate: 19, pricesIncludeTax: true },
  { code: 'IT', name: 'Italia', currency: 'EUR', locale: 'it-IT', taxName: 'IVA', taxRate: 22, pricesIncludeTax: true },
  { code: 'GB', name: 'Reino Unido', currency: 'GBP', locale: 'en-GB', taxName: 'VAT', taxRate: 20, pricesIncludeTax: true },
  { code: 'OTHER', name: 'Otro país', currency: 'USD', locale: 'en-US', taxName: 'Impuesto', taxRate: 0, pricesIncludeTax: false },
];

export function getCountry(code?: string | null): CountryInfo | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

/** Obtiene el país a partir del idioma del navegador (ej. "es-HN" → "HN"). */
export function countryFromLocale(locale?: string | null): string | undefined {
  const region = locale?.split('-')[1]?.toUpperCase();
  return getCountry(region) ? region : undefined;
}
