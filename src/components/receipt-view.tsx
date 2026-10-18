'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Printer, ScanBarcode } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dateTime, money } from '@/lib/format';
import { PAYMENT_LABELS, type Business, type Sale, type SaleItem } from '@/lib/types';
import { Modal } from '@/components/ui';
import { useToast } from '@/components/toast';

type FullSale = Sale & { profiles: { full_name: string } | null; sale_items: SaleItem[] };

export function ReceiptView({ business, sale, canVoid, justCreated }: { business: Business; sale: FullSale; canVoid: boolean; justCreated: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [format, setFormat] = useState<'ticket' | 'a4'>('ticket');
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const fmt = (n: number) => money(n, business);
  const voided = sale.status === 'voided';
  const ticket = format === 'ticket';

  async function voidSale() {
    setBusy(true);
    const { error } = await createClient().rpc('void_sale', { p_sale_id: sale.id, p_reason: reason });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Venta anulada y stock restaurado', 'success');
    setVoidOpen(false);
    router.refresh();
  }

  return (
    <div>
      {/* tamaño de página para impresión */}
      <style>{ticket ? '@page { size: 80mm auto; margin: 3mm; }' : '@page { size: A4; margin: 15mm; }'}</style>

      <div className="no-print mx-auto mb-5 max-w-3xl space-y-4">
        {justCreated && !voided && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-brand-800"><CheckCircle2 size={20} /> ¡Venta registrada correctamente!</p>
            <Link href="/pos" className="btn-primary"><ScanBarcode size={18} /> Nueva venta</Link>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-slate-200 p-1 text-sm font-medium">
            {([['ticket', 'Ticket 80 mm'], ['a4', 'Factura A4']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFormat(id)} className={`rounded-md px-3 py-1.5 ${format === id ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {canVoid && !voided && <button className="btn-secondary text-red-600" onClick={() => setVoidOpen(true)}><Ban size={16} /> Anular</button>}
            <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          </div>
        </div>
      </div>

      <div className={`print-area card mx-auto bg-white p-6 ${ticket ? 'max-w-[320px] text-[13px]' : 'max-w-3xl text-sm sm:p-10'}`}>
        <div className={ticket ? 'text-center' : 'flex items-start justify-between gap-6'}>
          <div>
            <h1 className={`font-bold ${ticket ? 'text-lg' : 'text-2xl'}`}>{business.name}</h1>
            {business.tax_id && <p className="text-slate-600">ID fiscal: {business.tax_id}</p>}
            {business.address && <p className="text-slate-600">{business.address}</p>}
            {business.phone && <p className="text-slate-600">Tel: {business.phone}</p>}
          </div>
          <div className={ticket ? 'mt-3' : 'text-right'}>
            <p className={`font-bold ${ticket ? '' : 'text-xl'}`}>{ticket ? 'RECIBO' : 'FACTURA / RECIBO'} #{String(sale.number).padStart(6, '0')}</p>
            <p className="text-slate-600">{dateTime(sale.created_at, business)}</p>
          </div>
        </div>

        {voided && <p className="my-3 rounded border-2 border-red-500 py-1 text-center font-bold uppercase tracking-widest text-red-600">Anulada</p>}

        <div className={`my-4 border-y border-dashed border-slate-300 py-3 ${ticket ? '' : 'grid grid-cols-2 gap-4'}`}>
          <p><span className="text-slate-500">Cliente:</span> {sale.customer_name || 'Consumidor final'}</p>
          <p><span className="text-slate-500">Atendió:</span> {sale.profiles?.full_name || '—'}</p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5">Descripción</th><th className="py-1.5 text-center">Cant.</th>{!ticket && <th className="py-1.5 text-right">P. unit.</th>}<th className="py-1.5 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {sale.sale_items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-1.5 pr-2">{it.name}{ticket && <div className="text-xs text-slate-500">{it.quantity} × {fmt(it.unit_price)}</div>}</td>
                <td className="py-1.5 text-center">{it.quantity}</td>
                {!ticket && <td className="py-1.5 text-right">{fmt(it.unit_price)}</td>}
                <td className="py-1.5 text-right">{fmt(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{fmt(sale.subtotal)}</dd></div>
          {sale.discount > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>-{fmt(sale.discount)}</dd></div>}
          {business.tax_rate > 0 && <div className="flex justify-between"><dt>{business.tax_name} ({business.tax_rate}%)</dt><dd>{fmt(sale.tax)}</dd></div>}
          <div className="flex justify-between pt-1 text-base font-bold"><dt>TOTAL</dt><dd>{fmt(sale.total)}</dd></div>
          <div className="flex justify-between text-slate-600"><dt>Pago: {PAYMENT_LABELS[sale.payment_method]}</dt><dd>{fmt(sale.amount_paid)}</dd></div>
          {sale.change_given > 0 && <div className="flex justify-between text-slate-600"><dt>Cambio</dt><dd>{fmt(sale.change_given)}</dd></div>}
        </dl>

        {business.receipt_footer && <p className="mt-6 text-center text-slate-600">{business.receipt_footer}</p>}
        <p className="mt-2 text-center text-[10px] text-slate-400">Comprobante generado con Stocko</p>
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular venta">
        <p className="text-sm text-slate-600">Se devolverán al inventario los productos de esta venta. Esta acción no se puede deshacer.</p>
        <label className="label mt-4">Motivo (opcional)</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setVoidOpen(false)}>Cancelar</button>
          <button className="btn-danger" disabled={busy} onClick={voidSale}>{busy ? 'Anulando…' : 'Anular venta'}</button>
        </div>
      </Modal>
    </div>
  );
}
