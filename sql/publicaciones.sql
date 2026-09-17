create table publicaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  extracto text not null,
  imagen_url text,
  enlace text,
  created_at timestamptz not null default now()
);

create index publicaciones_created_at_idx on publicaciones (created_at desc);
