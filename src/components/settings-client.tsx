'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, RefreshCw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COUNTRIES, getCountry } from '@/lib/countries';
import { currencyName } from '@/lib/format';
import { useToast } from '@/components/toast';
import type { Business, Role } from '@/lib/types';

interface Member { user_id: string; role: Role; profiles: { full_name: string; email: string } | null }

export function SettingsClient({ business, role, currentUserId, members }: { business: Business; role: Role; currentUserId: string; members: Member[] }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const isOwner = role === 'owner';

  const [f, setF] = useState({
    name: business.name,
    tax_id: business.tax_id ?? '',
    address: business.address ?? '',
    phone: business.phone ?? '',
    receipt_footer: business.receipt_footer ?? '',
    country_code: business.country_code,
    currency_code: business.currency_code,
    locale: business.locale,
    tax_name: business.tax_name,
    tax_rate: String(business.tax_rate),
    prices_include_tax: business.prices_include_tax,
  });
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(business.invite_code);

  function changeCountry(c: string) {
    const info = getCountry(c);
    if (!info) return;
    setF((p) => ({ ...p, country_code: c, currency_code: info.currency, locale: info.locale, tax_name: info.taxName, tax_rate: String(info.taxRate), prices_include_tax: info.pricesIncludeTax }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const rate = Number(f.tax_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) return toast('El impuesto debe estar entre 0 y 100.', 'error');
    setSaving(true);
    const { error } = await supabase
      .from('businesses')
      .update({
        name: f.name.trim(),
        tax_id: f.tax_id.trim() || null,
        address: f.address.trim() || null,
        phone: f.phone.trim() || null,
        receipt_footer: f.receipt_footer.trim() || null,
        country_code: f.country_code,
        currency_code: f.currency_code.toUpperCase(),
        locale: f.locale,
        tax_name: f.tax_name.trim() || 'IVA',
        tax_rate: rate,
        prices_include_tax: f.prices_include_tax,
      })
      .eq('id', business.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('Configuración guardada', 'success');
    router.refresh();
  }

  async function regenerate() {
    if (!confirm('El código anterior dejará de funcionar. ¿Continuar?')) return;
    const { data, error } = await supabase.rpc('regenerate_invite_code', { p_business_id: business.id });
    if (error) return toast(error.message, 'error');
    setCode(data as string);
    toast('Nuevo código generado', 'success');
  }

  async function changeRole(userId: string, newRole: Role) {
    const { error } = await supabase.from('memberships').update({ role: newRole }).eq('business_id', business.id).eq('user_id', userId);
    if (error) return toast(error.message, 'error');
    toast('Rol actualizado', 'success');
    router.refresh();
  }

  async function removeMember(userId: string) {
    if (!confirm('¿Quitar a este usuario del negocio?')) return;
    const { error } = await supabase.from('memberships').delete().eq('business_id', business.id).eq('user_id', userId);
    if (error) return toast(error.message, 'error');
    toast('Usuario eliminado', 'success');
    router.refresh();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const disabled = !isOwner;

  return (
    <div className="max-w-3xl space-y-6">
      {!isOwner && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Solo el propietario puede modificar la configuración del negocio.</p>}

      <form onSubmit={save} className="space-y-6">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Datos del negocio</h2>
          <div><label className="label">Nombre</label><input className="input" required disabled={disabled} value={f.name} onChange={set('name')} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">ID fiscal (RTN, NIT, RUC…)</label><input className="input" disabled={disabled} value={f.tax_id} onChange={set('tax_id')} /></div>
            <div><label className="label">Teléfono</label><input className="input" disabled={disabled} value={f.phone} onChange={set('phone')} /></div>
          </div>
          <div><label className="label">Dirección</label><input className="input" disabled={disabled} value={f.address} onChange={set('address')} /></div>
          <div><label className="label">Mensaje al pie del recibo</label><input className="input" disabled={disabled} value={f.receipt_footer} onChange={set('receipt_footer')} /></div>
        </div>

        <div className="card space-y-4 p-5">
          <div>
            <h2 className="font-semibold">País, moneda e impuestos</h2>
            <p className="hint">Al cambiar el país se actualizan moneda e impuesto sugeridos. Puedes ajustarlos manualmente.</p>
          </div>
          <div>
            <label className="label">País</label>
            <select className="input" disabled={disabled} value={f.country_code} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Moneda</label>
              <input className="input uppercase" maxLength={3} disabled={disabled} value={f.currency_code} onChange={(e) => setF((p) => ({ ...p, currency_code: e.target.value.toUpperCase() }))} />
              <p className="hint">{currencyName(f.currency_code)}</p>
            </div>
            <div><label className="label">Nombre del impuesto</label><input className="input" disabled={disabled} value={f.tax_name} onChange={set('tax_name')} /></div>
            <div><label className="label">Porcentaje (%)</label><input className="input" inputMode="decimal" disabled={disabled} value={f.tax_rate} onChange={set('tax_rate')} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" disabled={disabled} checked={f.prices_include_tax} onChange={(e) => setF((p) => ({ ...p, prices_include_tax: e.target.checked }))} />
            Los precios de mis productos ya incluyen el impuesto
          </label>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Los cambios aplican a las ventas nuevas; las anteriores conservan sus montos. Las tasas son valores sugeridos: confírmalas con tu contador. Los recibos de Stocko son comprobantes internos y no sustituyen la factura fiscal autorizada por tu autoridad tributaria.</p>
        </div>

        {isOwner && <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>}
      </form>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold">Equipo</h2>
        {isOwner && (
          <div className="rounded-lg bg-brand-50 p-4">
            <p className="text-sm text-slate-700">Para invitar a un cajero, pídele que cree su cuenta en Stocko y elija <b>“Unirme a un negocio”</b> con este código:</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-white px-4 py-2 font-mono text-lg font-bold tracking-widest ring-1 ring-brand-200">{code}</code>
              <button className="btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(code); toast('Código copiado', 'success'); }}><Copy size={14} /> Copiar</button>
              <button className="btn-ghost btn-sm" onClick={regenerate}><RefreshCw size={14} /> Generar nuevo</button>
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.profiles?.full_name || m.profiles?.email}{m.user_id === currentUserId && <span className="badge ml-2 bg-slate-100 text-slate-600">Tú</span>}</p>
                <p className="truncate text-xs text-slate-500">{m.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.role === 'owner' || !isOwner || m.user_id === currentUserId ? (
                  <span className="badge bg-slate-100 text-slate-700">{m.role === 'owner' ? 'Propietario' : m.role === 'admin' ? 'Administrador' : 'Cajero'}</span>
                ) : (
                  <>
                    <select className="input py-1.5" value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value as Role)}>
                      <option value="admin">Administrador</option>
                      <option value="cashier">Cajero</option>
                    </select>
                    <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => removeMember(m.user_id)} aria-label="Quitar"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="hint">Cajero: puede vender, ver ventas y gestionar clientes. Administrador: además gestiona productos, reportes y anula ventas.</p>
      </div>
    </div>
  );
}
