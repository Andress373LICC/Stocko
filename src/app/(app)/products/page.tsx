import Link from 'next/link';
import { AlertTriangle, ClipboardList, Layers, Package, Plus, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { money } from '@/lib/format';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Productos' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string; cat?: string; page?: string; stock?: string } }) {
  const { supabase, business } = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? '').replace(/[,()%*\\]/g, ' ').trim();
  const cat = searchParams.cat ?? '';
  const stock = searchParams.stock === 'low' || searchParams.stock === 'out' ? searchParams.stock : '';

  const [{ data: categories }, catalog, lowCount, outCount] = await Promise.all([
    supabase.from('categories').select('id, name').eq('business_id', business.id).order('name'),
    supabase.rpc('list_catalog', { p_business_id: business.id, p_q: q || null, p_category: cat || null, p_stock: stock || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true).eq('is_low', true).gt('stock', 0),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true).eq('track_stock', true).lte('stock', 0),
  ]);

  const result: any = catalog.data ?? { total: 0, rows: [] };
  const rows: any[] = result.rows;
  const total: number = Number(result.total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const low = lowCount.count ?? 0;
  const out = outCount.count ?? 0;
  const href = (p: number, over: Record<string, string> = {}) => {
    const base: Record<string, string> = { ...(q && { q }), ...(cat && { cat }), ...(stock && { stock }), ...over, page: String(p) };
    Object.keys(base).forEach((k) => !base[k] && delete base[k]);
    return `/products?${new URLSearchParams(base)}`;
  };

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${total} ${total === 1 ? 'producto' : 'productos'}${stock ? ' con este filtro' : ' en tu inventario'}`}
        actions={
          <>
            <Link href="/products/new?type=variants" className="btn-secondary"><Layers size={18} /> Con variantes</Link>
            <Link href="/products/new" className="btn-primary"><Plus size={18} /> Nuevo producto</Link>
          </>
        }
      />

      {(low > 0 || out > 0) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Link href={href(1, { stock: stock === 'out' ? '' : 'out' })} className={`flex items-center gap-3 rounded-xl border p-4 transition ${stock === 'out' ? 'border-red-400 bg-red-100' : 'border-red-200 bg-red-50 hover:bg-red-100'}`}>
            <AlertTriangle className="text-red-600" />
            <div><p className="text-2xl font-bold text-red-700">{out}</p><p className="text-sm font-medium text-red-700">Agotados</p></div>
          </Link>
          <Link href={href(1, { stock: stock === 'low' ? '' : 'low' })} className={`flex items-center gap-3 rounded-xl border p-4 transition ${stock === 'low' ? 'border-amber-400 bg-amber-100' : 'border-amber-200 bg-amber-50 hover:bg-amber-100'}`}>
            <AlertTriangle className="text-amber-600" />
            <div><p className="text-2xl font-bold text-amber-700">{low}</p><p className="text-sm font-medium text-amber-700">Por agotarse</p></div>
          </Link>
        </div>
      )}

      <form className="mb-4 flex flex-col gap-3 sm:flex-row" action="/products">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, SKU, talla o código de barras…" className="input pl-10" />
        </div>
        <select name="cat" defaultValue={cat} className="input sm:w-52">
          <option value="">Todas las categorías</option>
          {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="stock" defaultValue={stock} className="input sm:w-44">
          <option value="">Todo el stock</option>
          <option value="low">Por agotarse</option>
          <option value="out">Agotados</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
        {(low > 0 || out > 0) && <Link href="/products/reorder" className="btn-secondary"><ClipboardList size={18} /> Lista de pedido</Link>}
      </form>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package size={28} />}
            title={q || cat || stock ? 'No encontramos productos' : 'Aún no tienes productos'}
            description={q || cat || stock ? 'Prueba con otra búsqueda o quita los filtros.' : 'Agrega tu primer producto para empezar a vender.'}
            action={!q && !cat && !stock ? <Link href="/products/new" className="btn-primary"><Plus size={18} /> Agregar producto</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr><th className="th">Producto</th><th className="th">Código</th><th className="th">Categoría</th><th className="th text-right">Precio</th><th className="th text-right">Stock</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const isGroup = p.kind === 'group';
                  const link = isGroup ? `/products/group/${p.id}` : `/products/${p.id}`;
                  const cname = categories?.find((c: any) => c.id === p.category_id)?.name;
                  const tone = p.is_out ? 'bg-red-100 text-red-700' : p.is_low ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700';
                  return (
                    <tr key={p.kind + p.id} className={p.is_out ? 'bg-red-50/40 hover:bg-red-50' : p.is_low ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}>
                      <td className="td">
                        <Link href={link} className="flex items-center gap-3 font-medium text-slate-900 hover:text-brand-700">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">{isGroup ? <Layers size={18} /> : <Package size={18} />}</span>
                          )}
                          <span>
                            {p.name}
                            {isGroup && <span className="badge ml-2 bg-violet-100 text-violet-700">{p.variants} variantes</span>}
                            {!p.active && <span className="badge ml-2 bg-slate-200 text-slate-600">Inactivo</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="td">{isGroup ? <span className="text-xs text-slate-400">Varios</span> : <><div className="font-mono text-xs">{p.sku}</div>{p.barcode && <div className="font-mono text-xs text-slate-400">{p.barcode}</div>}</>}</td>
                      <td className="td">{cname ?? '—'}</td>
                      <td className="td text-right font-medium">{Number(p.price_min) === Number(p.price_max) ? money(p.price_min, business) : `${money(p.price_min, business)} – ${money(p.price_max, business)}`}</td>
                      <td className="td text-right">
                        {p.track ? (
                          <span className={`badge ${tone}`}>
                            {p.is_out ? (isGroup ? `${p.stock} · hay agotados` : 'Agotado') : p.is_low ? (isGroup ? `${p.stock} · stock bajo` : `${p.stock} · Bajo`) : p.stock}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Página {page} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href(page - 1)} className="btn-secondary btn-sm">Anterior</Link>}
            {page < pages && <Link href={href(page + 1)} className="btn-secondary btn-sm">Siguiente</Link>}
          </div>
        </div>
      )}
    </>
  );
}
