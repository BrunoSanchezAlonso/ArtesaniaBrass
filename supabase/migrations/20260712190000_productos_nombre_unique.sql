-- Evitar productos con el mismo nombre (sin distinguir mayúsculas/minúsculas)

create unique index if not exists productos_nombre_unique_idx
    on public.productos (lower(trim(nombre)));
