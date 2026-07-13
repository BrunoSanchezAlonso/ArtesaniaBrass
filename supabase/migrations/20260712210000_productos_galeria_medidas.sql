-- Medidas opcionales y galería de imágenes adicionales

alter table public.productos
    add column if not exists medidas text;

alter table public.productos
    add column if not exists imagenes_extra jsonb not null default '[]'::jsonb;
