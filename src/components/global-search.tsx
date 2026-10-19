'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, User, CornerDownLeft, ScanBarcode, LayoutDashboard, Receipt, Users, BarChart3, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui';
import { displayName, type Role } from '@/lib/types';

interface Result { key: string; kind: 'product' | 'customer' | 'page'; title: string; sub?: string; badge?: string; badgeTone?: 'red' | 'amber' | 'green'; href: string }

const PAGES = [
  { title: 'Punto de venta', href: '/pos', icon: ScanBarcode, admin: false, kw: 'pos caja vender venta' },
  { title: 'Inicio', href: '/dashboard', icon: LayoutDashboard, admin: false, kw: 'dashboard resumen' },
  { title: 'Ventas', href: '/sales', icon: Receipt, admin: false, kw: 'recibos facturas historial' },
  { title: 'Clientes', href: '/customers', icon: Users, admin: false, kw: 'cliente' },
  { title: 'Productos', href: '/products', icon: Package, admin: true, kw: 'inventario stock' },
  { title: 'Productos por agotarse', href: '/products?stock=low', icon: Package, admin: true, kw: 'bajo stock reponer pedido agotar' },
  { title: 'Reportes', href: '/reports', icon: BarChart3, admin: true, kw: 'ventas ganancias' },
  { title: 'Configuración', href: '/settings', icon: Settings, admin: true, kw: 'ajustes impuestos equipo' },
];

export function GlobalSearch({ open, onClose, businessId, role }: { open: boolean; onClose: () => void; businessId: string; role: Role }) {
  const router = useRouter();
  const isAdmin = role !== 'cashier';
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) { setQ(''); setResults([]); setActive(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.replace(/[,()%*\\]/g, ' ').trim();
    const my = ++seq.current;

    const pages: Result[] = PAGES
      .filter((p) => (isAdmin || !p.admin) && (!term || (p.title + ' ' + p.kw).toLowerCase().includes(term.toLowerCase())))
      .slice(0, term ? 3 : 8)
      .map((p) => ({ key: 'pg' + p.href, kind: 'page', title: p.title, href: p.href }));

    if (term.length < 1) { setResults(pages); setActive(0); return; }

    setLoading(true);
    const t = setTimeout(async () => {
      const supabase = createClient();
      const [prod, cust] = await Promise.all([
        supabase.from('products').select('id, name, variant_label, sku, barcode, price, stock, min_stock, track_stock, group_id')
          .eq('business_id', businessId).eq('active', true)
          .or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%,variant_label.ilike.%${term}%`).order('name').limit(8),
        supabase.from('customers').select('id, name, phone').eq('business_id', businessId)
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%`).order('name').limit(4),
      ]);
      if (my !== seq.current) return;
      const out: Result[] = [];
      for (const p of (prod.data ?? []) as any[]) {
        const stockText = p.track_stock ? (p.stock <= 0 ? 'Agotado' : `${p.stock} en stock`) : 'Sin control de stock';
        out.push({
          key: 'p' + p.id, kind: 'product', title: displayName(p),
          sub: [p.sku, p.barcode].filter(Boolean).join(' · '),
          badge: stockText, badgeTone: !p.track_stock ? 'green' : p.stock <= 0 ? 'red' : p.stock <= p.min_stock ? 'amber' : 'green',
          href: isAdmin ? (p.group_id ? `/products/group/${p.group_id}` : `/products/${p.id}`) : `/pos?q=${encodeURIComponent(p.sku)}`,
        });
      }
      for (const c of (cust.data ?? []) as any[]) {
        out.push({ key: 'c' + c.id, kind: 'customer', title: c.name, sub: c.phone ?? undefined, href: `/customers/${c.id}` });
      }
      setResults([...out, ...pages]);
      setActive(0);
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q, open, businessId, isAdmin]);

  const go = useCallback((r: Result) => { onClose(); router.push(r.href); }, [onClose, router]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      // Un escáner de códigos "teclea" el código y pulsa Enter: abrimos el producto directo.
      const first = results.find((r) => r.kind === 'product');
      const pick = results[active] ?? first;
      if (pick) go(pick);
    }
  }

  const icon = (k: Result['kind']) => (k === 'product' ? <Package size={18} /> : k === 'customer' ? <User size={18} /> : <CornerDownLeft size={18} />);
  const tone = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-brand-50 text-brand-700' };

  return (
    <Modal open={open} onClose={onClose} title="Búsqueda rápida" wide>
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Producto, código de barras, SKU, cliente o página…"
          className="input py-3 pl-11 text-base"
        />
      </div>
      <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
        {results.map((r, i) => (
          <li key={r.key}>
            <button
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
            >
              <span className={`shrink-0 ${r.kind === 'page' ? 'text-slate-400' : 'text-brand-600'}`}>{icon(r.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{r.title}</span>
                {r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}
              </span>
              {r.badge && <span className={`badge shrink-0 ${tone[r.badgeTone ?? 'green']}`}>{r.badge}</span>}
              {r.kind === 'page' && <span className="text-xs text-slate-400">Ir</span>}
            </button>
          </li>
        ))}
        {!loading && q.trim() && results.every((r) => r.kind === 'page') && <li className="px-3 py-6 text-center text-sm text-slate-500">No encontramos productos ni clientes con “{q}”.</li>}
      </ul>
      <p className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>↑↓ moverse</span><span>Enter abrir</span><span>Esc cerrar</span>
      </p>
    </Modal>
  );
}
