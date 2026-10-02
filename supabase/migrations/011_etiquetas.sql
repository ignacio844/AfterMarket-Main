begin;

-- Biblioteca compartida. Sólo el servidor accede después de comprobar Google OAuth.
create table if not exists portal_aftermarket.etiquetas_folders (
  id uuid primary key,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  description text not null default '' check (char_length(description) <= 500),
  created_by text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists etiquetas_folders_name_idx
  on portal_aftermarket.etiquetas_folders (lower(btrim(name))) where is_active;
alter table portal_aftermarket.etiquetas_folders enable row level security;
revoke all on portal_aftermarket.etiquetas_folders from public, anon, authenticated;
grant select, insert, update on portal_aftermarket.etiquetas_folders to service_role;

create table if not exists portal_aftermarket.etiquetas_files (
  id uuid primary key,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  description text not null default '' check (char_length(description) <= 500),
  file_name text not null check (char_length(file_name) between 1 and 240),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 4194304),
  created_by text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  folder_id uuid references portal_aftermarket.etiquetas_folders (id) on delete restrict
);

create index if not exists etiquetas_files_created_at_idx
  on portal_aftermarket.etiquetas_files (created_at desc);
create index if not exists etiquetas_files_folder_idx
  on portal_aftermarket.etiquetas_files (folder_id) where is_active;

alter table portal_aftermarket.etiquetas_files enable row level security;
revoke all on portal_aftermarket.etiquetas_files from public, anon, authenticated;
grant select, insert, update on portal_aftermarket.etiquetas_files to service_role;

-- Serializa la asignación y el retiro de carpetas para evitar perder accesos
-- cuando dos administradores trabajan a la vez.
create or replace function portal_aftermarket.etiquetas_check_folder()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.folder_id is not null and new.is_active then
    perform 1 from portal_aftermarket.etiquetas_folders
      where id = new.folder_id and is_active for share;
    if not found then raise exception 'Carpeta no disponible'; end if;
  end if;
  return new;
end;
$$;

create or replace trigger etiquetas_files_check_folder
  before insert or update of folder_id, is_active on portal_aftermarket.etiquetas_files
  for each row execute function portal_aftermarket.etiquetas_check_folder();

create or replace function portal_aftermarket.etiquetas_archive_folder(folder_id uuid)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from portal_aftermarket.etiquetas_folders where id = folder_id and is_active for update;
  if not found then return false; end if;
  if exists (select 1 from portal_aftermarket.etiquetas_files f where f.folder_id = etiquetas_archive_folder.folder_id and f.is_active) then
    raise exception 'La carpeta contiene archivos';
  end if;
  update portal_aftermarket.etiquetas_folders set is_active = false, updated_at = now() where id = folder_id;
  return true;
end;
$$;

revoke all on function portal_aftermarket.etiquetas_check_folder() from public, anon, authenticated;
revoke all on function portal_aftermarket.etiquetas_archive_folder(uuid) from public, anon, authenticated;
grant execute on function portal_aftermarket.etiquetas_check_folder() to service_role;
grant execute on function portal_aftermarket.etiquetas_archive_folder(uuid) to service_role;

-- Sin URLs públicas ni permisos de Storage para el navegador.
insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-etiquetas', 'portal-etiquetas', false, 4194304)
on conflict (id) do nothing;

commit;
