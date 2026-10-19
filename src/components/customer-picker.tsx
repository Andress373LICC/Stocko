'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, History, Phone, Plus, Search, UserRound, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dateTime, money } from '@/lib/format';
import { useToast } from '@/components/toast';
import type { Business } from '@/lib/types';

export interface PickerCustomer { id: string; name: string; phone?: string | null }

interface LastSale { id: string; number: number; created_at: string; total: number; sale_items: { name: string; quantity: number }[] }

/** Selector de cliente para caja: "Cliente general" por defecto, búsqueda rápida y registro express (nombre + teléfono). */
export function CustomerPicker({ business, customers, value, onChange, onCreated }: { business: Business; customers: PickerCustomer[]; value: string; onChange: (id: string) => void; onCreated: (c: PickerCustomer) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<LastSale | null | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setCreating(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Última compra del cliente seleccionado
  useEffect(() => {
    if (!value) { setLast(undefined); return; }
    let cancelled = false;
    setLast(undefined);
    createClient()
      .from('sales')
      .select('id, number, created_at, total, sale_items(name, quantity)')
      .eq('customer_id', value)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => { if (!cancelled) setLast((data?.[0] as any) ?? null); });
    return () => { cancelled = true; };
  }, [value]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? customers.filter((c) => c.name.toLowerCase().includes(t) || c.phone?.includes(t)) : customers;
    return base.slice(0, 30);
  }, [customers, q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    const { data, error } = await createClient().from('customers').insert({ business_id: business.id, name: name.trim(), phone: phone.trim() }).select('id, name, phone').single();
    setSaving(false);
    if (error) return toast(error.message, 'error');
    onCreated(data as PickerCustomer);
    onChange((data as PickerCustomer).id);
    toast('Cliente registrado', 'success');
    setCreating(false); setOpen(false); setName(''); setPhone(''); setQ('');
  }

  return (
    <div ref={wrap} className="relative">
      <label className="label">Cliente</label>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="input flex flex-1 items-center justify-between gap-2 text-left">
          <span className="flex min-w-0 items-center gap-2"><UserRound size={16} className="shrink-0 text-slate-400" /><span className="truncate">{selected ? selected.name : 'Cliente general (mostrador)'}</span></span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
        {selected && <button type="button" className="btn-secondary px-2.5" onClick={() => onChange('')} aria-label="Quitar cliente"><X size={16} /></button>}
        <button type="button" className="btn-secondary px-2.5" title="Registrar cliente nuevo" onClick={() => { setOpen(true); setCreating(true); }}><Plus size={16} /></button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {creating ? (
            <form onSubmit={create} className="space-y-2 p-1">
              <p className="text-sm font-semibold">Cliente nuevo <span className="font-normal text-slate-500">· solo 2 datos</span></p>
              <input autoFocus required className="input" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <input required className="input" inputMode="tel" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando…' : 'Guardar y usar'}</button>
                <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Volver</button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative mb-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus className="input py-2 pl-9" placeholder="Buscar por nombre o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <ul className="max-h-56 overflow-y-auto">
                <li><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50" onClick={() => { onChange(''); setOpen(false); }}>Cliente general (mostrador)</button></li>
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(c.id); setOpen(false); setQ(''); }}>
                      <span className="truncate">{c.name}</span>
                      {c.phone && <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400"><Phone size={11} />{c.phone}</span>}
                    </button>
                  </li>
                ))}
                {list.length === 0 && q && (
                  <li className="px-3 py-3 text-sm text-slate-500">Sin resultados. <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setCreating(true); setName(q); }}>Registrar “{q}”</button></li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      {selected && last !== undefined && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {last === null ? (
            <p>Primera compra de este cliente.</p>
          ) : (
            <>
              <p className="mb-1 flex items-center gap-1 font-semibold text-slate-700"><History size={13} /> Última compra · {dateTime(last.created_at, business)} · {money(last.total, business)}</p>
              <p className="line-clamp-2">{last.sale_items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
            </>
          )}
          <Link href={`/customers/${selected.id}`} className="mt-1.5 inline-block font-semibold text-brand-700 hover:underline">Ver historial completo →</Link>
        </div>
      )}
    </div>
  );
}
