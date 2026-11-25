# Arbeitsplatz-Buchung Risiko – Kurzanleitung

Eigenständige Desksharing-App der Risikoabteilung: eigener GitHub-Account,
eigenes Supabase-Projekt, keine Verbindung zu anderen Apps.

## Supabase einrichten
1. Neues Projekt anlegen, Region **EU (Frankfurt)**.
2. `schema-setup.sql` einmal komplett im SQL-Editor ausführen
   (legt Tabellen, Login, Rechte, Admin-Funktionen, Sicherheits-Trigger,
   Freigaben und die Wachhalte-Funktion an).

Die einzelnen SQL-Dateien `grants-fix.sql`, `admin-temp-password.sql` und
`keepalive-ping.sql` sind die Nachträge, mit denen das bestehende Projekt
im November 2026 ergänzt wurde. Sie stecken alle bereits in
`schema-setup.sql` – bei einem neuen Projekt also nicht extra ausführen.

**Wichtig bei neuen Supabase-Projekten (seit Mai 2026):** Neue Tabellen sind
nicht mehr automatisch für die App freigegeben. Ohne den Abschnitt
„Freigaben“ in `schema-setup.sql` kann die App weder Profile lesen noch
buchen (Symptome: kein Admin-Button, falscher Name, Buchen schlägt fehl).
3. Zugangsdaten (Project URL + Publishable key) eintragen in:
   - `supabaseClient.js`
   - `.github/workflows/keepalive.yml`

## Wichtig: Auth-URLs setzen
Supabase → Authentication → **URL Configuration**:
- **Site URL**: `https://DEINUSERNAME.github.io/desksharing/`
- **Redirect URLs**: dieselbe Adresse ergänzen

Ohne das landen Bestätigungs- und Passwort-Reset-Links im Nichts.

## Deployment: GitHub Pages
- Repository muss **Public** sein.
- Settings → Pages → Source: **GitHub Actions**.
- `vite.config.js` → `base: '/desksharing/'` muss exakt dem Repo-Namen entsprechen.
- Jeder Commit auf `main` baut und veröffentlicht automatisch.

## Wachhalten (`keepalive.yml`)
Läuft montags und donnerstags um 6 Uhr UTC (oder per Hand unter Actions →
„Supabase wachhalten“ → Run workflow) und macht zwei Dinge:
1. **Datenbank-Abfrage** der Funktion `keepalive_ping` – kostenlose
   Supabase-Projekte werden sonst nach ca. einer Woche ohne Aktivität pausiert.
2. **Repository aktiv halten:** Ist der letzte Eintrag im Repository älter als
   30 Tage, schreibt der Job das aktuelle Datum in `.github/keepalive.txt`.
   GitHub schaltet zeitgesteuerte Jobs in öffentlichen Repositories sonst nach
   60 Tagen ohne Aktivität ab. Dieser Eintrag löst keine Veröffentlichung aus.

Wenn die App trotzdem einmal nicht lädt: in Supabase prüfen, ob das Projekt
pausiert ist, und es dort über den angezeigten Button wieder starten.

## Ersten Admin festlegen
Die Person registriert sich normal in der App. Danach im SQL-Editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'name@beispiel.de');
```

## Grundriss
- 10 Arbeitsplätze in 3 Gruppen (oben 2, Mitte 4, unten 4), Türen rechts,
  Schrank unten.
- **Gruppe 3, Platz 3 (ganz unten links) ist dauerhaft gesperrt**: immer als
  belegt angezeigt, nicht buchbar, zählt nicht als Platz (9 buchbare Plätze).
- Plätze ändern: `floorplanData.js` (Gruppen, gesperrte Plätze) und
  `FloorPlan.jsx` (Positionen). Gesperrte Plätze zusätzlich in Supabase im
  Constraint `chk_not_blocked` anpassen.
- Tische, Stühle und Abstände sind in Größe und Darstellung identisch mit der
  Desksharing-App der Finance-Abteilung.

## Features
- Login (E-Mail + Passwort), Registrierung, Passwort vergessen, Passwort ändern
- Buchung bis 14 Werktage im Voraus, Serienbuchungen
- **Nur ein Platz pro Person und Tag**
- "Wer ist da?" – Übersicht mit Namenssuche, wer an einem Tag wo sitzt
- "Meine Buchungen" mit Einzel- und Serienstornierung
- Admin-Bereich: Admin-Rechte vergeben/entziehen, vorläufiges Passwort setzen,
  fremde Buchungen stornieren, Protokoll aller Admin-Aktionen
- Live-Updates ohne Neuladen, Auslastungsanzeige
- Grundriss behält auf allen Geräten dieselben Proportionen
- Keine stundenweise Buchung (kein Besprechungsraum)
- Verständliche Fehlermeldungen beim Buchen: Die App nennt für jeden nicht
  gebuchten Tag den Grund (Platz belegt / schon anderer Platz an dem Tag /
  Platz nicht buchbar / Datum nicht erlaubt / technischer Fehler mit
  Originaltext). Logik in `bookingErrors.js`.

## Mailversand und Passwort vergessen
- Die E-Mail-Bestätigung bei der Registrierung ist in Supabase ausgeschaltet
  (Authentication → Sign In / Providers → Email → „Confirm email“ aus).
- Ohne eigenen Mailserver stellt Supabase Mails nur an Mitglieder des
  Supabase-Teams zu. Deshalb gibt es **keinen Passwort-Reset per Mail**.
- Stattdessen: Admin-Bereich → Nutzer → „Passwort-Reset“. Die App erzeugt ein
  zufälliges vorläufiges Passwort und zeigt es einmal an. Der Admin gibt es
  weiter, die Person ändert es nach dem Login über „Passwort ändern“.
  Jeder Vorgang steht im Protokoll.
- Auf der Login-Seite verweist „Passwort vergessen?“ auf einen Admin.
- Die Datenbank-Funktion dazu (`admin_set_temp_password`) steht in
  `schema-setup.sql` und einzeln in `admin-temp-password.sql`.

## Barrierefreiheit
Status wird **nicht nur** über Farbe unterschieden:
- frei = weiß gefüllt, farbiger Rand
- belegt = ausgefüllt
- eigene Buchung = ausgefüllt **mit Häkchen**

Das ist wichtig, weil Rot (#e30613) und Königsblau (#4169e1) zwar farblich
klar verschieden sind, aber fast dieselbe Helligkeit haben – in Graustufen
oder bei Blau-Gelb-Sehschwäche trägt nur die Form die Information.

## Sicherheit (in der Datenbank erzwungen, nicht nur in der Oberfläche)
- Nur eingeloggte Nutzer sehen und buchen
- Buchen nur auf den eigenen Account, stornieren nur eigene Buchungen
  (Admins zusätzlich fremde)
- Der Buchungsname wird serverseitig aus dem Profil gesetzt –
  Buchen unter fremdem Namen ist über die API nicht möglich
- `is_admin` kann von Nutzern nicht selbst gesetzt werden
- Gesperrte Plätze sind auch über die API nicht buchbar
- Buchungen nur für heute bis +30 Tage möglich
