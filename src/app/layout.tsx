import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/toast';

export const metadata: Metadata = {
  title: { default: 'Stockery · Inventario y ventas para tu negocio', template: '%s · Stockery' },
  description: 'Punto de venta, inventario, facturas y reportes en la nube. Escanea productos con tu lector de código de barras o con la cámara.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#059669', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
