-- ============================================================
-- Wachhalten: kleine Datenbank-Abfrage für den GitHub-Job
--
-- Der Job "Supabase wachhalten" ruft diese Funktion zweimal pro Woche
-- auf. So entsteht echte Datenbank-Aktivität und das kostenlose
-- Supabase-Projekt wird nicht wegen Inaktivität pausiert.
--
-- Die Funktion liest keine Daten und ändert nichts – sie liefert nur
-- die Zahl 1 zurück. Deshalb darf sie auch ohne Login aufgerufen werden.
--
-- Einmal im SQL-Editor ausführen. Ist bereits in schema-setup.sql
-- enthalten – bei einem neu aufgesetzten Projekt also nicht nötig.
-- ============================================================

create or replace function public.keepalive_ping()
returns integer
language sql
stable
as $function$
  select 1;
$function$;

grant execute on function public.keepalive_ping() to anon, authenticated, service_role;
