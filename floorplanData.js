// Zentrales Datenmodell für den Grundriss.
// Möchtest du später Tische ändern, ist HIER die einzige Stelle,
// die angepasst werden muss (Positionen stehen in FloorPlan.jsx).

// Drei Tischgruppen, von oben nach unten:
//   Gruppe 1: 2 Plätze an der oberen Wand
//   Gruppe 2: 4 Plätze (2 x 2) in der Mitte
//   Gruppe 3: 4 Plätze (2 x 2) unten
// Platznummern je Gruppe: 1 = oben links, 2 = oben rechts,
// 3 = unten links, 4 = unten rechts.
export const GROUPS = [
  { id: "G1", label: "Gruppe 1", kind: "desk-group", desks: 2 },
  { id: "G2", label: "Gruppe 2", kind: "desk-group", desks: 4 },
  { id: "G3", label: "Gruppe 3", kind: "desk-group", desks: 4 },
];

// Dauerhaft gesperrte Plätze: werden im Grundriss immer als belegt (rot)
// angezeigt, sind nicht anklickbar und zählen nicht als buchbarer Platz.
// "G3-3" = Gruppe 3, Platz 3 (ganz unten links).
// Zum Freigeben die ID hier entfernen UND in Supabase den Constraint
// "chk_not_blocked" anpassen.
export const BLOCKED_RESOURCE_IDS = new Set(["G3-3"]);

// Flache Liste aller einzeln buchbaren Einheiten (resource_id in der Tabelle "bookings")
export function buildResourceList() {
  const list = [];
  const addGroup = (group) => {
    for (let i = 1; i <= group.desks; i++) {
      const id = group.desks > 1 ? `${group.id}-${i}` : group.id;
      list.push({
        id,
        groupId: group.id,
        groupLabel: group.label,
        seat: group.desks > 1 ? i : null,
        label:
          group.desks > 1 ? `${group.label}, Platz ${i}` : group.label,
        kind: group.kind, // 'desk-group'
        timeBased: false, // keine stundenweise Buchung in dieser App
        blocked: BLOCKED_RESOURCE_IDS.has(id),
      });
    }
  };
  GROUPS.forEach(addGroup);
  return list;
}

export const RESOURCES = buildResourceList();

// Nachschlagetabelle statt linearer Suche: getResource() wird beim
// Zeichnen des Grundrisses für jeden Platz einzeln aufgerufen.
const RESOURCE_BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

/** Liefert die Platz-Definition zu einer resource_id, oder undefined. */
export function getResource(id) {
  return RESOURCE_BY_ID.get(id);
}
