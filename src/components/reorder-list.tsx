'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Printer } from 'lucide-react';
import { useToast } from '@/components/toast';

interface Item { id: string; name: string; sku: string; stock: number; min: number; suggested: number; href: string }

export function ReorderList({ items, businessName }: { items: Item[]; businessName: string }) {
  const toast = useToast();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.suggested])));

  function copy() {
    const text = `Pedido - ${businessName}\n` + items.map((i) => `• ${i.name} — ${qty[i.id] ?? i.suggested} uds`).join('\n');
    navigator.clipboard.writeText(text).then(() => toast('Lista copiada. Pégala en WhatsApp o correo.', 'success'));
  }

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={copy}><Copy size={16} /> Copiar lista</button>
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
      </div>
      <div className="print-area card overflow-hidden">
        <div className="hidden border-b border-slate-200 p-4 print:block"><b>Pedido a proveedor — {businessName}</b></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr><th className="th">Producto</th><th className="th text-right">Stock</th><th className="th text-right">Mínimo</th><th className="th text-right">Pedir</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="td"><Link href={i.href} className="font-medium text-slate-900 hover:text-brand-700">{i.name}</Link><div className="font-mono text-xs text-slate-400">{i.sku}</div></td>
                  <td className="td text-right"><span className={`badge ${i.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{i.stock <= 0 ? 'Agotado' : i.stock}</span></td>
                  <td className="td text-right">{i.min}</td>
                  <td className="td text-right">
                    <input className="input w-20 py-1 text-right print:border-0 print:shadow-none" inputMode="numeric" value={qty[i.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [i.id]: parseInt(e.target.value) || 0 }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
