import Link from 'next/link';
import { Receipt, Search } from 'lucide-react';
import { getContext } from '@/lib/session';
import { dateTime, money } from '@/lib/format';
import { PAYMENT_LABELS } from '@/lib/types';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Ventas' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function SalesPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const { supabase, business } = await getContext();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? '').replace(/\D/g, '');

  let query = supabase
    .from('sales')
    .select('id, number, total, status, payment_method, customer_name, created_at, profiles(full_name)', { count: 'exact' })
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.eq('number', Number(q));

  const { data: sales, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number) => `/sales?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Ventas" description="Historial de ventas, recibos y facturas." />
      <form action="/sales" className="mb-4 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por número de venta" className="input pl-10" inputMode="numeric" />
        </div>
        <button className="btn-secondary">Buscar</button>
      </form>

      <div className="card overflow-hidden">
        {!sales || sales.length === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="No hay ventas" description="Cuando hagas ventas en el punto de venta aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr><th className="th">N.º</th><th className="th">Fecha</th><th className="th">Cliente</th><th className="th">Cajero</th><th className="th">Pago</th><th className="th text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="td font-semibold"><Link href={`/sales/${s.id}`} className="text-brand-700 hover:underline">#{s.number}</Link>{s.status === 'voided' && <span className="badge ml-2 bg-red-100 text-red-700">Anulada</span>}</td>
                    <td className="td whitespace-nowrap">{dateTime(s.created_at, business)}</td>
                    <td className="td">{s.customer_name || 'Consumidor final'}</td>
                    <td className="td">{s.profiles?.full_name || '—'}</td>
                    <td className="td">{PAYMENT_LABELS[s.payment_method as keyof typeof PAYMENT_LABELS]}</td>
                    <td className={`td text-right font-semibold ${s.status === 'voided' ? 'text-slate-400 line-through' : ''}`}>{money(s.total, business)}</td>
                  </tr>
                ))}
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
