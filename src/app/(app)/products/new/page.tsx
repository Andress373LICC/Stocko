import { requireAdmin } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { ProductForm } from '@/components/product-form';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage() {
  const { supabase, business } = await requireAdmin();
  const { data: categories } = await supabase.from('categories').select('id, name').eq('business_id', business.id).order('name');
  return (
    <>
      <PageHeader title="Nuevo producto" description="Escanea el código de barras o escríbelo manualmente." />
      <ProductForm businessId={business.id} categories={categories ?? []} />
    </>
  );
}
