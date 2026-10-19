'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, Camera, CreditCard, Landmark, Layers, Minus, Package, Plug, Plus, ScanBarcode, Search, ShoppingCart, Trash2, Unplug, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { computeTotals, money } from '@/lib/format';
import { beep } from '@/lib/beep';
import { useKeyboardScanner } from '@/lib/scanner/useKeyboardScanner';
import { connectSerialScanner, serialSupported, type SerialScanner } from '@/lib/scanner/serial';
import { CameraScanner } from '@/components/camera-scanner';
import { CustomerPicker, type PickerCustomer } from '@/components/customer-picker';
import { Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { displayName, type Business, type Category, type PaymentMethod, type Product } from '@/lib/types';

type PosProduct = Pick<Product, 'id' | 'category_id' | 'sku' | 'barcode' | 'name' | 'price' | 'stock' | 'min_stock' | 'track_stock' | 'image_url' | 'group_id' | 'variant_label'>;
type Tile = { kind: 'single'; product: PosProduct } | { kind: 'group'; id: string; name: string; image_url: string | null; variants: PosProduct[] };
interface CartLine { product: PosProduct; qty: number }

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'transfer', label: 'Transfer.', icon: Landmark },
  { id: 'other', label: 'Otro', icon: Wallet },
];

export function PosClient({ business, products, categories, customers: initialCustomers, initialQuery = '' }: { business: Business; products: PosProduct[]; categories: Category[]; customers: PickerCustomer[]; initialQuery?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [customers, setCustomers] = useState(initialCustomers);
  const [picker, setPicker] = useState<Extract<Tile, { kind: 'group' }> | null>(null);
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const [serial, setSerial] = useState<SerialScanner | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fmt = useCallback((n: number) => money(n, business), [business]);

  const addProduct = useCallback((p: PosProduct) => {
    const current = cart.find((l) => l.product.id === p.id)?.qty ?? 0;
    if (p.track_stock && current + 1 > p.stock) {
      toast(`Stock insuficiente de "${displayName(p)}" (disponible: ${p.stock})`, 'error');
      beep(false);
      return;
    }
    beep(true);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return prev.map((l, idx) => (idx === i ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { product: p, qty: 1 }];
    });
  }, [cart, toast]);

  const handleCode = useCallback((raw: string) => {
    const code = raw.trim().toLowerCase();
    const found = products.find((p) => p.barcode?.toLowerCase() === code || p.sku.toLowerCase() === code);
    setQuery('');
    if (found) addProduct(found);
    else { beep(false); toast(`Código no encontrado: ${raw}`, 'error'); }
  }, [products, addProduct, toast]);

  // Escáner USB / Bluetooth (modo teclado) siempre activo en esta pantalla.
  useKeyboardScanner(handleCode, { enabled: !camera });

  async function toggleSerial() {
    if (serial) { await serial.close(); setSerial(null); return; }
    try {
      setSerial(await connectSerialScanner(handleCode));
      toast('Escáner serie conectado', 'success');
    } catch {
      toast('No se pudo conectar el escáner por puerto serie.', 'error');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) =>
      (!category || p.category_id === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.variant_label?.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q))
    );
  }, [products, query, category]);

  // Las variantes de un mismo producto se muestran en una sola tarjeta.
  const tiles = useMemo<Tile[]>(() => {
    const out: Tile[] = [];
    const groups = new Map<string, Extract<Tile, { kind: 'group' }>>();
    for (const p of filtered) {
      if (!p.group_id) { out.push({ kind: 'single', product: p }); continue; }
      let g = groups.get(p.group_id);
      if (!g) { g = { kind: 'group', id: p.group_id, name: p.name, image_url: p.image_url, variants: [] }; groups.set(p.group_id, g); out.push(g); }
      g.variants.push(p);
    }
    return out.slice(0, 60);
  }, [filtered]);

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) => p.barcode?.toLowerCase() === q || p.sku.toLowerCase() === q);
    if (exact) { addProduct(exact); setQuery(''); }
    else if (filtered.length === 1) { addProduct(filtered[0]); setQuery(''); }
    else if (tiles.length === 1 && tiles[0].kind === 'group') setPicker(tiles[0]);
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== id) return [l];
        if (qty <= 0) return [];
        if (l.product.track_stock && qty > l.product.stock) { toast(`Solo hay ${l.product.stock} en stock`, 'error'); return [{ ...l, qty: l.product.stock }]; }
        return [{ ...l, qty }];
      })
    );
  }

  const gross = cart.reduce((a, l) => a + l.product.price * l.qty, 0);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), gross);
  const totals = computeTotals(gross, disc, business.tax_rate, business.prices_include_tax);
  const receivedNum = Number(received);
  const change = method === 'cash' && receivedNum >= totals.total ? receivedNum - totals.total : 0;
  const itemCount = cart.reduce((a, l) => a + l.qty, 0);

  async function charge() {
    setError('');
    if (cart.length === 0) return setError('Agrega al menos un producto.');
    if (method === 'cash' && !(receivedNum >= totals.total)) return setError('El monto recibido es menor al total.');
    setPaying(true);
    const { data, error } = await createClient().rpc('create_sale', {
      p_business_id: business.id,
      p_customer_id: customerId || null,
      p_items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      p_payment_method: method,
      p_amount_paid: method === 'cash' ? receivedNum : totals.total,
      p_discount: disc,
      p_notes: null,
    });
    if (error) { setError(error.message); setPaying(false); return; }
    router.push(`/sales/${data}?new=1`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      {/* Catálogo */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} className="input pl-10" placeholder="Buscar o escanear producto…" autoFocus />
          </div>
          <button className="btn-secondary" onClick={() => setCamera(true)}><Camera size={18} /> <span className="hidden sm:inline">Cámara</span></button>
          {serialSupported() && (
            <button className={serial ? 'btn-primary' : 'btn-secondary'} onClick={toggleSerial} title="Escáner por puerto serie (COM)">
              {serial ? <Unplug size={18} /> : <Plug size={18} />} <span className="hidden sm:inline">{serial ? 'Desconectar' : 'Puerto serie'}</span>
            </button>
          )}
        </div>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
          <ScanBarcode size={14} className="text-brand-600" /> Escáner USB/Bluetooth listo: simplemente escanea un producto.
        </p>

        {categories.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {[{ id: '', name: 'Todos' }, ...categories].map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${category === c.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="card p-10 text-center">
            <Package className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-semibold">Aún no tienes productos</p>
            <p className="mt-1 text-sm text-slate-500">Agrégalos primero para poder vender.</p>
            <Link href="/products/new" className="btn-primary mt-4">Agregar producto</Link>
          </div>
        ) : tiles.length === 0 ? (
          <p className="card p-10 text-center text-sm text-slate-500">No se encontraron productos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {tiles.map((t) => {
              const isGroup = t.kind === 'group';
              const name = isGroup ? t.name : t.product.name;
              const img = isGroup ? t.image_url : t.product.image_url;
              const list = isGroup ? t.variants : [t.product];
              const prices = list.map((v) => v.price);
              const minP = Math.min(...prices), maxP = Math.max(...prices);
              const tracked = list.filter((v) => v.track_stock);
              const totalStock = tracked.reduce((a, v) => a + v.stock, 0);
              const allOut = tracked.length === list.length && totalStock <= 0;
              const anyLow = tracked.some((v) => v.stock > 0 && v.stock <= v.min_stock);
              return (
                <button
                  key={isGroup ? 'g' + t.id : t.product.id}
                  disabled={allOut}
                  onClick={() => (isGroup ? setPicker(t) : addProduct(t.product))}
                  className={`card group relative overflow-hidden text-left transition hover:border-brand-400 hover:shadow-md disabled:opacity-50 ${anyLow ? 'ring-1 ring-amber-300' : ''}`}
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Package className="text-slate-300" size={32} />
                    )}
                    {isGroup && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white"><Layers size={12} /> {list.length}</span>}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-slate-800">{name}{!isGroup && t.product.variant_label ? ` · ${t.product.variant_label}` : ''}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-brand-700">{minP === maxP ? fmt(minP) : `${fmt(minP)}+`}</span>
                      {tracked.length > 0 && (
                        <span className={`badge ${allOut ? 'bg-red-100 text-red-700' : anyLow ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {allOut ? 'Agotado' : anyLow ? `Bajo · ${totalStock}` : `${totalStock} uds`}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Carrito */}
      <aside id="cart" className="lg:sticky lg:top-20 lg:self-start">
        <div className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><ShoppingCart size={18} /> Venta actual</h2>
            {cart.length > 0 && <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => setCart([])}>Vaciar</button>}
          </div>

          <div className="max-h-[38vh] overflow-y-auto">
            {cart.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">El carrito está vacío.<br />Escanea o toca un producto.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((l) => (
                  <li key={l.product.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName(l.product)}</p>
                      <p className="text-xs text-slate-500">{fmt(l.product.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" onClick={() => setQty(l.product.id, l.qty - 1)} aria-label="Restar"><Minus size={14} /></button>
                      <input className="w-10 rounded-md border border-slate-200 py-1 text-center text-sm" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.product.id, parseInt(e.target.value) || 0)} />
                      <button className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" onClick={() => setQty(l.product.id, l.qty + 1)} aria-label="Sumar"><Plus size={14} /></button>
                    </div>
                    <p className="w-20 text-right text-sm font-semibold">{fmt(l.product.price * l.qty)}</p>
                    <button className="text-slate-400 hover:text-red-600" onClick={() => setQty(l.product.id, 0)} aria-label="Quitar"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4 border-t border-slate-200 p-5">
            <CustomerPicker business={business} customers={customers} value={customerId} onChange={setCustomerId} onCreated={(c) => setCustomers((p) => [...p, c].sort((a, b) => a.name.localeCompare(b.name)))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Descuento</label>
                <input className="input" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{fmt(totals.subtotal)}</dd></div>
              {disc > 0 && <div className="flex justify-between text-slate-600"><dt>Descuento</dt><dd>-{fmt(disc)}</dd></div>}
              {business.tax_rate > 0 && <div className="flex justify-between text-slate-600"><dt>{business.tax_name} {business.tax_rate}%{business.prices_include_tax ? ' (incl.)' : ''}</dt><dd>{fmt(totals.tax)}</dd></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold"><dt>Total</dt><dd>{fmt(totals.total)}</dd></div>
            </dl>

            <div className="grid grid-cols-4 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs font-medium transition ${method === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon size={18} /> {label}
                </button>
              ))}
            </div>

            {method === 'cash' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Efectivo recibido</label>
                  <button className="mb-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setReceived(String(totals.total))}>Monto exacto</button>
                </div>
                <input className="input" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0.00" />
                {receivedNum >= totals.total && totals.total > 0 && <p className="mt-1.5 text-sm font-semibold text-brand-700">Cambio: {fmt(change)}</p>}
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="btn-primary w-full py-3 text-base" disabled={paying || cart.length === 0} onClick={charge}>
              {paying ? 'Procesando…' : `Cobrar ${fmt(totals.total)}`}
            </button>
          </div>
        </div>
      </aside>

      {/* Barra flotante móvil */}
      {cart.length > 0 && (
        <a href="#cart" className="no-print fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-xl bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg lg:hidden">
          <span className="flex items-center gap-2"><ShoppingCart size={18} /> {itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
          <span>{fmt(totals.total)}</span>
        </a>
      )}

      <Modal open={!!picker} onClose={() => setPicker(null)} title={picker?.name ?? ''}>
        <p className="mb-3 text-sm text-slate-500">Toca una variante para agregarla. Puedes agregar varias.</p>
        <ul className="divide-y divide-slate-100">
          {picker?.variants.map((v) => {
            const inCart = cart.find((l) => l.product.id === v.id)?.qty ?? 0;
            const out = v.track_stock && v.stock <= 0;
            const low = v.track_stock && v.stock > 0 && v.stock <= v.min_stock;
            return (
              <li key={v.id}>
                <button disabled={out} onClick={() => addProduct(v)} className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-40">
                  <div>
                    <p className="font-medium">{v.variant_label}</p>
                    <p className="text-xs text-slate-500">{fmt(v.price)}{inCart > 0 && <span className="ml-2 font-semibold text-brand-700">· {inCart} en el carrito</span>}</p>
                  </div>
                  <span className={`badge ${out ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>{!v.track_stock ? 'Disponible' : out ? 'Agotado' : `${v.stock} uds`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="btn-primary mt-4 w-full" onClick={() => setPicker(null)}>Listo</button>
      </Modal>

      <CameraScanner open={camera} onClose={() => setCamera(false)} onDetected={handleCode} continuous />
    </div>
  );
}
