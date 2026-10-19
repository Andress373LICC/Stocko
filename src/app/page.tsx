import Link from 'next/link';
import { ScanBarcode, Package, BarChart3, Receipt, Globe2, Users, ArrowRight, Check } from 'lucide-react';
import { Logo } from '@/components/logo';

const features = [
  { icon: ScanBarcode, title: 'Venta rápida con escáner', text: 'Búsqueda instantánea (Ctrl + K), lector USB o Bluetooth y cámara del celular. Vende en segundos, sin filas.' },
  { icon: Package, title: 'Inventario en tiempo real', text: 'Variantes por talla y color, alertas de stock bajo, lista de pedido, costos, fotos e historial de movimientos.' },
  { icon: Receipt, title: 'Recibos y facturas', text: 'Comprobantes listos para imprimir en ticket térmico (80 mm) o en hoja carta/A4.' },
  { icon: BarChart3, title: 'Reportes claros', text: 'Ventas por día, productos más vendidos, ganancias, métodos de pago y rendimiento por cajero.' },
  { icon: Globe2, title: 'Listo para tu país', text: 'Detectamos tu país y configuramos moneda e impuestos automáticamente. Tú solo vendes.' },
  { icon: Users, title: 'Clientes y equipo', text: 'Registra clientes con nombre y teléfono, consulta su historial e invita cajeros con un código.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Iniciar sesión</Link>
          <Link href="/signup" className="btn-primary">Crear cuenta gratis</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:pt-24">
          <span className="badge bg-brand-100 text-brand-700">Inventario + Punto de venta en la nube</span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Controla tu negocio <span className="text-brand-600">sin complicaciones</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Stockery te ayuda a vender, controlar tu inventario y entender tus números desde cualquier dispositivo. Sin instalar nada.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Empezar ahora <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">Ya tengo cuenta</Link>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            {['Sin instalación', 'Funciona en celular, tablet y PC', 'Compatible con lectores de código de barras'].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-brand-600" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="mb-4 inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-600"><f.icon size={22} /></div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Stockery. Todos los derechos reservados.
      </footer>
    </div>
  );
}
