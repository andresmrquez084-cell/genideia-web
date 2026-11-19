-- Inscripciones de Genideia Academy (1 a 1 y grupal).
-- La tabla y la carpeta de archivos son privadas: solo las toca la función
-- academy-enrollment con la clave de servicio. El público no puede leer ni escribir.

create extension if not exists pgcrypto;

create table if not exists public.academy_enrollments (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  service_type       text not null check (service_type in ('grupal', '1a1')),
  full_name          text not null check (char_length(full_name) between 2 and 160),
  document_number    text not null check (char_length(document_number) between 3 and 40),
  country            text not null check (char_length(country) between 2 and 80),
  city               text not null check (char_length(city) between 2 and 80),
  address            text not null check (char_length(address) between 3 and 200),
  email              text not null check (char_length(email) <= 160),
  whatsapp           text not null check (char_length(whatsapp) between 6 and 40),
  contract_accepted  boolean not null default false,
  signature_path     text,
  client_token_hash  text not null,
  payment_method     text check (payment_method in ('payoneer', 'transfer')),
  proof_path         text,
  status             text not null default 'pendiente_pago'
                     check (status in ('pendiente_pago', 'comprobante_enviado', 'pagado', 'cancelado'))
);

create index if not exists academy_enrollments_created_idx on public.academy_enrollments (created_at desc);
create index if not exists academy_enrollments_email_idx on public.academy_enrollments (lower(email));

alter table public.academy_enrollments enable row level security;
-- Sin políticas: anon y authenticated no tienen acceso. La función usa service_role.
revoke all on public.academy_enrollments from anon, authenticated;

create or replace function public.academy_enrollments_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists academy_enrollments_touch on public.academy_enrollments;
create trigger academy_enrollments_touch before update on public.academy_enrollments
  for each row execute function public.academy_enrollments_touch();

-- Carpeta privada para firmas y comprobantes (máx. 8 MB por archivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-enrollments', 'academy-enrollments', false, 8388608,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
