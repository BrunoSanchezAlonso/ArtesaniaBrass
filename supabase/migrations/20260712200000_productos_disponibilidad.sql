-- Disponibilidad del producto: en stock o hecho bajo demanda

alter table public.productos
    add column if not exists disponibilidad text not null default 'stock'
    check (disponibilidad in ('stock', 'bajo_demanda'));
