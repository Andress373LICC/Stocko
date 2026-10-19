import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { displayName } from '@/lib/types';
import { PageHeader } from '@/components/ui';
import { ReorderList } from '@/components/reorder-list';

export const metadata = { title: 'Lista de pedido' };
export const dynamic = 'force-dynamic';

export default async function ReorderPage() {
  const { supabase, business } = await requireAdmin();
  const { data } = await supabase
    .from('products')
    .select('id, name, variant_label, sku, stock, min_stock, group_id')
    .eq('business_id', business.id)
    .eq('active', true)
    .eq('is_low', true)
    .order('stock', { ascending: true })
    .range(0, 999);

  const items = ((data as any[]) ?? []).map((p) => ({
    id: p.id,
    name: displayName(p),
    sku: p.sku as string,
    stock: p.stock as number,
    min: p.min_stock as number,
    // Sugerencia: reponer hasta el doble del mínimo.
    suggested: Math.max(p.min_stock * 2 - p.stock, 1),
    href: p.group_id ? `/products/group/${p.group_id}` : `/products/${p.id}`,
  }));

  return (
    <>
      <Link href="/products" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Productos</Link>
      <PageHeader title="Lista de pedido" description="Productos agotados o por agotarse, listos para pedir a tu proveedor." />
      {items.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <CheckCircle2 className="mb-3 text-brand-600" size={40} />
          <p className="font-semibold">Todo tu inventario está en orden</p>
          <p className="mt-1 text-sm text-slate-500">No hay productos por reponer en este momento.</p>
        </div>
      ) : (
        <ReorderList items={items} businessName={business.name} />
      )}
    </>
  );
}
