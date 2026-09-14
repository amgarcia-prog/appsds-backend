create table reportes_donacion (
  id uuid primary key default gen_random_uuid(),
  ciudad text not null,
  nombre_donante text not null,
  telefono text,
  valor numeric not null,
  comentario text,
  atendido boolean not null default false,
  created_at timestamptz not null default now()
);

create index reportes_donacion_ciudad_idx on reportes_donacion (ciudad, atendido);
