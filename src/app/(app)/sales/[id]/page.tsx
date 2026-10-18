import { notFound } from 'next/navigation';
import { getContext, isAdminRole } from '@/lib/session';
import { ReceiptView } from '@/components/receipt-view';

export const metadata = { title: 'Recibo' };
export const dynamic = 'force-dynamic';

export default async function SaleDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { new?: string } }) {
  const { supabase, business, role } = await getContext();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const { data: sale } = await supabase
    .from('sales')
    .select('*, profiles(full_name), sale_items(id, name, sku, quantity, unit_price, line_total)')
    .eq('id', params.id)
    .eq('business_id', business.id)
    .maybeSingle();
  if (!sale) notFound();

  return <ReceiptView business={business} sale={sale as any} canVoid={isAdminRole(role)} justCreated={searchParams.new === '1'} />;
}
