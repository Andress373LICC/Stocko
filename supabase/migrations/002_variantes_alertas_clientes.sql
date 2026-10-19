-- =====================================================================
--  STOCKERY · Migración 002 — Variantes, alertas de stock y catálogo agrupado
--  Para quienes YA instalaron la versión anterior: ejecútala UNA vez en
--  Supabase → SQL Editor. No borra ni modifica tus datos existentes.
-- =====================================================================

-- ---------- PRODUCTOS CON VARIANTES (matriz + variantes) ----------
create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  option_names text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists product_groups_biz_idx on public.product_groups (business_id, name);

alter table public.products add column if not exists group_id uuid references public.product_groups(id) on delete cascade;
alter table public.products add column if not exists variant_label text;
alter table public.products add column if not exists options jsonb not null default '{}'::jsonb;
create index if not exists products_group_idx on public.products (group_id);

-- Indicador de stock bajo/agotado (permite filtrar rápido en la lista)
alter table public.products add column if not exists is_low boolean
  generated always as (track_stock and stock <= min_stock) stored;
create index if not exists products_low_idx on public.products (business_id) where is_low;

alter table public.product_groups enable row level security;
create policy product_groups_select on public.product_groups for select to authenticated using (public.is_member(business_id));
create policy product_groups_write on public.product_groups for all to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));

-- Al editar la matriz, sus variantes heredan nombre, categoría e imagen
create or replace function public.sync_group_to_variants() returns trigger language plpgsql as $$
begin
  update public.products set name = new.name, category_id = new.category_id, image_url = new.image_url
  where group_id = new.id;
  return new;
end $$;
drop trigger if exists product_groups_sync on public.product_groups;
create trigger product_groups_sync after update of name, category_id, image_url on public.product_groups
  for each row execute function public.sync_group_to_variants();

-- ---------- VENTA: el nombre guardado incluye la variante ----------
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
      raise exception 'Stock insuficiente para "%" (disponible: %)',
        prod.name || coalesce(' · ' || prod.variant_label, ''), prod.stock;
    end if;
    v_gross := v_gross + prod.price * r.quantity;
  end loop;

  if v_discount < 0 or v_discount > v_gross then raise exception 'Descuento inválido'; end if;

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

  for r in
    select x.product_id, sum(x.quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    group by x.product_id
  loop
    select * into prod from products where id = r.product_id;
    insert into sale_items (sale_id, business_id, product_id, name, sku, quantity, unit_price, unit_cost, line_total)
    values (v_sale_id, p_business_id, prod.id, prod.name || coalesce(' · ' || prod.variant_label, ''), prod.sku,
            r.quantity, prod.price, prod.cost, prod.price * r.quantity);
    if prod.track_stock then
      update products set stock = stock - r.quantity where id = prod.id;
      insert into stock_movements (business_id, product_id, quantity, reason, sale_id, user_id)
      values (p_business_id, prod.id, -r.quantity, 'sale', v_sale_id, auth.uid());
    end if;
  end loop;

  return v_sale_id;
end $$;

-- ---------- GUARDAR PRODUCTO CON VARIANTES (atómico) ----------
create or replace function public.save_product_group(p_business_id uuid, p_group_id uuid, p_group jsonb, p_variants jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g_id uuid; v jsonb; v_id uuid; old_stock int; new_stock int; keep uuid[] := '{}';
  gname text; gcat uuid; gimg text; v_track boolean; v_sku text; v_label text;
begin
  if not is_admin(p_business_id) then raise exception 'No autorizado'; end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'Agrega al menos una variante';
  end if;
  gname := trim(coalesce(p_group->>'name', ''));
  if gname = '' then raise exception 'El nombre es obligatorio'; end if;
  gcat := nullif(p_group->>'category_id', '')::uuid;
  gimg := nullif(p_group->>'image_url', '');

  if p_group_id is null then
    insert into product_groups (business_id, name, description, category_id, image_url, option_names)
    values (p_business_id, gname, nullif(trim(coalesce(p_group->>'description','')), ''), gcat, gimg,
            coalesce(array(select jsonb_array_elements_text(coalesce(p_group->'option_names', '[]'::jsonb))), '{}'))
    returning id into g_id;
  else
    update product_groups set name = gname, description = nullif(trim(coalesce(p_group->>'description','')), ''),
           category_id = gcat, image_url = gimg,
           option_names = coalesce(array(select jsonb_array_elements_text(coalesce(p_group->'option_names', '[]'::jsonb))), '{}')
    where id = p_group_id and business_id = p_business_id returning id into g_id;
    if g_id is null then raise exception 'Producto no encontrado'; end if;
  end if;

  for v in select * from jsonb_array_elements(p_variants) loop
    v_id := nullif(v->>'id', '')::uuid;
    new_stock := greatest(coalesce((v->>'stock')::int, 0), 0);
    v_track := coalesce((v->>'track_stock')::boolean, true);
    v_label := nullif(trim(coalesce(v->>'label', '')), '');
    v_sku := coalesce(nullif(trim(coalesce(v->>'sku', '')), ''), 'SKU-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)));

    if v_id is null then
      insert into products (business_id, group_id, category_id, image_url, name, variant_label, options, sku, barcode,
                            price, cost, stock, min_stock, track_stock)
      values (p_business_id, g_id, gcat, gimg, gname, v_label, coalesce(v->'options', '{}'::jsonb), v_sku,
              nullif(trim(coalesce(v->>'barcode', '')), ''), coalesce((v->>'price')::numeric, 0), coalesce((v->>'cost')::numeric, 0),
              case when v_track then new_stock else 0 end, coalesce((v->>'min_stock')::int, 0), v_track)
      returning id into v_id;
      if v_track and new_stock > 0 then
        insert into stock_movements (business_id, product_id, quantity, reason, user_id)
        values (p_business_id, v_id, new_stock, 'initial', auth.uid());
      end if;
    else
      select stock into old_stock from products where id = v_id and group_id = g_id and business_id = p_business_id for update;
      if not found then raise exception 'Variante no encontrada'; end if;
      update products set variant_label = v_label, options = coalesce(v->'options', '{}'::jsonb), sku = v_sku,
             barcode = nullif(trim(coalesce(v->>'barcode', '')), ''), price = coalesce((v->>'price')::numeric, 0),
             cost = coalesce((v->>'cost')::numeric, 0), min_stock = coalesce((v->>'min_stock')::int, 0),
             track_stock = v_track, active = coalesce((v->>'active')::boolean, true)
      where id = v_id;
      if v_track and new_stock <> old_stock then
        update products set stock = new_stock where id = v_id;
        insert into stock_movements (business_id, product_id, quantity, reason, user_id)
        values (p_business_id, v_id, new_stock - old_stock, 'adjustment', auth.uid());
      end if;
    end if;
    keep := keep || v_id;
  end loop;

  delete from products where group_id = g_id and not (id = any(keep));
  return g_id;
end $$;

create or replace function public.delete_product_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  select business_id into b from product_groups where id = p_group_id;
  if b is null then raise exception 'Producto no encontrado'; end if;
  if not is_admin(b) then raise exception 'No autorizado'; end if;
  delete from product_groups where id = p_group_id;
end $$;

-- ---------- CATÁLOGO AGRUPADO (las variantes se muestran en una sola fila) ----------
create or replace function public.list_catalog(
  p_business_id uuid, p_q text default null, p_category uuid default null, p_stock text default null,
  p_limit int default 25, p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb; qn text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not is_admin(p_business_id) then raise exception 'No autorizado'; end if;
  with items as (
    select p.id, 'product'::text as kind, p.name, p.sku, p.barcode, p.category_id,
           p.price as price_min, p.price as price_max, p.stock::int as stock, p.track_stock as track,
           1 as variants, p.image_url, p.active,
           (p.track_stock and p.stock <= 0) as is_out,
           (p.track_stock and p.stock > 0 and p.stock <= p.min_stock) as is_low
    from products p where p.business_id = p_business_id and p.group_id is null
    union all
    select g.id, 'group', g.name, null, null, g.category_id,
           min(p.price), max(p.price), coalesce(sum(p.stock) filter (where p.track_stock), 0)::int, bool_or(p.track_stock),
           count(p.id)::int, g.image_url, g.active,
           coalesce(bool_or(p.track_stock and p.stock <= 0), false),
           coalesce(bool_or(p.track_stock and p.stock > 0 and p.stock <= p.min_stock), false)
    from product_groups g join products p on p.group_id = g.id
    where g.business_id = p_business_id group by g.id
  ), filtered as (
    select i.* from items i
    where (p_category is null or i.category_id = p_category)
      and (qn is null
           or i.name ilike '%' || qn || '%'
           or (i.kind = 'product' and (i.sku ilike '%' || qn || '%' or i.barcode ilike '%' || qn || '%'))
           or (i.kind = 'group' and exists (select 1 from products v where v.group_id = i.id and
                 (v.sku ilike '%' || qn || '%' or v.barcode ilike '%' || qn || '%' or v.variant_label ilike '%' || qn || '%'))))
      and (p_stock is null or p_stock = ''
           or (p_stock = 'out' and i.is_out)
           or (p_stock = 'low' and i.is_low))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(to_jsonb(f)) from (select * from filtered order by name limit p_limit offset p_offset) f), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------- DASHBOARD: incluye variante y conteo de agotados ----------
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
    'low_stock_count', (select count(*) from products where business_id = p_business_id and active and is_low),
    'out_count', (select count(*) from products where business_id = p_business_id and active and track_stock and stock <= 0),
    'low_stock', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from (
        select id, name || coalesce(' · ' || variant_label, '') as name, stock, min_stock, group_id from products
        where business_id = p_business_id and active and is_low
        order by stock asc limit 6) l)
  ) into res;
  return res;
end $$;

-- ---------- PERMISOS ----------
revoke all on function public.save_product_group(uuid,uuid,jsonb,jsonb) from public, anon;
revoke all on function public.delete_product_group(uuid) from public, anon;
revoke all on function public.list_catalog(uuid,text,uuid,text,int,int) from public, anon;
revoke all on function public.sync_group_to_variants() from public, anon, authenticated;
grant execute on function public.save_product_group(uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.delete_product_group(uuid) to authenticated;
grant execute on function public.list_catalog(uuid,text,uuid,text,int,int) to authenticated;
