'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ScanBarcode, Package, Users, Receipt, BarChart3, Settings, Menu, X, LogOut } from 'lucide-react';
import { Logo } from '@/components/logo';
import type { Role } from '@/lib/types';

const NAV = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, admin: false },
  { href: '/pos', label: 'Punto de venta', icon: ScanBarcode, admin: false },
  { href: '/sales', label: 'Ventas', icon: Receipt, admin: false },
  { href: '/products', label: 'Productos', icon: Package, admin: true },
  { href: '/customers', label: 'Clientes', icon: Users, admin: false },
  { href: '/reports', label: 'Reportes', icon: BarChart3, admin: true },
  { href: '/settings', label: 'Configuración', icon: Settings, admin: true },
];

const ROLE_LABEL: Record<Role, string> = { owner: 'Propietario', admin: 'Administrador', cashier: 'Cajero' };

export function AppShell({ businessName, userName, role, children }: { businessName: string; userName: string; role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = role !== 'cashier';
  const items = NAV.filter((n) => !n.admin || isAdmin);

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
      <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
      <form action="/auth/signout" method="post" className="mt-3">
        <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600"><LogOut size={16} /> Cerrar sesión</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Escritorio */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <Logo href="/dashboard" />
          <p className="mt-2 truncate text-xs font-medium text-slate-500">{businessName}</p>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Móvil */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"><Menu size={22} /></button>
        <Logo href="/dashboard" />
        <span className="w-8" />
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <Logo href="/dashboard" />
                <p className="mt-1 max-w-[11rem] truncate text-xs text-slate-500">{businessName}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
