// Übersetzt Fehler der Datenbank beim Buchen in verständliche Gründe.
//
// Früher zeigte die App bei JEDEM Fehler "bereits belegt" an – auch wenn
// eigentlich die Verbindung fehlte oder Rechte nicht stimmten. Dadurch
// waren echte Probleme kaum zu erkennen.
//
// Bewusst als reine Funktion ohne Datenbank-Zugriff: so ist sie
// unabhängig von der Oberfläche testbar.

/** Mögliche Gründe, warum ein Tag nicht gebucht werden konnte. */
export const REASONS = {
  TAKEN: "taken", // Platz an dem Tag schon von jemandem gebucht
  OWN_DESK: "own_desk", // Person hat an dem Tag schon einen anderen Platz
  BLOCKED: "blocked", // dauerhaft gesperrter Platz
  NOT_ALLOWED: "not_allowed", // Datum außerhalb des erlaubten Zeitraums o. Ä.
  TECHNICAL: "technical", // Verbindung, Rechte, sonstiges
};

const TEXTS = {
  taken: "Platz ist bereits belegt",
  own_desk: "du hast an dem Tag schon einen anderen Platz",
  blocked: "dieser Platz ist nicht buchbar",
  not_allowed: "Buchung nicht erlaubt (z. B. Datum außerhalb des Buchungszeitraums)",
  technical: "technischer Fehler",
};

/**
 * Ordnet einen Fehler von Supabase einem Grund zu.
 * @param {{code?: string, message?: string}|null} error
 * @returns {string} einer der Werte aus REASONS
 */
export function classifyBookingError(error) {
  const code = error?.code || "";
  const msg = (error?.message || "").toLowerCase();

  if (code === "23505") {
    // Zwei verschiedene Eindeutigkeits-Regeln in der Datenbank:
    // "ein Platz pro Person und Tag" bzw. "ein Platz nur einmal pro Tag".
    return msg.includes("per_user") ? REASONS.OWN_DESK : REASONS.TAKEN;
  }
  if (code === "23514" && msg.includes("not_blocked")) return REASONS.BLOCKED;
  if (code === "42501" && msg.includes("row-level security")) return REASONS.NOT_ALLOWED;
  return REASONS.TECHNICAL;
}

/** Kurzer Text zu einem Grund, z. B. "Platz ist bereits belegt". */
export function reasonText(reason) {
  return TEXTS[reason] || TEXTS.technical;
}

/**
 * Baut aus den Fehlschlägen einer (Serien-)Buchung die Meldung für den Dialog.
 * @param {{date: string, reason: string, error: object}[]} failures
 * @param {number} total Anzahl der Tage, die gebucht werden sollten
 * @param {(dateKey: string) => string} formatDate
 * @returns {string}
 */
export function describeFailures(failures, total, formatDate) {
  if (failures.length === 0) return "";

  // Bei technischen Fehlern den Originaltext mitliefern, damit die Ursache
  // erkennbar bleibt (z. B. fehlende Rechte oder keine Verbindung).
  const textOf = (f) =>
    f.reason === REASONS.TECHNICAL
      ? `${reasonText(f.reason)} (${f.error?.message || "unbekannter Fehler"})`
      : reasonText(f.reason);

  if (total === 1) {
    const text = textOf(failures[0]);
    return `Nicht gebucht: ${text.charAt(0).toUpperCase() + text.slice(1)}.`;
  }

  const lines = failures.map((f) => `• ${formatDate(f.date)}: ${textOf(f)}`);
  const ok = total - failures.length;
  const head =
    ok === 0
      ? `Keiner der ${total} Tage wurde gebucht:`
      : `${ok} von ${total} Tagen gebucht. Nicht gebucht:`;
  return [head, ...lines].join("\n");
}
