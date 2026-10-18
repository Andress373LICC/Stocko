'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  data: { label: string; total: number }[];
  locale: string;
  currency: string;
  variant?: 'area' | 'bar';
}

export function SalesChart({ data, locale, currency, variant = 'area' }: Props) {
  const compact = (v: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const full = (v: number) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v); } catch { return String(v); }
  };
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={16} />
      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
      <Tooltip formatter={(v: number) => [full(v), 'Ventas']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
    </>
  );
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'bar' ? (
          <BarChart data={data}>{common}<Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            {common}
            <Area type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} fill="url(#g)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
