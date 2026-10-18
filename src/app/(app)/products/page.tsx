import Link from 'next/link';
import { Package, Plus, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { money } from '@/lib/format';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Productos' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string; cat?: string; page?: string } }) {
  const { supabase, business } = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? '').replace(/[,()%*\\]/g, ' ').trim();
  const cat = searchParams.cat ?? '';

  const { data: categories } = await supabase.from('categories').select('id, name').eq('business_id', business.id).order('name');

  let query = supabase
    .from('products')
    .select('id, sku, barcode, name, price, stock, min_stock, track_stock, image_url, active, categories(name)', { count: 'exact' })
    .eq('business_id', business.id)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
  if (cat) query = query.eq('category_id', cat);

  const { data: products, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/products?${new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${total} ${total === 1 ? 'producto' : 'productos'} en tu inventario`}
        actions={<Link href="/products/new" className="btn-primary"><Plus size={18} /> Nuevo producto</Link>}
      />

      <form className="mb-4 flex flex-col gap-3 sm:flex-row" action="/products">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, SKU o código de barras…" className="input pl-10" />
        </div>
        <select name="cat" defaultValue={cat} className="input sm:w-56">
          <option value="">Todas las categorías</option>
          {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="card overflow-hidden">
        {!products || products.length === 0 ? (
          <EmptyState
            icon={<Package size={28} />}
            title={q || cat ? 'No encontramos productos' : 'Aún no tienes productos'}
            description={q || cat ? 'Prueba con otra búsqueda.' : 'Agrega tu primer producto para empezar a vender.'}
            action={!q && !cat ? <Link href="/products/new" className="btn-primary"><Plus size={18} /> Agregar producto</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr><th className="th">Producto</th><th className="th">Código</th><th className="th">Categoría</th><th className="th text-right">Precio</th><th className="th text-right">Stock</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p: any) => {
                  const low = p.track_stock && p.stock <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="td">
                        <Link href={`/products/${p.id}`} className="flex items-center gap-3 font-medium text-slate-900 hover:text-brand-700">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Package size={18} /></span>
                          )}
                          <span>{p.name}{!p.active && <span className="badge ml-2 bg-slate-200 text-slate-600">Inactivo</span>}</span>
                        </Link>
                      </td>
                      <td className="td"><div className="font-mono text-xs">{p.sku}</div>{p.barcode && <div className="font-mono text-xs text-slate-400">{p.barcode}</div>}</td>
                      <td className="td">{p.categories?.name ?? '—'}</td>
                      <td className="td text-right font-medium">{money(p.price, business)}</td>
                      <td className="td text-right">
                        {p.track_stock ? <span className={`badge ${low ? (p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700') : 'bg-brand-50 text-brand-700'}`}>{p.stock}</span> : <span className="text-slate-400">—</span>}
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
