-- ============================================================
-- Arbeitsplatz-Buchung Risiko – komplettes Datenbank-Setup
--
-- Einmal komplett im SQL-Editor des NEUEN Supabase-Projekts ausführen.
-- Entspricht 1:1 dem Stand der Finance-App (Export vom 24.11.2026),
-- einzige Abweichung: gesperrter Platz ist "G3-3" (ganz unten links).
-- ============================================================


-- ------------------------------------------------------------
-- 1) Tabellen
-- ------------------------------------------------------------

-- Profile (Anzeigename + Admin-Kennzeichen)
create table public.profiles (
  id uuid not null,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);

-- Buchungen
create table public.bookings (
  id uuid not null default gen_random_uuid(),
  resource_id text not null,
  date date not null,
  start_time time without time zone,
  end_time time without time zone,
  name text not null,
  user_id uuid not null,
  series_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint bookings_pkey primary key (id),
  constraint bookings_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint chk_time_range check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  ),
  -- Dauerhaft gesperrter Platz: Gruppe 3, Platz 3 (ganz unten links)
  constraint chk_not_blocked check (resource_id <> 'G3-3')
);

-- Protokoll der Admin-Aktionen
create table public.admin_actions (
  id uuid not null default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,
  target_user_id uuid,
  target_name text,
  detail text,
  created_at timestamp with time zone not null default now(),
  constraint admin_actions_pkey primary key (id),
  constraint admin_actions_actor_id_fkey foreign key (actor_id) references auth.users (id) on delete set null,
  constraint admin_actions_target_user_id_fkey foreign key (target_user_id) references auth.users (id) on delete set null
);


-- ------------------------------------------------------------
-- 2) Indizes
-- ------------------------------------------------------------
create index idx_bookings_date on public.bookings using btree (date);
create index idx_bookings_series on public.bookings using btree (series_id);
create index idx_admin_actions_created on public.admin_actions using btree (created_at desc);

-- Ganztägige Buchungen: pro Tag und Platz nur EINE Buchung.
create unique index uniq_fullday_booking
  on public.bookings using btree (resource_id, date)
  where (start_time is null);

-- Nur EIN Platz pro Tag und Person.
create unique index uniq_one_fullday_booking_per_user
  on public.bookings using btree (user_id, date)
  where (start_time is null);


-- ------------------------------------------------------------
-- 3) Funktionen
-- ------------------------------------------------------------

-- Ist die Person Admin?
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$function$;

-- Profil bei Registrierung automatisch anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1),
        'Unbekannt'
      ),
      60
    )
  );
  return new;
end;
$function$;

-- Buchungsname immer serverseitig aus dem Profil setzen
create or replace function public.set_booking_name()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select left(coalesce(nullif(trim(p.display_name), ''), 'Unbekannt'), 60)
    into new.name
  from public.profiles p
  where p.id = new.user_id;

  if new.name is null or new.name = '' then
    new.name := 'Unbekannt';
  end if;
  return new;
end;
$function$;

-- Überschneidungsschutz für zeitbasierte Buchungen
-- (in dieser App ohne Besprechungsraum nicht genutzt, aber 1:1 übernommen)
create or replace function public.prevent_overlapping_bookings()
returns trigger
language plpgsql
as $function$
begin
  if new.start_time is not null then
    if exists (
      select 1 from public.bookings b
      where b.resource_id = new.resource_id
        and b.date = new.date
        and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and b.start_time is not null
        and (new.start_time, new.end_time) overlaps (b.start_time, b.end_time)
    ) then
      raise exception 'Zeitraum überschneidet sich mit einer bestehenden Buchung.';
    end if;
  end if;
  return new;
end;
$function$;

-- Admin-Kennzeichen schützen: nur Admins dürfen es ändern,
-- und der letzte Admin kann nicht entfernt werden.
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_is_admin boolean;
  admin_count int;
begin
  new.id := old.id;

  if new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null then
      select p.is_admin into caller_is_admin
      from public.profiles p
      where p.id = auth.uid();

      if coalesce(caller_is_admin, false) = false then
        new.is_admin := old.is_admin;
        return new;
      end if;
    end if;

    if old.is_admin = true and new.is_admin = false then
      perform 1 from public.profiles where is_admin = true for update;
      select count(*) into admin_count from public.profiles where is_admin = true;
      if admin_count <= 1 then
        raise exception 'Mindestens ein Admin muss bestehen bleiben. Bitte zuerst eine andere Person zum Admin machen.';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- Letzten Admin-Account nicht löschen lassen
create or replace function public.protect_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  admin_count int;
begin
  if old.is_admin = true then
    perform 1 from public.profiles where is_admin = true for update;
    select count(*) into admin_count from public.profiles where is_admin = true;
    if admin_count <= 1 then
      raise exception 'Der letzte Admin-Account kann nicht gelöscht werden. Bitte zuerst eine andere Person zum Admin machen.';
    end if;
  end if;
  return old;
end;
$function$;

-- Protokoll: Admin-Rechte vergeben/entzogen
create or replace function public.log_admin_flag_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.is_admin is distinct from old.is_admin then
    insert into public.admin_actions (actor_id, actor_name, action, target_user_id, target_name)
    select
      auth.uid(),
      (select display_name from public.profiles where id = auth.uid()),
      case when new.is_admin then 'grant_admin' else 'revoke_admin' end,
      new.id,
      new.display_name;
  end if;
  return new;
end;
$function$;

-- Protokoll: fremde Buchung storniert
create or replace function public.log_admin_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Nur protokollieren, wenn jemand eine FREMDE Buchung storniert hat.
  if auth.uid() is distinct from old.user_id then
    insert into public.admin_actions (actor_id, actor_name, action, target_user_id, target_name, detail)
    select
      auth.uid(),
      (select display_name from public.profiles where id = auth.uid()),
      'cancel_booking',
      old.user_id,
      old.name,
      old.resource_id || ' am ' || old.date::text ||
        case when old.start_time is not null
          then ' (' || to_char(old.start_time, 'HH24:MI') || '–' || to_char(old.end_time, 'HH24:MI') || ')'
          else ''
        end;
  end if;
  return old;
end;
$function$;

-- Admin: E-Mail-Adresse für Passwort-Reset holen (und protokollieren)
create or replace function public.admin_password_reset_email(target uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen das.';
  end if;

  select u.email into target_email from auth.users u where u.id = target;
  if target_email is null then
    raise exception 'Nutzer nicht gefunden.';
  end if;

  insert into public.admin_actions (actor_id, actor_name, action, target_user_id, target_name)
  select
    auth.uid(),
    (select display_name from public.profiles where id = auth.uid()),
    'password_reset',
    target,
    (select display_name from public.profiles where id = target);

  return target_email;
end;
$function$;

-- Rechte wie im Original: nur eingeloggte Nutzer dürfen die Reset-Funktion aufrufen
revoke execute on function public.admin_password_reset_email(uuid) from public, anon;
grant execute on function public.admin_password_reset_email(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4) Trigger
-- ------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_set_booking_name
  before insert or update on public.bookings
  for each row execute function public.set_booking_name();

create trigger trg_prevent_overlap
  before insert or update on public.bookings
  for each row execute function public.prevent_overlapping_bookings();

create trigger trg_log_admin_booking_cancel
  after delete on public.bookings
  for each row execute function public.log_admin_booking_cancel();

create trigger trg_protect_admin_flag
  before update on public.profiles
  for each row execute function public.protect_admin_flag();

create trigger trg_log_admin_flag_change
  after update on public.profiles
  for each row execute function public.log_admin_flag_change();

create trigger trg_protect_last_admin_delete
  before delete on public.profiles
  for each row execute function public.protect_last_admin_delete();


-- ------------------------------------------------------------
-- 5) Zugriffsregeln (Row Level Security)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_actions enable row level security;

create policy "Eingeloggte dürfen Profile lesen" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Eigenes Profil oder als Admin jedes Profil ändern" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

create policy "Eingeloggte dürfen lesen" on public.bookings
  for select using (auth.role() = 'authenticated');

create policy "Nur für sich selbst buchen" on public.bookings
  for insert with check (
    auth.uid() = user_id
    and date >= current_date
    and date <= current_date + interval '30 days'
  );

create policy "Eigene oder als Admin jede Buchung stornieren" on public.bookings
  for delete using (auth.uid() = user_id or public.is_admin());

create policy "Nur Admins lesen das Protokoll" on public.admin_actions
  for select using (public.is_admin());


-- ------------------------------------------------------------
-- 6) Live-Updates
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.bookings;
