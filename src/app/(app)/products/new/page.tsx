import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { ProductForm } from '@/components/product-form';
import { VariantForm } from '@/components/variant-form';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage({ searchParams }: { searchParams: { type?: string } }) {
  const { supabase, business } = await requireAdmin();
  const { data: categories } = await supabase.from('categories').select('id, name').eq('business_id', business.id).order('name');
  const variants = searchParams.type === 'variants';

  return (
    <>
      <PageHeader title="Nuevo producto" description={variants ? 'Un mismo producto con distintas tallas, colores u otras opciones.' : 'Escanea el código de barras o escríbelo manualmente.'} />
      <div className="mb-5 inline-flex rounded-lg bg-slate-200 p-1 text-sm font-medium">
        <Link href="/products/new" className={`rounded-md px-4 py-1.5 ${!variants ? 'bg-white shadow-sm' : 'text-slate-600'}`}>Producto simple</Link>
        <Link href="/products/new?type=variants" className={`rounded-md px-4 py-1.5 ${variants ? 'bg-white shadow-sm' : 'text-slate-600'}`}>Con variantes (talla, color…)</Link>
      </div>
      {variants ? <VariantForm businessId={business.id} categories={categories ?? []} /> : <ProductForm businessId={business.id} categories={categories ?? []} />}
    </>
  );
}
