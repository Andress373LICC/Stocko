'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { useToast } from '@/components/toast';
import type { Category } from '@/lib/types';

interface Row {
  key: string;
  id?: string;
  options: Record<string, string>;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
  min_stock: string;
  active: boolean;
}

export interface GroupData {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  option_names: string[];
}
export interface VariantData {
  id: string;
  options: Record<string, string> | null;
  variant_label: string | null;
  sku: string;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  track_stock: boolean;
  active: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function VariantForm({ businessId, categories: initialCategories, group, variants }: { businessId: string; categories: Category[]; group?: GroupData; variants?: VariantData[] }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const editing = !!group;

  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [categoryId, setCategoryId] = useState(group?.category_id ?? '');
  const [newCat, setNewCat] = useState('');
  const [opt1, setOpt1] = useState(group?.option_names?.[0] ?? 'Talla');
  const [opt2, setOpt2] = useState(group ? group.option_names?.[1] ?? '' : 'Color');
  const [trackStock, setTrackStock] = useState(variants?.[0]?.track_stock ?? true);
  const [imageUrl, setImageUrl] = useState(group?.image_url ?? '');
  const [preview, setPreview] = useState(group?.image_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [vals1, setVals1] = useState('');
  const [vals2, setVals2] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [baseMin, setBaseMin] = useState('2');

  const [rows, setRows] = useState<Row[]>(
    (variants ?? []).map((v) => ({
      key: v.id, id: v.id, options: v.options ?? {}, sku: v.sku, barcode: v.barcode ?? '',
      price: String(v.price), cost: String(v.cost), stock: String(v.stock), min_stock: String(v.min_stock), active: v.active,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const barcodeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const optionNames = [opt1.trim(), opt2.trim()].filter(Boolean);
  const labelOf = (r: Row) => optionNames.map((n) => r.options[n]?.trim()).filter(Boolean).join(' / ');

  async function addCategory() {
    const n = newCat.trim();
    if (!n) return;
    const { data, error } = await supabase.from('categories').insert({ business_id: businessId, name: n }).select('id, name').single();
    if (error) return toast(error.code === '23505' ? 'Esa categoría ya existe.' : error.message, 'error');
    setCategories((c) => [...c, data as Category].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId((data as Category).id);
    setNewCat('');
  }

  const split = (s: string) => Array.from(new Set(s.split(',').map((x) => x.trim()).filter(Boolean)));

  function generate() {
    const a = split(vals1);
    const b = opt2.trim() ? split(vals2) : [];
    if (!opt1.trim() || a.length === 0) return toast(`Escribe los valores de ${opt1 || 'la primera opción'} separados por coma (ej: 38, 39, 40).`, 'error');
    const combos: Record<string, string>[] = [];
    for (const x of a) {
      if (b.length === 0) combos.push({ [opt1.trim()]: x });
      else for (const y of b) combos.push({ [opt1.trim()]: x, [opt2.trim()]: y });
    }
    const existing = new Set(rows.map((r) => labelOf(r)));
    const fresh = combos
      .map((o): Row => ({ key: uid(), options: o, sku: '', barcode: '', price: basePrice, cost: baseCost, stock: '0', min_stock: baseMin, active: true }))
      .filter((r) => !existing.has(labelOf(r)));
    setRows((prev) => [...prev, ...fresh]);
    toast(`${fresh.length} variantes agregadas`, 'success');
    setVals1('');
    setVals2('');
  }

  const setRow = (key: string, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setRowOpt = (key: string, n: string, v: string) => setRows((p) => p.map((r) => (r.key === key ? { ...r, options: { ...r.options, [n]: v } } : r)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('El nombre del producto es obligatorio.');
    if (rows.length === 0) return setError('Genera o agrega al menos una variante.');
    for (const [i, r] of rows.entries()) {
      if (!labelOf(r)) return setError(`La fila ${i + 1} no tiene ${optionNames.join(' ni ')}.`);
      if (isNaN(Number(r.price)) || r.price.trim() === '') return setError(`Falta el precio en la variante "${labelOf(r)}".`);
    }
    const labels = rows.map(labelOf);
    if (new Set(labels).size !== labels.length) return setError('Hay variantes repetidas (misma combinación).');
    setSaving(true);

    try {
      let finalImage = imageUrl || null;
      if (file) {
        const blob = await resizeImage(file);
        const path = `${businessId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw new Error('No se pudo subir la imagen: ' + up.error.message);
        finalImage = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.rpc('save_product_group', {
        p_business_id: businessId,
        p_group_id: group?.id ?? null,
        p_group: { name: name.trim(), description: description.trim(), category_id: categoryId || '', image_url: finalImage ?? '', option_names: optionNames },
        p_variants: rows.map((r) => ({
          id: r.id ?? '',
          label: labelOf(r),
          options: Object.fromEntries(optionNames.map((n) => [n, r.options[n]?.trim() ?? ''])),
          sku: r.sku.trim(),
          barcode: r.barcode.trim(),
          price: Number(r.price) || 0,
          cost: Number(r.cost) || 0,
          stock: parseInt(r.stock) || 0,
          min_stock: Math.max(0, parseInt(r.min_stock) || 0),
          track_stock: trackStock,
          active: r.active,
        })),
      });
      if (error) throw error;
      toast(editing ? 'Producto actualizado' : 'Producto con variantes creado', 'success');
      router.push('/products');
      router.refresh();
    } catch (err: any) {
      const m = String(err?.message ?? '');
      setError(
        err?.code === '23505'
          ? m.includes('barcode') ? 'Hay un código de barras repetido (ya existe en otro producto).' : 'Hay un SKU repetido (ya existe en otro producto).'
          : m || 'Ocurrió un error'
      );
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar este producto y TODAS sus variantes? Las ventas anteriores se conservan.')) return;
    const { error } = await supabase.rpc('delete_product_group', { p_group_id: group!.id });
    if (error) return toast(error.message, 'error');
    toast('Producto eliminado', 'success');
    router.push('/products');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl space-y-6">
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold">Producto</h2>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vista previa" className="h-28 w-28 rounded-xl object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus size={30} /></div>
            )}
            <div className="flex gap-1">
              <button type="button" className="btn-secondary btn-sm" onClick={() => fileInput.current?.click()}>{preview ? 'Cambiar' : 'Imagen'}</button>
              {preview && <button type="button" className="btn-ghost btn-sm" onClick={() => { setFile(null); setPreview(''); setImageUrl(''); }}><X size={14} /></button>}
            </div>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <label className="label" htmlFor="gname">Nombre *</label>
              <input id="gname" className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Tenis Runner" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nueva categoría</label>
                <div className="flex gap-2">
                  <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                  <button type="button" className="btn-secondary" onClick={addCategory}><Plus size={16} /></button>
                </div>
              </div>
            </div>
            <div>
              <label className="label">Descripción</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Variantes</h2>
          <p className="hint">Define en qué se diferencia el producto (talla, color, sabor, tamaño…) y genera todas las combinaciones de una vez.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="label">Opción 1</label>
            <input className="input mb-2" value={opt1} onChange={(e) => setOpt1(e.target.value)} placeholder="Talla" />
            <input className="input" value={vals1} onChange={(e) => setVals1(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="Valores separados por coma: 38, 39, 40, 41" />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="label">Opción 2 (opcional)</label>
            <input className="input mb-2" value={opt2} onChange={(e) => setOpt2(e.target.value)} placeholder="Color" />
            <input className="input" value={vals2} disabled={!opt2.trim()} onChange={(e) => setVals2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="Negro, Blanco" />
          </div>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-4">
          <div><label className="label">Precio base</label><input className="input" inputMode="decimal" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></div>
          <div><label className="label">Costo base</label><input className="input" inputMode="decimal" value={baseCost} onChange={(e) => setBaseCost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></div>
          <div><label className="label">Avisar con</label><input className="input" inputMode="numeric" value={baseMin} onChange={(e) => setBaseMin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></div>
          <button type="button" className="btn-primary" onClick={generate}><Sparkles size={16} /> Generar combinaciones</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">{rows.length} {rows.length === 1 ? 'variante' : 'variantes'}</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} /> Controlar stock</label>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setRows((p) => [...p, { key: uid(), options: {}, sku: '', barcode: '', price: basePrice, cost: baseCost, stock: '0', min_stock: baseMin, active: true }])}><Plus size={14} /> Fila</button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Escribe los valores arriba y pulsa <b>Generar combinaciones</b>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {optionNames.map((n) => <th key={n} className="th">{n}</th>)}
                  <th className="th">Código de barras</th><th className="th">SKU</th><th className="th">Precio</th><th className="th">Costo</th>
                  {trackStock && <><th className="th">{editing ? 'Stock' : 'Stock inicial'}</th><th className="th">Avisar con</th></>}
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.key} className={r.active ? '' : 'opacity-50'}>
                    {optionNames.map((n) => (
                      <td key={n} className="px-2 py-2"><input className="input w-24 py-1.5" value={r.options[n] ?? ''} onChange={(e) => setRowOpt(r.key, n, e.target.value)} /></td>
                    ))}
                    <td className="px-2 py-2">
                      <input
                        ref={(el) => { barcodeRefs.current[i] = el; }}
                        className="input w-36 py-1.5 font-mono"
                        value={r.barcode}
                        placeholder="Escanear…"
                        onChange={(e) => setRow(r.key, { barcode: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); barcodeRefs.current[i + 1]?.focus(); } }}
                      />
                    </td>
                    <td className="px-2 py-2"><input className="input w-28 py-1.5 font-mono" value={r.sku} placeholder="Auto" onChange={(e) => setRow(r.key, { sku: e.target.value })} /></td>
                    <td className="px-2 py-2"><input className="input w-24 py-1.5" inputMode="decimal" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value })} /></td>
                    <td className="px-2 py-2"><input className="input w-24 py-1.5" inputMode="decimal" value={r.cost} onChange={(e) => setRow(r.key, { cost: e.target.value })} /></td>
                    {trackStock && (
                      <>
                        <td className="px-2 py-2"><input className="input w-20 py-1.5" inputMode="numeric" value={r.stock} onChange={(e) => setRow(r.key, { stock: e.target.value })} /></td>
                        <td className="px-2 py-2"><input className="input w-20 py-1.5" inputMode="numeric" value={r.min_stock} onChange={(e) => setRow(r.key, { min_stock: e.target.value })} /></td>
                      </>
                    )}
                    <td className="px-2 py-2 text-right">
                      <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} aria-label="Quitar variante"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 1 && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Tip: haz clic en el primer código de barras y escanea uno tras otro; con cada lectura el cursor salta a la siguiente fila.</p>}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}</button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/products')}>Cancelar</button>
        </div>
        {editing && <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={remove}><Trash2 size={16} /> Eliminar todo</button>}
      </div>
    </form>
  );
}
