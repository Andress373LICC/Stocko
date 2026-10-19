'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ScanBarcode, Package, Users, Receipt, BarChart3, Settings, Menu, X, LogOut, Search } from 'lucide-react';
import { Logo } from '@/components/logo';
import { GlobalSearch } from '@/components/global-search';
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

export function AppShell({ businessId, businessName, userName, role, children }: { businessId: string; businessName: string; userName: string; role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Atajo global: Ctrl+K (o ⌘K en Mac) abre la búsqueda rápida.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
        <button onClick={() => setSearchOpen(true)} aria-label="Buscar" className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50"><Search size={22} /></button>
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

      <div className="min-w-0 flex-1">
        {/* Barra superior de escritorio: búsqueda siempre visible */}
        <div className="no-print sticky top-0 z-30 hidden items-center gap-3 border-b border-slate-200 bg-white/90 px-8 py-3 backdrop-blur lg:flex">
          <button onClick={() => setSearchOpen(true)} className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-sm text-slate-500 shadow-sm hover:border-brand-400">
            <Search size={18} className="text-slate-400" />
            <span className="flex-1">Buscar producto, código de barras o cliente…</span>
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500">Ctrl K</kbd>
          </button>
          <Link href="/pos" className="btn-primary ml-auto"><ScanBarcode size={18} /> Nueva venta</Link>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} businessId={businessId} role={role} />
    </div>
  );
}
