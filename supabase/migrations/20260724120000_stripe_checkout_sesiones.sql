-- Registro de sesiones Stripe ya cumplidas.
-- Sobrevive al borrar filas de pedidos para no reimportar ni reenviar emails.

create table if not exists public.stripe_checkout_sesiones (
    session_id text primary key,
    pedido_id bigint,
    created_at timestamptz not null default now()
);

alter table public.stripe_checkout_sesiones enable row level security;

-- Solo el service role (Edge Functions) escribe/lee; sin políticas para anon/auth.

insert into public.stripe_checkout_sesiones (session_id, pedido_id)
select stripe_session_id, id
from public.pedidos
where stripe_session_id is not null
on conflict (session_id) do nothing;
