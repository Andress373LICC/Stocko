import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { VariantForm } from '@/components/variant-form';

export const metadata = { title: 'Editar producto con variantes' };
export const dynamic = 'force-dynamic';

export default async function EditGroupPage({ params }: { params: { id: string } }) {
  const { supabase, business } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const { data: group } = await supabase.from('product_groups').select('*').eq('id', params.id).eq('business_id', business.id).maybeSingle();
  if (!group) notFound();

  const [{ data: categories }, { data: variants }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('business_id', business.id).order('name'),
    supabase.from('products').select('id, options, variant_label, sku, barcode, price, cost, stock, min_stock, track_stock, active').eq('group_id', params.id).order('variant_label'),
  ]);

  return (
    <>
      <PageHeader title={group.name} description="Producto con variantes" />
      <VariantForm businessId={business.id} categories={categories ?? []} group={group as any} variants={(variants as any) ?? []} />
    </>
  );
}
