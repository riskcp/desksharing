-- ============================================================
-- Admin: vorläufiges Passwort setzen (ohne E-Mail-Versand)
--
-- Einmal im SQL-Editor ausführen. Ist bereits in schema-setup.sql
-- enthalten – bei einem neu aufgesetzten Projekt also nicht nötig.
-- ============================================================

-- Passwort-Verschlüsselung (bei Supabase meist schon aktiv)
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_temp_password(target uuid, new_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen das.';
  end if;

  if new_password is null or length(new_password) < 6 then
    raise exception 'Das Passwort muss mindestens 6 Zeichen haben.';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;

  if not found then
    raise exception 'Nutzer nicht gefunden.';
  end if;

  insert into public.admin_actions (actor_id, actor_name, action, target_user_id, target_name)
  select
    auth.uid(),
    (select display_name from public.profiles where id = auth.uid()),
    'temp_password',
    target,
    (select display_name from public.profiles where id = target);
end;
$function$;

-- Nur eingeloggte Nutzer dürfen die Funktion aufrufen (Admin-Prüfung steckt in der Funktion)
revoke execute on function public.admin_set_temp_password(uuid, text) from public, anon;
grant execute on function public.admin_set_temp_password(uuid, text) to authenticated, service_role;
