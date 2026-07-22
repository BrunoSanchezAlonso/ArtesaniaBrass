-- Solo cuentas listadas en store_admins pueden leer/actualizar pedidos

create table if not exists public.store_admins (
    email text primary key,
    created_at timestamptz not null default now()
);

alter table public.store_admins enable row level security;

drop policy if exists "Admins pueden leer store_admins" on public.store_admins;
-- Sin políticas de lectura/escritura para anon/authenticated:
-- solo service_role y la función security definer pueden usarla.

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated;
grant execute on function public.is_store_admin() to anon;

drop policy if exists "Admins pueden leer pedidos" on public.pedidos;
drop policy if exists "Admins pueden actualizar pedidos" on public.pedidos;
drop policy if exists "Admins pueden leer lineas de pedido" on public.pedido_items;

create policy "Admins pueden leer pedidos"
    on public.pedidos
    for select
    to authenticated
    using (public.is_store_admin());

create policy "Admins pueden actualizar pedidos"
    on public.pedidos
    for update
    to authenticated
    using (public.is_store_admin())
    with check (public.is_store_admin());

create policy "Admins pueden leer lineas de pedido"
    on public.pedido_items
    for select
    to authenticated
    using (public.is_store_admin());


