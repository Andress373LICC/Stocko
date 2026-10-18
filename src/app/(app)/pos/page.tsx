import { getContext } from '@/lib/session';
import { PosClient } from '@/components/pos-client';

export const metadata = { title: 'Punto de venta' };
export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const { supabase, business } = await getContext();

  const [{ data: products }, { data: categories }, { data: customers }] = await Promise.all([
    supabase
      .from('products')
      .select('id, category_id, sku, barcode, name, price, stock, track_stock, image_url')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name')
      .range(0, 4999),
    supabase.from('categories').select('id, name').eq('business_id', business.id).order('name'),
    supabase.from('customers').select('id, name').eq('business_id', business.id).order('name').range(0, 1999),
  ]);

  return <PosClient business={business} products={(products as any) ?? []} categories={categories ?? []} customers={customers ?? []} />;
}
