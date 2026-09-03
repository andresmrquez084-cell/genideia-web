insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('genideia-videos', 'genideia-videos', true, 1073741824, array['video/mp4']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.gen_site_media (
  slot text primary key,
  storage_path text not null,
  public_url text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.gen_site_media enable row level security;

drop policy if exists gen_site_media_admin_all on public.gen_site_media;
create policy gen_site_media_admin_all
on public.gen_site_media
for all
to authenticated
using (public.gen_hub_is_admin())
with check (public.gen_hub_is_admin());

drop policy if exists admins_select_genideia_videos on storage.objects;
create policy admins_select_genideia_videos
on storage.objects
for select
to authenticated
using (bucket_id = 'genideia-videos' and public.gen_hub_is_admin());

drop policy if exists admins_upload_genideia_videos on storage.objects;
create policy admins_upload_genideia_videos
on storage.objects
for insert
to authenticated
with check (bucket_id = 'genideia-videos' and public.gen_hub_is_admin());

drop policy if exists admins_update_genideia_videos on storage.objects;
create policy admins_update_genideia_videos
on storage.objects
for update
to authenticated
using (bucket_id = 'genideia-videos' and public.gen_hub_is_admin())
with check (bucket_id = 'genideia-videos' and public.gen_hub_is_admin());

drop policy if exists admins_delete_genideia_videos on storage.objects;
create policy admins_delete_genideia_videos
on storage.objects
for delete
to authenticated
using (bucket_id = 'genideia-videos' and public.gen_hub_is_admin());

create or replace function public.gen_hub_profile_default_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'client' and coalesce(btrim(new.video_url), '') = '' then
    select m.public_url
      into new.video_url
      from public.gen_site_media m
     where m.slot = 'onboarding.default';
  end if;
  return new;
end;
$$;

drop trigger if exists gen_hub_profiles_default_video on public.gen_hub_profiles;
create trigger gen_hub_profiles_default_video
before insert on public.gen_hub_profiles
for each row
execute function public.gen_hub_profile_default_video();

create or replace function public.gen_hub_set_default_onboarding_video(p_url text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if not public.gen_hub_is_admin() then
    raise exception 'admin_required';
  end if;
  if p_url is null or btrim(p_url) = '' then
    raise exception 'video_url_required';
  end if;

  update public.gen_hub_profiles
     set video_url = p_url
   where role = 'client'
     and coalesce(btrim(video_url), '') = '';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.gen_hub_set_default_onboarding_video(text) from public;
grant execute on function public.gen_hub_set_default_onboarding_video(text) to authenticated;
