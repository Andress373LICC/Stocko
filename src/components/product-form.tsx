'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { beep } from '@/lib/beep';
import { CameraScanner } from '@/components/camera-scanner';
import { Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import type { Category, Product } from '@/lib/types';

export function ProductForm({ businessId, categories: initialCategories, product }: { businessId: string; categories: Category[]; product?: Product }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const editing = !!product;

  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [cost, setCost] = useState(product ? String(product.cost) : '');
  const [trackStock, setTrackStock] = useState(product?.track_stock ?? true);
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? 5));
  const [description, setDescription] = useState(product?.description ?? '');
  const [active, setActive] = useState(product?.active ?? true);
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.image_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [adjust, setAdjust] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('Ajuste de inventario');
  const fileInput = useRef<HTMLInputElement>(null);

  async function addCategory() {
    const n = newCat.trim();
    if (!n) return;
    const { data, error } = await supabase.from('categories').insert({ business_id: businessId, name: n }).select('id, name').single();
    if (error) return toast(error.code === '23505' ? 'Esa categoría ya existe.' : error.message, 'error');
    setCategories((c) => [...c, data as Category].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId((data as Category).id);
    setNewCat('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const p = Number(price), c = Number(cost || 0);
    if (!name.trim()) return setError('El nombre es obligatorio.');
    if (isNaN(p) || p < 0) return setError('El precio no es válido.');
    if (isNaN(c) || c < 0) return setError('El costo no es válido.');
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

      const payload = {
        name: name.trim(),
        sku: sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
        barcode: barcode.trim() || null,
        category_id: categoryId || null,
        price: p,
        cost: c,
        track_stock: trackStock,
        min_stock: Math.max(0, parseInt(minStock) || 0),
        description: description.trim() || null,
        active,
        image_url: finalImage,
      };

      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', product!.id);
        if (error) throw error;
        toast('Producto actualizado', 'success');
        router.push('/products');
      } else {
        const { data, error } = await supabase.from('products').insert({ ...payload, business_id: businessId }).select('id').single();
        if (error) throw error;
        const initial = parseInt(stock) || 0;
        if (trackStock && initial > 0) {
          await supabase.rpc('adjust_stock', { p_product_id: data.id, p_delta: initial, p_reason: 'initial' });
        }
        toast('Producto creado', 'success');
        router.push('/products');
      }
      router.refresh();
    } catch (err: any) {
      const msg = err?.code === '23505'
        ? (String(err.message).includes('barcode') ? 'Ya existe un producto con ese código de barras.' : 'Ya existe un producto con ese SKU.')
        : err?.message ?? 'Ocurrió un error';
      setError(msg);
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar este producto? Las ventas anteriores se conservan.')) return;
    const { error } = await supabase.from('products').delete().eq('id', product!.id);
    if (error) return toast(error.message, 'error');
    toast('Producto eliminado', 'success');
    router.push('/products');
    router.refresh();
  }

  async function applyAdjust() {
    const d = parseInt(delta);
    if (!d) return toast('Ingresa una cantidad distinta de 0 (usa negativos para restar).', 'error');
    const { error } = await supabase.rpc('adjust_stock', { p_product_id: product!.id, p_delta: d, p_reason: reason || 'adjustment' });
    if (error) return toast(error.message, 'error');
    toast('Stock actualizado', 'success');
    setAdjust(false);
    setDelta('');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-6">
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold">Información básica</h2>
        <div>
          <label className="label" htmlFor="name">Nombre *</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="barcode">Código de barras</label>
            <div className="flex gap-2">
              <input
                id="barcode"
                className="input font-mono"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="Escanéalo aquí"
              />
              <button type="button" className="btn-secondary px-3" onClick={() => setCamera(true)} aria-label="Escanear con cámara"><Camera size={18} /></button>
            </div>
            <p className="hint">Haz clic en el campo y escanea con tu lector, o usa la cámara.</p>
          </div>
          <div>
            <label className="label" htmlFor="sku">SKU / código interno</label>
            <input id="sku" className="input font-mono" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Se genera si lo dejas vacío" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cat">Categoría</label>
          <select id="cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="mt-2 flex gap-2">
            <input className="input" placeholder="Nueva categoría…" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
            <button type="button" className="btn-secondary" onClick={addCategory}><Plus size={16} /> Crear</button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="desc">Descripción</label>
          <textarea id="desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold">Precios</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price">Precio de venta *</label>
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="cost">Costo (opcional)</label>
            <input id="cost" className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            <p className="hint">Se usa para calcular tu ganancia en los reportes.</p>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Inventario</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
            Controlar stock
          </label>
        </div>
        {trackStock && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{editing ? 'Stock actual' : 'Stock inicial'}</label>
              {editing ? (
                <div className="flex items-center gap-3">
                  <span className="input flex-1 bg-slate-50 font-semibold">{product!.stock}</span>
                  <button type="button" className="btn-secondary" onClick={() => setAdjust(true)}><SlidersHorizontal size={16} /> Ajustar</button>
                </div>
              ) : (
                <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
              )}
            </div>
            <div>
              <label className="label" htmlFor="min">Avisar cuando queden</label>
              <input id="min" className="input" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold">Imagen</h2>
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="h-24 w-24 rounded-xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus size={28} /></div>
          )}
          <div className="space-x-2">
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>{preview ? 'Cambiar' : 'Subir imagen'}</button>
            {preview && <button type="button" className="btn-ghost" onClick={() => { setFile(null); setPreview(''); setImageUrl(''); }}>Quitar</button>}
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
          </div>
        </div>
        <label className="flex items-center gap-2 border-t border-slate-100 pt-4 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Producto activo (visible en el punto de venta)
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}</button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/products')}>Cancelar</button>
        </div>
        {editing && <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={remove}><Trash2 size={16} /> Eliminar</button>}
      </div>

      <CameraScanner open={camera} onClose={() => setCamera(false)} onDetected={(c) => { setBarcode(c); beep(); }} />

      <Modal open={adjust} onClose={() => setAdjust(false)} title="Ajustar stock">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Stock actual: <b>{product?.stock}</b>. Escribe cuántas unidades sumar (ej. <b>10</b>) o restar (ej. <b>-3</b>).</p>
          <div>
            <label className="label">Cantidad</label>
            <input className="input" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAdjust(); } }} autoFocus />
          </div>
          <div>
            <label className="label">Motivo</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAdjust(); } }} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAdjust(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={applyAdjust}>Aplicar</button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
