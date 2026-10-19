'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Mail, Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EmptyState, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import type { Customer } from '@/lib/types';

const EMPTY = { name: '', phone: '', email: '', tax_id: '', address: '', notes: '' };

export function CustomersClient({ businessId, initial }: { businessId: string; initial: Customer[] }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? initial.filter((c) => [c.name, c.phone, c.email, c.tax_id].some((v) => v?.toLowerCase().includes(t))) : initial;
  }, [initial, q]);

  function open(c: Customer | 'new') {
    setEditing(c);
    setForm(c === 'new' ? EMPTY : { name: c.name, phone: c.phone ?? '', email: c.email ?? '', tax_id: c.tax_id ?? '', address: c.address ?? '', notes: c.notes ?? '' });
    setMore(c !== 'new' && !!(c.email || c.tax_id || c.address || c.notes));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    payload.name = form.name.trim();
    const { error } = editing === 'new'
      ? await supabase.from('customers').insert({ ...payload, business_id: businessId })
      : await supabase.from('customers').update(payload).eq('id', (editing as Customer).id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast(editing === 'new' ? 'Cliente agregado' : 'Cliente actualizado', 'success');
    setEditing(null);
    router.refresh();
  }

  async function remove(c: Customer) {
    if (!confirm(`¿Eliminar a ${c.name}? Las ventas anteriores conservan su nombre.`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) return toast(error.message, 'error');
    toast('Cliente eliminado', 'success');
    router.refresh();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => open('new')}><Plus size={18} /> Nuevo cliente</button>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title={q ? 'Sin resultados' : 'Aún no tienes clientes'} description={q ? undefined : 'Agrega clientes para asociarlos a tus ventas.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <Link href={`/customers/${c.id}`} className="group min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-medium text-slate-900 group-hover:text-brand-700">{c.name}<ChevronRight size={14} className="text-slate-300 group-hover:text-brand-600" /></p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-500">
                    {c.phone && <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                    {c.tax_id && <span>ID: {c.tax_id}</span>}
                    <span className="font-medium text-brand-700">Ver historial</span>
                  </div>
                </Link>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => open(c)} aria-label="Editar"><Pencil size={16} /></button>
                  <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(c)} aria-label="Eliminar"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo cliente' : 'Editar cliente'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Nombre *</label><input required className="input" value={form.name} onChange={set('name')} autoFocus /></div>
          <div><label className="label">Teléfono {editing === 'new' ? '*' : ''}</label><input required={editing === 'new'} inputMode="tel" className="input" value={form.phone} onChange={set('phone')} /></div>
          <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ChevronDown size={14} className={more ? 'rotate-180' : ''} /> Más datos (opcional)</button>
          {more && (
            <div className="space-y-4 rounded-lg bg-slate-50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Correo</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
                <div><label className="label">ID fiscal (RTN, NIT, RUC…)</label><input className="input" value={form.tax_id} onChange={set('tax_id')} /></div>
              </div>
              <div><label className="label">Dirección</label><input className="input" value={form.address} onChange={set('address')} /></div>
              <div><label className="label">Notas</label><textarea rows={2} className="input" value={form.notes} onChange={set('notes')} /></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
