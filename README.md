# Arbeitsplatz-Buchung Risiko – Kurzanleitung

Eigenständige Desksharing-App der Risikoabteilung: eigener GitHub-Account,
eigenes Supabase-Projekt, keine Verbindung zu anderen Apps.

## Supabase einrichten
1. Neues Projekt anlegen, Region **EU (Frankfurt)**.
2. `schema-setup.sql` einmal komplett im SQL-Editor ausführen
   (legt Tabellen, Login, Rechte, Admin-Funktionen und Sicherheits-Trigger an).
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
- `keepalive.yml` pingt Supabase zweimal pro Woche an, damit das kostenlose
  Projekt nicht wegen Inaktivität pausiert wird.

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
- Admin-Bereich: Admin-Rechte vergeben/entziehen, Passwort-Reset-Mail senden,
  fremde Buchungen stornieren, Protokoll aller Admin-Aktionen
- Live-Updates ohne Neuladen, Auslastungsanzeige
- Grundriss behält auf allen Geräten dieselben Proportionen
- Keine stundenweise Buchung (kein Besprechungsraum)

## Mailversand
Supabase-Standardversand (wenige Mails pro Stunde). Reicht für ca. 10 Nutzer.
Bei Engpass kann ein Admin per SQL ein vorläufiges Passwort setzen.

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
