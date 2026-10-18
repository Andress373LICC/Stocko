'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3, DollarSign, Percent, Receipt, TrendingUp } from 'lucide-react';
import { money } from '@/lib/format';
import { PAYMENT_LABELS } from '@/lib/types';
import { SalesChart } from '@/components/sales-chart';
import { EmptyState, Stat } from '@/components/ui';

const COLORS = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444'];

export function ReportsView({ business, report, daily }: { business: { locale: string; currency_code: string; tax_name: string }; report: any; daily: { label: string; total: number }[] }) {
  const fmt = (n: number) => money(n, business);
  const t = report.totals;
  const revenue = Number(t.revenue);
  const count = Number(t.count);
  const profit = Number(t.net) - Number(report.cost);
  const payments = (report.by_payment as any[]).map((p) => ({ name: PAYMENT_LABELS[p.method as keyof typeof PAYMENT_LABELS] ?? p.method, value: Number(p.total) }));

  if (count === 0) {
    return <div className="card"><EmptyState icon={<BarChart3 size={28} />} title="Sin ventas en este período" description="Prueba con otro rango de fechas o realiza tu primera venta." /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas totales" value={fmt(revenue)} sub={`${count} ${count === 1 ? 'venta' : 'ventas'}`} icon={<DollarSign size={22} />} />
        <Stat label="Ticket promedio" value={fmt(revenue / count)} icon={<Receipt size={22} />} tone="sky" />
        <Stat label="Ganancia estimada" value={fmt(profit)} sub="Ventas netas − costo de productos" icon={<TrendingUp size={22} />} tone="violet" />
        <Stat label={`${business.tax_name} cobrado`} value={fmt(Number(t.tax))} sub={Number(t.discount) > 0 ? `Descuentos: ${fmt(Number(t.discount))}` : undefined} icon={<Percent size={22} />} tone="amber" />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold">Ventas por día</h2>
        <SalesChart data={daily} locale={business.locale} currency={business.currency_code} variant={daily.length > 31 ? 'area' : 'bar'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Productos más vendidos</h2>
          <ul className="divide-y divide-slate-100">
            {(report.top_products as any[]).map((p, i) => (
              <li key={p.name + i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                  <span className="truncate font-medium">{p.name}</span>
                </div>
                <div className="shrink-0 text-right"><p className="font-semibold">{fmt(Number(p.revenue))}</p><p className="text-xs text-slate-500">{p.quantity} uds</p></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-2 font-semibold">Métodos de pago</h2>
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={payments} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={2}>
                      {payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2 text-sm">
                {payments.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}</span>
                    <span className="font-semibold">{fmt(p.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Ventas por cajero</h2>
            <ul className="divide-y divide-slate-100">
              {(report.by_user as any[]).map((u) => (
                <li key={u.name} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-right"><b>{fmt(Number(u.total))}</b> <span className="text-xs text-slate-500">· {u.count} ventas</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
