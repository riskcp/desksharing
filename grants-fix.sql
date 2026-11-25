-- ============================================================
-- Zugriffsrechte für die App freischalten
--
-- Neue Supabase-Projekte (seit Mai 2026) geben neu angelegte Tabellen
-- nicht mehr automatisch für die App frei. Ohne diese Freigaben kann die
-- App weder Profile lesen noch buchen. Wer was darf, regeln weiterhin
-- die Zugriffsregeln (Row Level Security) – die Freigaben öffnen nur
-- die Tür für eingeloggte Nutzer, nicht für Gäste.
--
-- Einmal im SQL-Editor ausführen. Ist bereits in schema-setup.sql
-- enthalten – bei einem neu aufgesetzten Projekt also nicht nötig.
-- ============================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, delete on public.bookings to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.admin_actions to authenticated;

grant all on public.bookings, public.profiles, public.admin_actions to service_role;

-- Wird in den Zugriffsregeln geprüft ("ist Admin?")
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- Admin-Funktionen (prüfen selbst, ob der Aufrufer Admin ist)
grant execute on function public.admin_set_temp_password(uuid, text) to authenticated, service_role;
grant execute on function public.admin_password_reset_email(uuid) to authenticated, service_role;
