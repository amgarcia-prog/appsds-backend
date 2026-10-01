create table ciudad_contenido (
  ciudad text primary key,
  subtitulo text,
  historia text,
  historia_fotos text[] not null default '{}',
  actualizado_por uuid references registros(id),
  updated_at timestamptz not null default now()
);

create table ciudad_servicios (
  id uuid primary key default gen_random_uuid(),
  ciudad text not null,
  punto_servicio_id uuid references puntos_servicio(id) on delete set null,
  nombre text not null,
  horario text,
  descripcion text,
  direccion text,
  telefono text,
  fotos text[] not null default '{}',
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index ciudad_servicios_ciudad_idx on ciudad_servicios (ciudad);

alter table ciudad_contenido enable row level security;
alter table ciudad_servicios enable row level security;
