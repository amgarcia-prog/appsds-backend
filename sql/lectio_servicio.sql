create table lectio_servicio (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  archivo_url text not null,
  created_at timestamptz not null default now()
);

create index lectio_servicio_created_at_idx on lectio_servicio (created_at desc);
