import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { ProductForm } from '@/components/product-form';
import type { Product } from '@/lib/types';

export const metadata = { title: 'Editar producto' };
export const dynamic = 'force-dynamic';

const REASONS: Record<string, string> = { sale: 'Venta', void: 'Venta anulada', initial: 'Stock inicial', adjustment: 'Ajuste' };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const { supabase, business } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).eq('business_id', business.id).maybeSingle();
  if (!product) notFound();
  if (product.group_id) redirect(`/products/group/${product.group_id}`);

  const [{ data: categories }, { data: movements }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('business_id', business.id).order('name'),
    supabase.from('stock_movements').select('id, quantity, reason, created_at').eq('product_id', params.id).order('created_at', { ascending: false }).limit(15),
  ]);

  return (
    <>
      <PageHeader title={product.name} description={`SKU ${product.sku}`} />
      <ProductForm businessId={business.id} categories={categories ?? []} product={product as Product} />

      {product.track_stock && (
        <div className="card mt-6 max-w-3xl">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Historial de stock</h2>
          {!movements || movements.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Sin movimientos todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {movements.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{REASONS[m.reason] ?? m.reason}</p>
                    <p className="text-xs text-slate-500">{dateTime(m.created_at, business)}</p>
                  </div>
                  <span className={`font-semibold ${m.quantity > 0 ? 'text-brand-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
