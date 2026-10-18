import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { addDays, dayKey, money, shortDay } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { ReportsView } from '@/components/reports-view';

export const metadata = { title: 'Reportes' };
export const dynamic = 'force-dynamic';

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string; r?: string } }) {
  const { supabase, business } = await requireAdmin();
  const today = dayKey(new Date(), business.timezone);

  let from = addDays(today, -29);
  let to = today;
  const r = searchParams.r;
  if (r === 'today') from = today;
  else if (r === '7') from = addDays(today, -6);
  else if (r === '90') from = addDays(today, -89);
  else if (r === 'month') from = today.slice(0, 8) + '01';
  else if (r === 'year') from = today.slice(0, 4) + '-01-01';
  else if (isDate(searchParams.from) && isDate(searchParams.to)) { from = searchParams.from!; to = searchParams.to!; }
  if (from > to) [from, to] = [to, from];
  // Máximo 400 días para mantener el reporte rápido.
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 400) from = addDays(to, -400);

  const { data, error } = await supabase.rpc('report_summary', { p_business_id: business.id, p_from: from, p_to: to, p_tz: business.timezone });
  const rep: any = data ?? { totals: { revenue: 0, net: 0, tax: 0, discount: 0, count: 0 }, cost: 0, voided: 0, daily: [], top_products: [], by_payment: [], by_user: [] };

  const byDay = new Map<string, number>((rep.daily as any[]).map((d) => [d.day, Number(d.total)]));
  const daily: { label: string; total: number }[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) daily.push({ label: shortDay(k, business.locale), total: byDay.get(k) ?? 0 });

  const presets = [['today', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['month', 'Este mes'], ['90', '90 días'], ['year', 'Este año']];
  const active = r ?? (searchParams.from ? 'custom' : '30');

  return (
    <>
      <PageHeader title="Reportes" description={`Del ${shortDay(from, business.locale)} al ${shortDay(to, business.locale)} · ${business.currency_code}`} />

      <div className="no-print mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {presets.map(([id, label]) => (
            <Link key={id} href={`/reports?r=${id}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${active === id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{label}</Link>
          ))}
        </div>
        <form action="/reports" className="flex items-end gap-2">
          <div><label className="label">Desde</label><input type="date" name="from" defaultValue={from} className="input" /></div>
          <div><label className="label">Hasta</label><input type="date" name="to" defaultValue={to} className="input" /></div>
          <button className="btn-secondary">Ver</button>
        </form>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      <ReportsView
        business={{ locale: business.locale, currency_code: business.currency_code, tax_name: business.tax_name }}
        report={rep}
        daily={daily}
      />
    </>
  );
}
