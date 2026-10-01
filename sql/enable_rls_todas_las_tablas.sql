-- Activa Row-Level Security en todas las tablas del proyecto.
-- El backend usa SUPABASE_SECRET_KEY (service role), que siempre ignora RLS,
-- así que esto no requiere políticas nuevas ni cambia el comportamiento de la app:
-- solo bloquea el acceso directo con la URL del proyecto desde afuera.

alter table registros enable row level security;
alter table pilar_ciudades enable row level security;
alter table puntos_servicio enable row level security;
alter table publicaciones enable row level security;
alter table lectio_servicio enable row level security;
alter table cio_clientes enable row level security;
alter table cio_proyectos enable row level security;
alter table cio_productos enable row level security;
alter table cio_items_facturacion enable row level security;
alter table cio_registros_tiempo enable row level security;
alter table providentes enable row level security;
alter table ingresos enable row level security;
alter table egresos enable row level security;
alter table saldos_iniciales enable row level security;
alter table reportes_donacion enable row level security;
alter table config_ciudad enable row level security;
alter table evaluaciones_pilar enable row level security;
