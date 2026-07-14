-- Orden de visualización en tienda y referencia de producto en pedidos

alter table public.productos
    add column if not exists orden integer not null default 0;

-- Productos recientes primero: menor orden = primero en la tienda
update public.productos
set orden = -id::integer;

alter table public.pedido_items
    add column if not exists producto_id bigint references public.productos (id) on delete set null;

create index if not exists productos_orden_idx on public.productos (orden asc);

create or replace function public.set_producto_orden_on_insert()
returns trigger
language plpgsql
as $$
begin
    select coalesce(min(orden), 0) - 1
    into new.orden
    from public.productos
    where id is distinct from new.id;

    return new;
end;
$$;

drop trigger if exists set_producto_orden_on_insert on public.productos;

create trigger set_producto_orden_on_insert
    before insert on public.productos
    for each row
    execute function public.set_producto_orden_on_insert();
