'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COUNTRIES, countryFromLocale, getCountry } from '@/lib/countries';
import { currencyName } from '@/lib/format';

export function OnboardingForm({ detectedCountry }: { detectedCountry: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [country, setCountry] = useState(getCountry(detectedCountry)?.code ?? 'OTHER');
  const [autoDetected, setAutoDetected] = useState(!!getCountry(detectedCountry));
  const [custom, setCustom] = useState(false);
  const info = useMemo(() => getCountry(country)!, [country]);
  const [currency, setCurrency] = useState(info.currency);
  const [taxName, setTaxName] = useState(info.taxName);
  const [taxRate, setTaxRate] = useState(String(info.taxRate));
  const [includeTax, setIncludeTax] = useState(info.pricesIncludeTax);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Si el servidor no detectó país, usamos el idioma del navegador como respaldo.
  useEffect(() => {
    if (getCountry(detectedCountry)) return;
    const fromBrowser = countryFromLocale(navigator.language);
    if (fromBrowser) {
      setCountry(fromBrowser);
      setAutoDetected(true);
    }
  }, [detectedCountry]);

  // Al cambiar de país se autocompletan moneda e impuesto.
  useEffect(() => {
    setCurrency(info.currency);
    setTaxName(info.taxName);
    setTaxRate(String(info.taxRate));
    setIncludeTax(info.pricesIncludeTax);
  }, [info]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    const rate = Number(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) return setError('El porcentaje de impuesto debe estar entre 0 y 100.');
    setLoading(true);
    setError('');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { error } = await createClient().rpc('create_business', {
      p_name: name,
      p_country_code: country,
      p_currency_code: currency.toUpperCase(),
      p_locale: info.locale,
      p_timezone: timezone,
      p_tax_name: taxName,
      p_tax_rate: rate,
      p_prices_include_tax: includeTax,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  async function joinBusiness(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await createClient().rpc('join_business', { p_code: code });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <>
      <h1 className="text-xl font-bold">¡Bienvenido a Stocko! 👋</h1>
      <p className="mt-1 text-sm text-slate-500">Un último paso para dejar todo listo.</p>

      <div className="mt-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(''); }}
            className={`rounded-md py-2 transition ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {m === 'create' ? 'Crear mi negocio' : 'Unirme a un negocio'}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <form onSubmit={createBusiness} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="bname">Nombre de tu negocio</label>
            <input id="bname" required minLength={2} className="input" placeholder="Ej: Tienda La Esperanza" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="country">País</label>
            <select id="country" className="input" value={country} onChange={(e) => { setCountry(e.target.value); setAutoDetected(false); }}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            {autoDetected && <p className="hint">Detectamos tu país automáticamente. Puedes cambiarlo si no es correcto.</p>}
          </div>

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <Globe2 size={20} className="mt-0.5 shrink-0 text-brand-600" />
                <div className="text-slate-700">
                  <p><b>Moneda:</b> {currencyName(currency)} ({currency})</p>
                  <p><b>Impuesto:</b> {taxName} {taxRate}% {Number(taxRate) > 0 ? (includeTax ? '(incluido en los precios)' : '(se suma al precio)') : ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCustom((v) => !v)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                <Pencil size={12} /> {custom ? 'Listo' : 'Cambiar'}
              </button>
            </div>

            {custom && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-brand-200 pt-4">
                <div>
                  <label className="label">Moneda (código)</label>
                  <input className="input uppercase" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="label">Nombre del impuesto</label>
                  <input className="input" value={taxName} onChange={(e) => setTaxName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Porcentaje (%)</label>
                  <input className="input" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={includeTax} onChange={(e) => setIncludeTax(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    Precios ya incluyen impuesto
                  </label>
                </div>
              </div>
            )}
          </div>
          <p className="hint -mt-2">Valores sugeridos. Confírmalos con tu contador; podrás editarlos después en Configuración.</p>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creando…' : 'Crear mi negocio'}</button>
        </form>
      ) : (
        <form onSubmit={joinBusiness} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="code">Código de invitación</label>
            <input id="code" required className="input font-mono uppercase tracking-widest" placeholder="A1B2C3D4" value={code} onChange={(e) => setCode(e.target.value)} />
            <p className="hint">Pídele el código al dueño del negocio. Lo encuentra en Configuración → Equipo.</p>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Uniéndome…' : 'Unirme'}</button>
        </form>
      )}
    </>
  );
}
