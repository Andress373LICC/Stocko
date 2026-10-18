import Link from 'next/link';
import { DollarSign, Receipt, Package, AlertTriangle, Users, ScanBarcode, ArrowRight } from 'lucide-react';
import { getContext, isAdminRole } from '@/lib/session';
import { addDays, dayKey, dateTime, money, shortDay } from '@/lib/format';
import { PageHeader, Stat } from '@/components/ui';
import { SalesChart } from '@/components/sales-chart';

export const metadata = { title: 'Inicio' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, business, role, userName } = await getContext();
  const first = userName.split(' ')[0];

  if (!isAdminRole(role)) {
    return (
      <>
        <PageHeader title={`Hola, ${first} 👋`} description={`Bienvenido a ${business.name}.`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/pos" className="card flex items-center justify-between p-6 hover:border-brand-300">
            <div className="flex items-center gap-4"><div className="rounded-lg bg-brand-50 p-3 text-brand-600"><ScanBarcode /></div><div><p className="font-semibold">Abrir punto de venta</p><p className="text-sm text-slate-500">Empieza a vender</p></div></div>
            <ArrowRight className="text-slate-400" />
          </Link>
          <Link href="/sales" className="card flex items-center justify-between p-6 hover:border-brand-300">
            <div className="flex items-center gap-4"><div className="rounded-lg bg-sky-50 p-3 text-sky-600"><Receipt /></div><div><p className="font-semibold">Ver ventas</p><p className="text-sm text-slate-500">Consulta e imprime recibos</p></div></div>
            <ArrowRight className="text-slate-400" />
          </Link>
        </div>
      </>
    );
  }

  const { data } = await supabase.rpc('dashboard_summary', { p_business_id: business.id, p_tz: business.timezone });
  const s: any = data ?? { today: { revenue: 0, count: 0 }, daily: [], products_count: 0, customers_count: 0, low_stock_count: 0, low_stock: [] };

  const today = dayKey(new Date(), business.timezone);
  const byDay = new Map<string, number>((s.daily as any[]).map((d) => [d.day, Number(d.total)]));
  const chart = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    return { label: shortDay(key, business.locale), total: byDay.get(key) ?? 0 };
  });
  const weekTotal = chart.reduce((a, b) => a + b.total, 0);

  const { data: recent } = await supabase
    .from('sales')
    .select('id, number, total, status, customer_name, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(6);

  return (
    <>
      <PageHeader
        title={`Hola, ${first} 👋`}
        description={`Resumen de ${business.name}.`}
        actions={<Link href="/pos" className="btn-primary"><ScanBarcode size={18} /> Nueva venta</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas de hoy" value={money(s.today.revenue, business)} sub={`${s.today.count} ${s.today.count === 1 ? 'venta' : 'ventas'}`} icon={<DollarSign size={22} />} />
        <Stat label="Productos activos" value={s.products_count} icon={<Package size={22} />} tone="sky" />
        <Stat label="Stock bajo" value={s.low_stock_count} sub="Productos por reponer" icon={<AlertTriangle size={22} />} tone={s.low_stock_count > 0 ? 'amber' : 'brand'} />
        <Stat label="Clientes" value={s.customers_count} icon={<Users size={22} />} tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Ventas de los últimos 7 días</h2>
            <span className="text-sm font-semibold text-brand-700">{money(weekTotal, business)}</span>
          </div>
          <SalesChart data={chart} locale={business.locale} currency={business.currency_code} />
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Productos por reponer</h2>
          {s.low_stock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todo el inventario está en orden ✅</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(s.low_stock as any[]).map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-brand-700">
                    <span className="truncate pr-3">{p.name}</span>
                    <span className={`badge ${p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{p.stock} uds</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Últimas ventas</h2>
          <Link href="/sales" className="text-sm font-medium text-brand-700 hover:underline">Ver todas</Link>
        </div>
        {!recent || recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Aún no hay ventas. ¡Haz la primera en el punto de venta!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((r: any) => (
              <li key={r.id}>
                <Link href={`/sales/${r.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-800">Venta #{r.number}{r.status === 'voided' && <span className="badge ml-2 bg-red-100 text-red-700">Anulada</span>}</p>
                    <p className="text-xs text-slate-500">{r.customer_name || 'Consumidor final'} · {dateTime(r.created_at, business)}</p>
                  </div>
                  <span className="font-semibold">{money(r.total, business)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
