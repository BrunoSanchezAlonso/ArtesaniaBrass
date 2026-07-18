-- Método de pago y confirmación manual (Bizum / transferencia)

alter table public.pedidos
    alter column stripe_session_id drop not null;

alter table public.pedidos
    add column if not exists metodo_pago text not null default 'tarjeta';

alter table public.pedidos
    add column if not exists pago_confirmado boolean not null default false;

alter table public.pedidos
    drop constraint if exists pedidos_metodo_pago_check;

alter table public.pedidos
    add constraint pedidos_metodo_pago_check
    check (metodo_pago in ('tarjeta', 'bizum', 'transferencia'));

-- Pedidos Stripe existentes: tarjeta y ya confirmados
update public.pedidos
set
    metodo_pago = coalesce(nullif(metodo_pago, ''), 'tarjeta'),
    pago_confirmado = true
where stripe_session_id is not null;

create index if not exists pedidos_pago_confirmado_idx
    on public.pedidos (pago_confirmado, created_at desc);

drop policy if exists "Admins pueden actualizar pedidos" on public.pedidos;

create policy "Admins pueden actualizar pedidos"
    on public.pedidos
    for update
    to authenticated
    using (true)
    with check (true);
