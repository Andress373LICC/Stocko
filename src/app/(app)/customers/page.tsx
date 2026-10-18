import { getContext } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { CustomersClient } from '@/components/customers-client';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { supabase, business } = await getContext();
  const { data } = await supabase.from('customers').select('*').eq('business_id', business.id).order('name').range(0, 2999);
  return (
    <>
      <PageHeader title="Clientes" description="Tu lista de clientes para asociarlos a las ventas." />
      <CustomersClient businessId={business.id} initial={(data as any) ?? []} />
    </>
  );
}
