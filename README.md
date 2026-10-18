# Stocko

Inventario, punto de venta, recibos/facturas y reportes en la nube, para cualquier negocio.
Multi-negocio: cada persona crea su cuenta y su negocio, y sus datos quedan aislados de los demás.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth + Storage) · Vercel

## Funciones

- Cuentas de usuario (registro, login, recuperar contraseña) y **equipo con roles** (propietario, administrador, cajero) mediante código de invitación.
- **Detección automática de país**: al crear el negocio se sugieren moneda, nombre del impuesto, porcentaje y si los precios lo incluyen. Todo se puede editar después.
- **Punto de venta** con carrito, descuento, cliente, métodos de pago y cálculo de cambio.
- **Escáneres**: USB/Bluetooth (modo teclado, sin drivers), puerto serie (COM) y cámara del celular.
- **Inventario**: productos con imagen, categorías, costo, código de barras, stock mínimo, ajustes e historial de movimientos.
- **Recibos y facturas** imprimibles en ticket 80 mm o A4; anulación de ventas con devolución de stock.
- **Reportes**: ventas por día, ticket promedio, ganancia estimada, impuestos, productos más vendidos, métodos de pago y ventas por cajero.

> Los recibos de Stocko son comprobantes internos. No sustituyen la factura fiscal autorizada por la autoridad tributaria de tu país. Las tasas de impuestos por país son valores sugeridos: confírmalas con tu contador.

---

## Puesta en marcha (todo desde el navegador, sin instalar nada)

### 1. Subir el código a GitHub
1. Crea un repositorio nuevo en GitHub llamado `stocko` (vacío).
2. Entra a **Add file → Upload files** y arrastra **el contenido** de esta carpeta (incluidos `src`, `supabase`, `public` y los archivos de la raíz). No subas `node_modules` ni `.next`.
3. Pulsa **Commit changes**.

### 2. Crear la base de datos en Supabase
1. Crea una cuenta en https://supabase.com y un **New project** (guarda la contraseña de la base de datos).
2. Ve a **SQL Editor → New query**, pega **todo** el contenido de `supabase/schema.sql` y pulsa **Run**. Debe terminar sin errores (ejecútalo una sola vez).
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**

### 3. Publicar en Vercel
1. En https://vercel.com entra con tu cuenta de GitHub → **Add New → Project** → importa `stocko`.
2. En **Environment Variables** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon public key
3. Pulsa **Deploy**. Al terminar tendrás una URL como `https://stocko-xxxx.vercel.app`.

### 4. Conectar Supabase con tu dominio (importante)
En Supabase → **Authentication → URL Configuration**:
- **Site URL:** tu URL de Vercel (ej. `https://stocko-xxxx.vercel.app`)
- **Redirect URLs:** agrega `https://stocko-xxxx.vercel.app/**` (y tu dominio propio si lo conectas).

Sin esto, los enlaces de confirmación de correo y de recuperar contraseña no funcionarán.

### 5. Correos de confirmación
- Por defecto Supabase exige confirmar el correo. Su servicio de correo gratuito **limita a muy pocos mensajes por hora**.
- Para **probar rápido**: Authentication → Providers → Email → desactiva *Confirm email*.
- Para **producción**: configura un SMTP propio (Resend, Brevo, etc.) en Authentication → SMTP Settings y deja la confirmación activada.

---

## Uso de escáneres de código de barras

| Tipo de escáner | Cómo conectarlo | ¿Drivers? |
|---|---|---|
| USB o Bluetooth en modo teclado (HID) — **el más común** | Conéctalo y, en el punto de venta, escanea. El sistema detecta la velocidad de tecleo y lo distingue de una persona escribiendo. En el formulario de producto, haz clic en *Código de barras* y escanea. | No necesita |
| USB en modo puerto serie (COM / USB-CDC) | Instala el driver del fabricante si tu sistema no lo reconoce, y en el POS pulsa **Puerto serie** (Chrome/Edge en computadora). Baud rate por defecto: 9600. | Sí, a veces |
| Cámara del celular o laptop | Botón **Cámara** (requiere HTTPS, que Vercel ya incluye). | No |

Consejo: configura el escáner para que termine cada lectura con **Enter** (es lo habitual). También se acepta **Tab**.

### Extender con otros escáneres
Todo el soporte está aislado en `src/lib/scanner/` y `src/components/camera-scanner.tsx`. Cada fuente de escaneo solo debe llamar a una función `onScan(codigo: string)`. Para agregar una nueva (por ejemplo WebUSB o WebHID), crea un archivo junto a `serial.ts` que cumpla ese contrato y conéctalo en `src/components/pos-client.tsx`, donde ya se usa `handleCode`.

---

## Estructura del proyecto

```
supabase/schema.sql          Base de datos completa: tablas, seguridad (RLS), funciones de venta/stock/reportes
src/middleware.ts            Protege rutas y refresca la sesión
src/lib/countries.ts         País → moneda, impuesto y formato sugeridos (agrega aquí más países)
src/lib/scanner/             Escáneres (teclado/HID, puerto serie)
src/app/(auth)/              Login, registro, recuperar contraseña
src/app/onboarding/          Crear negocio (auto-detección de país) o unirse con código
src/app/(app)/               Dashboard, POS, productos, clientes, ventas, reportes, configuración
src/components/              Componentes de interfaz y clientes interactivos
```

### Seguridad
- Cada tabla tiene **Row Level Security**: un usuario solo puede leer/escribir datos de los negocios a los que pertenece.
- Las ventas, el descuento de stock, las anulaciones y los reportes se ejecutan en **funciones de la base de datos** (`create_sale`, `void_sale`, `adjust_stock`, `report_summary`). El precio y el stock se toman de la base de datos, nunca del navegador.
- La `anon key` es pública por diseño; la protección real es RLS. **Nunca** publiques la `service_role key`.

## Desarrollo local (opcional)
```bash
npm install
cp .env.example .env.local   # y completa las dos variables
npm run dev
```

## Ideas para siguientes versiones
Importar/exportar productos por CSV, compras a proveedores, múltiples sucursales, cierre de caja, ventas a crédito, etiquetas con códigos de barras, inicio de sesión con Google, modo sin conexión (PWA) y facturación fiscal electrónica según cada país.
