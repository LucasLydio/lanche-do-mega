create extension if not exists pgcrypto;

create table if not exists public.menu_categories (
  slug text primary key,
  name text not null,
  sort_order smallint not null default 0
);

create table if not exists public.menu_items (
  slug text primary key,
  category_slug text not null references public.menu_categories(slug),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_number text not null check (table_number ~ '^[[:alnum:]-]{1,12}$'),
  customer_name text check (char_length(customer_name) <= 60),
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'delivered')),
  total_cents integer not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_active_created_idx
  on public.orders (created_at asc)
  where status <> 'delivered';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id text not null references public.menu_items(slug),
  item_name_snapshot text not null,
  quantity smallint not null check (quantity between 1 and 20),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  notes text check (char_length(notes) <= 140),
  customizations jsonb not null default '{}'::jsonb
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.kitchen_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.menu_categories (slug, name, sort_order) values
  ('lanches', 'Lanches', 1),
  ('acompanhamentos', 'Acompanhamentos', 2),
  ('bebidas', 'Bebidas', 3),
  ('sobremesas', 'Sobremesas', 4),
  ('adicionais', 'Adicionais', 5)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.menu_items (slug, category_slug, name, description, price_cents) values
  ('mega-classico', 'lanches', 'Mega Clássico', 'Smash 160g, queijo prato, cebola na chapa e molho da casa.', 3290),
  ('duplo-bacon', 'lanches', 'Duplo Bacon', 'Dois smash, cheddar cremoso, bacon crocante e barbecue.', 3890),
  ('frango-crocante', 'lanches', 'Frango Crocante', 'Frango empanado, coleslaw fresquinha e maionese de limão.', 2990),
  ('veg-do-mega', 'lanches', 'Veg do Mega', 'Burger de grão-de-bico, queijo coalho e relish de pepino.', 3190),
  ('fritas-da-casa', 'acompanhamentos', 'Fritas da Casa', 'Porção individual com páprica e maionese temperada.', 1490),
  ('fritas-cheddar-bacon', 'acompanhamentos', 'Fritas Cheddar & Bacon', 'Fritas sequinhas, cheddar cremoso e bacon crocante.', 2290),
  ('limonada-da-casa', 'bebidas', 'Limonada da Casa', 'Limão espremido na hora, bem gelada. 400ml.', 990),
  ('cola-gelada', 'bebidas', 'Cola Gelada', 'Lata 350ml, servida bem gelada.', 790),
  ('brownie-quente', 'sobremesas', 'Brownie Quentinho', 'Brownie de chocolate com uma bola de sorvete de baunilha.', 1690),
  ('queijo-cheddar-extra', 'adicionais', 'Queijo cheddar', 'Uma camada extra de cheddar cremoso.', 450),
  ('bacon-extra', 'adicionais', 'Bacon crocante', 'Bacon em tiras, douradinho na chapa.', 550)
on conflict (slug) do update set
  category_slug = excluded.category_slug,
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  active = true;

create or replace function public.is_kitchen_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.kitchen_staff where user_id = auth.uid()
  );
$$;

create or replace function public.create_customer_order(
  p_table_number text,
  p_customer_name text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  item_data jsonb;
  menu_item public.menu_items%rowtype;
  add_on public.menu_items%rowtype;
  add_on_slug text;
  add_on_slugs jsonb;
  custom_input jsonb;
  custom_data jsonb;
  safe_notes text;
  item_quantity integer;
  unit_price integer;
  order_total integer := 0;
begin
  if p_table_number is null or p_table_number !~ '^[[:alnum:]-]{1,12}$' then
    raise exception 'Número de mesa inválido';
  end if;
  if char_length(coalesce(p_customer_name, '')) > 60 then
    raise exception 'Nome muito longo';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30 then
    raise exception 'Pedido inválido';
  end if;

  insert into public.orders (table_number, customer_name)
  values (p_table_number, nullif(trim(coalesce(p_customer_name, '')), ''))
  returning id into v_order_id;

  for item_data in select value from jsonb_array_elements(p_items) as line(value) loop
    if jsonb_typeof(item_data) is distinct from 'object' then
      raise exception 'Item inválido';
    end if;

    select * into menu_item
    from public.menu_items
    where slug = item_data->>'menu_item_id' and active = true;
    if not found then
      raise exception 'Item indisponível';
    end if;

    if coalesce(item_data->>'quantity', '') !~ '^[1-9][0-9]?$' then
      raise exception 'Quantidade inválida';
    end if;
    item_quantity := (item_data->>'quantity')::integer;
    if item_quantity > 20 then
      raise exception 'Quantidade inválida';
    end if;

    add_on_slugs := coalesce(item_data->'add_ons', '[]'::jsonb);
    if jsonb_typeof(add_on_slugs) is distinct from 'array' or jsonb_array_length(add_on_slugs) > 4 then
      raise exception 'Adicionais inválidos';
    end if;

    unit_price := menu_item.price_cents;
    for add_on_slug in select jsonb_array_elements_text(add_on_slugs) loop
      select * into add_on
      from public.menu_items
      where slug = add_on_slug and category_slug = 'adicionais' and active = true;
      if not found then
        raise exception 'Adicional indisponível';
      end if;
      unit_price := unit_price + add_on.price_cents;
    end loop;

    custom_input := coalesce(item_data->'customizations', '{}'::jsonb);
    if jsonb_typeof(custom_input) is distinct from 'object'
      or jsonb_typeof(coalesce(custom_input->'removedIngredients', '[]'::jsonb)) is distinct from 'array' then
      raise exception 'Personalização inválida';
    end if;
    custom_data := jsonb_build_object(
      'meatPoint', case when custom_input->>'meatPoint' in ('Ao ponto', 'Bem passado') then custom_input->>'meatPoint' else null end,
      'removedIngredients', coalesce(custom_input->'removedIngredients', '[]'::jsonb),
      'addOns', add_on_slugs
    );
    safe_notes := left(trim(coalesce(item_data->>'notes', '')), 140);

    insert into public.order_items (
      order_id, menu_item_id, item_name_snapshot, quantity,
      unit_price_cents, notes, customizations
    ) values (
      v_order_id, menu_item.slug, menu_item.name, item_quantity,
      unit_price, nullif(safe_notes, ''), custom_data
    );

    order_total := order_total + (unit_price * item_quantity);
  end loop;

  update public.orders set total_cents = order_total where id = v_order_id;
  return v_order_id;
end;
$$;

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.kitchen_staff enable row level security;

drop policy if exists "active categories are public" on public.menu_categories;
create policy "active categories are public"
  on public.menu_categories for select to anon, authenticated using (true);

drop policy if exists "active menu is public" on public.menu_items;
create policy "active menu is public"
  on public.menu_items for select to anon, authenticated using (active = true);

drop policy if exists "staff can read own membership" on public.kitchen_staff;
create policy "staff can read own membership"
  on public.kitchen_staff for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff can read orders" on public.orders;
create policy "staff can read orders"
  on public.orders for select to authenticated using (public.is_kitchen_staff());

drop policy if exists "staff can update order status" on public.orders;
create policy "staff can update order status"
  on public.orders for update to authenticated
  using (public.is_kitchen_staff())
  with check (public.is_kitchen_staff());

drop policy if exists "staff can read order items" on public.order_items;
create policy "staff can read order items"
  on public.order_items for select to authenticated using (public.is_kitchen_staff());

grant usage on schema public to anon, authenticated;
revoke all on table
  public.menu_categories, public.menu_items, public.orders,
  public.order_items, public.kitchen_staff
  from anon, authenticated;
grant select on public.menu_categories, public.menu_items to anon, authenticated;
grant select on public.kitchen_staff, public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;
revoke all on function public.is_kitchen_staff() from public;
grant execute on function public.is_kitchen_staff() to authenticated;
revoke all on function public.create_customer_order(text, text, jsonb) from public;
grant execute on function public.create_customer_order(text, text, jsonb) to anon, authenticated;

alter table public.orders replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end;
$$;