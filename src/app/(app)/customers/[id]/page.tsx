import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Phone, Receipt, ScanBarcode, ShoppingBag, Star, TrendingUp } from 'lucide-react';
import { getContext } from '@/lib/session';
import { dateTime, money } from '@/lib/format';
import { PAYMENT_LABELS } from '@/lib/types';
import { EmptyState, Stat } from '@/components/ui';

export const metadata = { title: 'Cliente' };
export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { supabase, business } = await getContext();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const { data: customer } = await supabase.from('customers').select('*').eq('id', params.id).eq('business_id', business.id).maybeSingle();
  if (!customer) notFound();

  const [{ data: recent }, { data: allSales }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, number, total, status, payment_method, created_at, sale_items(id, name, quantity, unit_price)')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('sales').select('total, status, created_at').eq('customer_id', params.id).range(0, 4999),
  ]);

  const completed = ((allSales as any[]) ?? []).filter((s) => s.status === 'completed');
  const spent = completed.reduce((a, s) => a + Number(s.total), 0);
  const lastDate = completed.length ? completed.reduce((a, s) => (s.created_at > a ? s.created_at : a), completed[0].created_at) : null;

  // Productos que más compra (sobre sus últimas compras)
  const tally = new Map<string, number>();
  for (const s of (recent as any[]) ?? []) {
    if (s.status !== 'completed') continue;
    for (const it of s.sale_items) tally.set(it.name, (tally.get(it.name) ?? 0) + it.quantity);
  }
  const favorites = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Clientes</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {customer.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1.5"><Mail size={14} />{customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1.5"><MapPin size={14} />{customer.address}</span>}
            {customer.tax_id && <span>ID: {customer.tax_id}</span>}
          </div>
          {customer.notes && <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{customer.notes}</p>}
        </div>
        <Link href="/pos" className="btn-primary"><ScanBarcode size={18} /> Nueva venta</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total comprado" value={money(spent, business)} icon={<TrendingUp size={22} />} />
        <Stat label="Compras" value={completed.length} sub={completed.length ? `Promedio ${money(spent / completed.length, business)}` : undefined} icon={<ShoppingBag size={22} />} tone="sky" />
        <Stat label="Última compra" value={lastDate ? new Intl.DateTimeFormat(business.locale, { dateStyle: 'medium', timeZone: business.timezone }).format(new Date(lastDate)) : '—'} icon={<Receipt size={22} />} tone="violet" />
      </div>

      {favorites.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Star size={18} className="text-amber-500" /> Lo que más compra</h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map(([name, qty]) => <span key={name} className="badge bg-slate-100 px-3 py-1 text-sm text-slate-700">{name} <b className="ml-1.5 text-brand-700">×{qty}</b></span>)}
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Historial de compras</h2>
        {!recent || recent.length === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="Sin compras todavía" description="Cuando le vendas a este cliente, sus compras aparecerán aquí." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {(recent as any[]).map((s) => (
              <li key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/sales/${s.id}`} className="font-semibold text-brand-700 hover:underline">Venta #{s.number}</Link>
                    {s.status === 'voided' && <span className="badge ml-2 bg-red-100 text-red-700">Anulada</span>}
                    <p className="text-xs text-slate-500">{dateTime(s.created_at, business)} · {PAYMENT_LABELS[s.payment_method as keyof typeof PAYMENT_LABELS]}</p>
                  </div>
                  <span className={`font-semibold ${s.status === 'voided' ? 'text-slate-400 line-through' : ''}`}>{money(s.total, business)}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                  {s.sale_items.map((it: any) => (
                    <li key={it.id} className="flex justify-between gap-3"><span className="truncate">{it.quantity} × {it.name}</span><span className="shrink-0 text-slate-400">{money(it.unit_price * it.quantity, business)}</span></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
