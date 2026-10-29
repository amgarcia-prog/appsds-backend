alter table registros add column if not exists reset_token text;
alter table registros add column if not exists reset_token_expira timestamptz;

create index if not exists registros_reset_token_idx on registros (reset_token);
