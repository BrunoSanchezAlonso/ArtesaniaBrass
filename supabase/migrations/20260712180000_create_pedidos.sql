-- Tablas de pedidos para ArtesaniaBrass

create table if not exists public.pedidos (
    id bigint generated always as identity primary key,
    stripe_session_id text unique not null,
    stripe_payment_intent_id text,
    customer_email text,
    customer_name text,
    shipping_address jsonb,
    total_amount numeric(10, 2) not null,
    currency text not null default 'eur',
    status text not null default 'pagado',
    email_enviado boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.pedido_items (
    id bigint generated always as identity primary key,
    pedido_id bigint not null references public.pedidos (id) on delete cascade,
    nombre text not null,
    precio_unitario numeric(10, 2) not null,
    cantidad integer not null default 1 check (cantidad > 0)
);

create index if not exists pedidos_created_at_idx on public.pedidos (created_at desc);
create index if not exists pedido_items_pedido_id_idx on public.pedido_items (pedido_id);

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

create policy "Admins pueden leer pedidos"
    on public.pedidos
    for select
    to authenticated
    using (true);

create policy "Admins pueden leer lineas de pedido"
    on public.pedido_items
    for select
    to authenticated
    using (true);
