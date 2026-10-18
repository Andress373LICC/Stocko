-- =====================================================================
--  STOCKO · Esquema completo de base de datos (Supabase / PostgreSQL)
--  Ejecuta este archivo UNA SOLA VEZ en: Supabase → SQL Editor → New query
-- =====================================================================

-- ---------- PERFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- NEGOCIOS (cada cuenta crea el suyo) ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null default 'US',
  currency_code text not null default 'USD',
  locale text not null default 'en-US',
  timezone text not null default 'UTC',
  tax_name text not null default 'IVA',
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  prices_include_tax boolean not null default true,
  tax_id text,
  address text,
  phone text,
  receipt_footer text default '¡Gracias por su compra!',
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  next_sale_number integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'cashier')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

-- ---------- FUNCIONES AUXILIARES DE PERMISOS ----------
create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where business_id = b and user_id = auth.uid())
$$;

create or replace function public.is_admin(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where business_id = b and user_id = auth.uid() and role in ('owner','admin'))
$$;

create or replace function public.is_owner(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where business_id = b and user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.shares_business(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships a join memberships c on a.business_id = c.business_id
    where a.user_id = auth.uid() and c.user_id = u
  )
$$;

-- ---------- CATÁLOGO ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  sku text not null,
  barcode text,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  stock integer not null default 0,
  min_stock integer not null default 5,
  track_stock boolean not null default true,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);
create unique index products_barcode_uidx on public.products (business_id, barcode) where barcode is not null;
create index products_name_idx on public.products (business_id, name);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  tax_id text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_biz_idx on public.customers (business_id, name);

-- ---------- VENTAS ----------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number integer not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  user_id uuid references public.profiles(id) on delete set null,
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null,
  total numeric(12,2) not null,
  payment_method text not null check (payment_method in ('cash','card','transfer','other')),
  amount_paid numeric(12,2) not null,
  change_given numeric(12,2) not null default 0,
  notes text,
  status text not null default 'completed' check (status in ('completed','voided')),
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, number)
);
create index sales_biz_date_idx on public.sales (business_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null,
  reason text not null,
  sale_id uuid references public.sales(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_mov_product_idx on public.stock_movements (product_id, created_at desc);

-- ---------- SEGURIDAD POR FILAS (RLS) ----------
alter table public.profiles        enable row level security;
alter table public.businesses      enable row level security;
alter table public.memberships     enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.customers       enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.stock_movements enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_business(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy businesses_select on public.businesses for select to authenticated using (public.is_member(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy memberships_select on public.memberships for select to authenticated using (public.is_member(business_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_owner(business_id) and user_id <> auth.uid())
  with check (public.is_owner(business_id) and user_id <> auth.uid() and role in ('admin','cashier'));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_owner(business_id) and user_id <> auth.uid());

create policy categories_select on public.categories for select to authenticated using (public.is_member(business_id));
create policy categories_write  on public.categories for all    to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));

create policy products_select on public.products for select to authenticated using (public.is_member(business_id));
create policy products_write  on public.products for all    to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));

create policy customers_select on public.customers for select to authenticated using (public.is_member(business_id));
create policy customers_write  on public.customers for all    to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

-- Ventas, items y movimientos: solo lectura directa. Se escriben únicamente con las funciones de abajo.
create policy sales_select      on public.sales           for select to authenticated using (public.is_member(business_id));
create policy sale_items_select on public.sale_items      for select to authenticated using (public.is_member(business_id));
create policy stock_mov_select  on public.stock_movements for select to authenticated using (public.is_member(business_id));

-- ---------- FUNCIONES DE NEGOCIO (atómicas y seguras) ----------
create or replace function public.create_business(
  p_name text, p_country_code text, p_currency_code text, p_locale text, p_timezone text,
  p_tax_name text, p_tax_rate numeric, p_prices_include_tax boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'El nombre del negocio es obligatorio'; end if;
  insert into businesses (name, country_code, currency_code, locale, timezone, tax_name, tax_rate, prices_include_tax)
  values (trim(p_name), upper(p_country_code), upper(p_currency_code), p_locale, p_timezone,
          coalesce(nullif(trim(p_tax_name),''),'IVA'), coalesce(p_tax_rate,0), coalesce(p_prices_include_tax,true))
  returning id into v_id;
  insert into memberships (business_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into categories (business_id, name) values (v_id, 'General');
  return v_id;
end $$;

create or replace function public.join_business(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select id into v_id from businesses where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'Código de invitación inválido'; end if;
  insert into memberships (business_id, user_id, role) values (v_id, auth.uid(), 'cashier')
  on conflict do nothing;
  return v_id;
end $$;

create or replace function public.regenerate_invite_code(p_business_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_owner(p_business_id) then raise exception 'No autorizado'; end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update businesses set invite_code = v_code where id = p_business_id;
  return v_code;
end $$;

create or replace function public.create_sale(
  p_business_id uuid, p_customer_id uuid, p_items jsonb, p_payment_method text,
  p_amount_paid numeric, p_discount numeric default 0, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  b businesses%rowtype;
  prod products%rowtype;
  r record;
  v_sale_id uuid := gen_random_uuid();
  v_number int;
  v_gross numeric := 0;
  v_discount numeric := round(coalesce(p_discount, 0), 2);
  v_subtotal numeric; v_tax numeric; v_total numeric; v_paid numeric; v_change numeric;
  v_customer_name text;
begin
  if not is_member(p_business_id) then raise exception 'No autorizado'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if p_payment_method not in ('cash','card','transfer','other') then raise exception 'Método de pago inválido'; end if;

  select * into b from businesses where id = p_business_id;

  -- 1) Validar productos y stock; calcular total bruto con los precios reales de la base de datos
  for r in
    select x.product_id, sum(x.quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    group by x.product_id
  loop
    if r.quantity is null or r.quantity <= 0 then raise exception 'Cantidad inválida'; end if;
    select * into prod from products
      where id = r.product_id and business_id = p_business_id and active for update;
    if not found then raise exception 'Un producto del carrito ya no está disponible'; end if;
    if prod.track_stock and prod.stock < r.quantity then
      raise exception 'Stock insuficiente para "%" (disponible: %)', prod.name, prod.stock;
    end if;
    v_gross := v_gross + prod.price * r.quantity;
  end loop;

  if v_discount < 0 or v_discount > v_gross then raise exception 'Descuento inválido'; end if;

  -- 2) Totales e impuestos
  if b.prices_include_tax then
    v_total    := round(v_gross - v_discount, 2);
    v_tax      := round(v_total - v_total / (1 + b.tax_rate / 100), 2);
    v_subtotal := v_total - v_tax;
  else
    v_subtotal := round(v_gross - v_discount, 2);
    v_tax      := round(v_subtotal * b.tax_rate / 100, 2);
    v_total    := v_subtotal + v_tax;
  end if;

  if p_payment_method = 'cash' then
    if p_amount_paid is null or p_amount_paid < v_total then raise exception 'El monto recibido es menor al total'; end if;
    v_paid := p_amount_paid; v_change := round(p_amount_paid - v_total, 2);
  else
    v_paid := v_total; v_change := 0;
  end if;

  if p_customer_id is not null then
    select name into v_customer_name from customers where id = p_customer_id and business_id = p_business_id;
    if v_customer_name is null then raise exception 'Cliente inválido'; end if;
  end if;

  update businesses set next_sale_number = next_sale_number + 1
    where id = p_business_id returning next_sale_number - 1 into v_number;

  insert into sales (id, business_id, number, customer_id, customer_name, user_id, subtotal, discount, tax, total,
                     payment_method, amount_paid, change_given, notes)
  values (v_sale_id, p_business_id, v_number, p_customer_id, v_customer_name, auth.uid(), v_subtotal, v_discount, v_tax,
          v_total, p_payment_method, v_paid, v_change, nullif(trim(coalesce(p_notes,'')), ''));

  -- 3) Líneas de venta, descuento de stock y movimientos
  for r in
    select x.product_id, sum(x.quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    group by x.product_id
  loop
    select * into prod from products where id = r.product_id;
    insert into sale_items (sale_id, business_id, product_id, name, sku, quantity, unit_price, unit_cost, line_total)
    values (v_sale_id, p_business_id, prod.id, prod.name, prod.sku, r.quantity, prod.price, prod.cost, prod.price * r.quantity);
    if prod.track_stock then
      update products set stock = stock - r.quantity where id = prod.id;
      insert into stock_movements (business_id, product_id, quantity, reason, sale_id, user_id)
      values (p_business_id, prod.id, -r.quantity, 'sale', v_sale_id, auth.uid());
    end if;
  end loop;

  return v_sale_id;
end $$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; it record;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if not is_admin(s.business_id) then raise exception 'No autorizado'; end if;
  if s.status = 'voided' then raise exception 'La venta ya fue anulada'; end if;
  for it in select si.product_id, si.quantity from sale_items si where si.sale_id = p_sale_id and si.product_id is not null loop
    update products set stock = stock + it.quantity where id = it.product_id and track_stock;
    if found then
      insert into stock_movements (business_id, product_id, quantity, reason, sale_id, user_id)
      values (s.business_id, it.product_id, it.quantity, 'void', p_sale_id, auth.uid());
    end if;
  end loop;
  update sales set status = 'voided', voided_at = now(), void_reason = nullif(trim(coalesce(p_reason,'')), '')
    where id = p_sale_id;
end $$;

create or replace function public.adjust_stock(p_product_id uuid, p_delta int, p_reason text default 'adjustment') returns int
language plpgsql security definer set search_path = public as $$
declare prod products%rowtype;
begin
  select * into prod from products where id = p_product_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if not is_admin(prod.business_id) then raise exception 'No autorizado'; end if;
  if prod.stock + p_delta < 0 then raise exception 'El stock no puede quedar negativo'; end if;
  update products set stock = stock + p_delta where id = p_product_id;
  insert into stock_movements (business_id, product_id, quantity, reason, user_id)
  values (prod.business_id, p_product_id, p_delta, coalesce(nullif(trim(p_reason),''), 'adjustment'), auth.uid());
  return prod.stock + p_delta;
end $$;

-- ---------- REPORTES (calculados en la base de datos) ----------
create or replace function public.report_summary(p_business_id uuid, p_from date, p_to date, p_tz text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t_from timestamptz; t_to timestamptz; res jsonb;
begin
  if not is_admin(p_business_id) then raise exception 'No autorizado'; end if;
  t_from := p_from::timestamp at time zone p_tz;
  t_to   := (p_to + 1)::timestamp at time zone p_tz;
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'revenue', coalesce(sum(total),0), 'net', coalesce(sum(subtotal),0), 'tax', coalesce(sum(tax),0),
        'discount', coalesce(sum(discount),0), 'count', count(*))
      from sales where business_id = p_business_id and status = 'completed' and created_at >= t_from and created_at < t_to),
    'cost', (select coalesce(sum(si.unit_cost * si.quantity),0)
      from sale_items si join sales s on s.id = si.sale_id
      where s.business_id = p_business_id and s.status = 'completed' and s.created_at >= t_from and s.created_at < t_to),
    'voided', (select count(*) from sales where business_id = p_business_id and status = 'voided' and created_at >= t_from and created_at < t_to),
    'daily', (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb) from (
        select to_char(created_at at time zone p_tz, 'YYYY-MM-DD') as day, sum(total) as total, count(*) as count
        from sales where business_id = p_business_id and status = 'completed' and created_at >= t_from and created_at < t_to
        group by 1) d),
    'top_products', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from (
        select si.name, sum(si.quantity)::int as quantity, sum(si.line_total) as revenue
        from sale_items si join sales s on s.id = si.sale_id
        where s.business_id = p_business_id and s.status = 'completed' and s.created_at >= t_from and s.created_at < t_to
        group by si.name order by sum(si.line_total) desc limit 10) p),
    'by_payment', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (
        select payment_method as method, sum(total) as total, count(*) as count
        from sales where business_id = p_business_id and status = 'completed' and created_at >= t_from and created_at < t_to
        group by payment_method order by sum(total) desc) m),
    'by_user', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from (
        select coalesce(nullif(pr.full_name,''), pr.email, 'Desconocido') as name, sum(s.total) as total, count(*) as count
        from sales s left join profiles pr on pr.id = s.user_id
        where s.business_id = p_business_id and s.status = 'completed' and s.created_at >= t_from and s.created_at < t_to
        group by 1 order by sum(s.total) desc) u)
  ) into res;
  return res;
end $$;

create or replace function public.dashboard_summary(p_business_id uuid, p_tz text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t_today timestamptz; res jsonb;
begin
  if not is_admin(p_business_id) then raise exception 'No autorizado'; end if;
  t_today := date_trunc('day', now() at time zone p_tz) at time zone p_tz;
  select jsonb_build_object(
    'today', (select jsonb_build_object('revenue', coalesce(sum(total),0), 'count', count(*))
      from sales where business_id = p_business_id and status = 'completed' and created_at >= t_today),
    'daily', (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb) from (
        select to_char(created_at at time zone p_tz, 'YYYY-MM-DD') as day, sum(total) as total
        from sales where business_id = p_business_id and status = 'completed' and created_at >= t_today - interval '6 days'
        group by 1) d),
    'products_count', (select count(*) from products where business_id = p_business_id and active),
    'customers_count', (select count(*) from customers where business_id = p_business_id),
    'low_stock_count', (select count(*) from products where business_id = p_business_id and active and track_stock and stock <= min_stock),
    'low_stock', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from (
        select id, name, stock, min_stock from products
        where business_id = p_business_id and active and track_stock and stock <= min_stock
        order by stock asc limit 6) l)
  ) into res;
  return res;
end $$;

-- ---------- PERMISOS DE EJECUCIÓN ----------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_business(text,text,text,text,text,text,numeric,boolean) from public, anon;
revoke all on function public.join_business(text) from public, anon;
revoke all on function public.regenerate_invite_code(uuid) from public, anon;
revoke all on function public.create_sale(uuid,uuid,jsonb,text,numeric,numeric,text) from public, anon;
revoke all on function public.void_sale(uuid,text) from public, anon;
revoke all on function public.adjust_stock(uuid,int,text) from public, anon;
revoke all on function public.report_summary(uuid,date,date,text) from public, anon;
revoke all on function public.dashboard_summary(uuid,text) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.is_owner(uuid) from public, anon;
revoke all on function public.shares_business(uuid) from public, anon;
grant execute on function public.create_business(text,text,text,text,text,text,numeric,boolean) to authenticated;
grant execute on function public.join_business(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.create_sale(uuid,uuid,jsonb,text,numeric,numeric,text) to authenticated;
grant execute on function public.void_sale(uuid,text) to authenticated;
grant execute on function public.adjust_stock(uuid,int,text) to authenticated;
grant execute on function public.report_summary(uuid,date,date,text) to authenticated;
grant execute on function public.dashboard_summary(uuid,text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.shares_business(uuid) to authenticated;

-- ---------- ALMACENAMIENTO DE IMÁGENES ----------
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "product_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin(((storage.foldername(name))[1])::uuid));
