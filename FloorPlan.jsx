import { RESOURCES } from "./floorplanData";

/*
  Der komplette Grundriss ist EINE SVG-Zeichnung mit fester viewBox.
  Dadurch bleiben alle Proportionen auf jedem Gerät exakt gleich – die
  Zeichnung wird nur als Ganzes skaliert, nie umgebrochen oder umsortiert.

  Tische, Stühle und Abstände sind exakt wie in der Desksharing-App der
  Finance-Abteilung (Tisch 54 x 32, Stuhl-Radius 8, 4 Abstand Tisch–Stuhl).
  Die Anordnung entspricht dem Raumschema (um 90° gedreht, Türen rechts,
  Schrank unten), maßstabsgetreu auf diese Tischgröße umgerechnet.
*/

// Raum (Innenmaße) und Ursprung der Zeichnung
const O = 10;            // linke/obere Innenkante der Zeichnung
const ROOM_W = 171;
const ROOM_H = 398;

const VB_W = ROOM_W + 20; // 191
const VB_H = ROOM_H + 20; // 418

// Innenkanten der Außenwand (Wand: Strichstärke 5, mittig auf O - 4)
const WALL_RIGHT = O + ROOM_W + 1.5;  // 182.5
const WALL_BOTTOM = O + ROOM_H + 1.5; // 409.5

// Anzeigegröße: Der Grundriss wird so groß dargestellt, dass er auf dem
// Bildschirm etwa so hoch ist wie der Grundriss der Finance-App (ca. 740px).
// Auf schmalen Handys wird er automatisch kleiner skaliert.
const TARGET_HEIGHT_PX = 740;
const MAX_WIDTH_PX = Math.round((VB_W * TARGET_HEIGHT_PX) / VB_H);

const DESK_W = 54;
const DESK_H = 32;
const CHAIR_R = 8;

// Tischgruppen (Oberkante der oberen Tischreihe)
const COL_LEFT_X = O;
const COL_RIGHT_X = O + DESK_W;
const G1_Y = O;          // 2 Plätze an der oberen Wand, Stühle unten
const G2_Y = O + 140;    // 2 x 2 Plätze, Stühle oben und unten
const G3_Y = O + 268;    // 2 x 2 Plätze, Stühle oben und unten

// Türen an der rechten Wand (Scharnier, Öffnungsbreite)
const DOOR_R = 21.6;
const DOOR_TOP_HINGE_Y = O + 81.4;     // öffnet nach oben
const DOOR_BOTTOM_HINGE_Y = O + 311.1; // öffnet nach unten

// Schrank an der unteren Wand
const CABINET = { x: O + 22, y: WALL_BOTTOM - 10.5, w: 77, h: 10.5 };

function statusOf(bookings, id, myUserId) {
  const entries = bookings[id] || [];
  if (entries.length === 0) return { status: "free", entries };
  return {
    status: entries.some((b) => b.user_id === myUserId) ? "mine" : "booked",
    entries,
  };
}

// Ein Schreibtisch mit Stuhl. chairSide = "above" | "below".
// Der Stuhl sitzt immer an der LANGEN Tischseite (oben oder unten).
function Desk({ id, x, y, chairSide, bookings, myUserId, onSelect }) {
  const resource = RESOURCES.find((r) => r.id === id);
  if (!resource) return null;
  if (resource.blocked) return <BlockedDesk resource={resource} x={x} y={y} chairSide={chairSide} />;
  const { status, entries } = statusOf(bookings, id, myUserId);

  const chairX = x + DESK_W / 2;
  const chairY =
    chairSide === "above" ? y - CHAIR_R - 4 : y + DESK_H + CHAIR_R + 4;
  const filled = status !== "free";
  const occupied = status === "free" ? "frei" : `belegt von ${entries[0]?.name ?? "jemandem"}`;

  return (
    <g
      className={`fp-desk fp-${status}`}
      onClick={() => onSelect(resource)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(resource)}
      aria-label={`${resource.label}: ${occupied}`}
    >
      <title>{`${resource.label} – ${occupied}`}</title>
      <rect
        x={x}
        y={y}
        width={DESK_W}
        height={DESK_H}
        rx="2"
        className="fp-desk-top"
        fillOpacity={filled ? 0.18 : 1}
      />
      <circle cx={chairX} cy={chairY} r={CHAIR_R} className="fp-chair" />
      {status === "mine" && (
        <path
          d={`M${chairX - 4} ${chairY} l3 3 l5.5 -6`}
          className="fp-check"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

// Dauerhaft gesperrter Platz: immer rot, ohne Namen, nicht anklickbar.
function BlockedDesk({ resource, x, y, chairSide }) {
  const chairX = x + DESK_W / 2;
  const chairY =
    chairSide === "above" ? y - CHAIR_R - 4 : y + DESK_H + CHAIR_R + 4;
  return (
    <g className="fp-desk fp-booked fp-blocked" aria-label={`${resource.label}: nicht buchbar`}>
      <title>{`${resource.label} – nicht buchbar`}</title>
      <rect x={x} y={y} width={DESK_W} height={DESK_H} rx="2" className="fp-desk-top" fillOpacity={0.18} />
      <circle cx={chairX} cy={chairY} r={CHAIR_R} className="fp-chair" />
    </g>
  );
}

// 2er-Gruppe an der oberen Wand: zwei Tische nebeneinander, Stühle unten.
function DeskPair({ groupId, y, bookings, myUserId, onSelect }) {
  const slots = [
    { n: 1, x: COL_LEFT_X, y, side: "below" },
    { n: 2, x: COL_RIGHT_X, y, side: "below" },
  ];
  return (
    <g>
      {slots.map((s) => (
        <Desk
          key={s.n}
          id={`${groupId}-${s.n}`}
          x={s.x}
          y={s.y}
          chairSide={s.side}
          bookings={bookings}
          myUserId={myUserId}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
}

// 4er-Gruppe: Kreise, Tisch, Tisch, Kreise (von oben nach unten).
// Die beiden Tischreihen stoßen zusammen, die Personen sitzen außen an
// den langen Seiten und schauen sich gegenüber.
function DeskCluster({ groupId, y, bookings, myUserId, onSelect }) {
  const topRowY = y;
  const bottomRowY = topRowY + DESK_H; // Tische stoßen zusammen

  const slots = [
    { n: 1, x: COL_LEFT_X, y: topRowY, side: "above" },
    { n: 2, x: COL_RIGHT_X, y: topRowY, side: "above" },
    { n: 3, x: COL_LEFT_X, y: bottomRowY, side: "below" },
    { n: 4, x: COL_RIGHT_X, y: bottomRowY, side: "below" },
  ];

  return (
    <g>
      {slots.map((s) => (
        <Desk
          key={s.n}
          id={`${groupId}-${s.n}`}
          x={s.x}
          y={s.y}
          chairSide={s.side}
          bookings={bookings}
          myUserId={myUserId}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
}

// Tür an der rechten Wand: Wandöffnung, Türblatt und Schwenkbereich.
// opens = "up" | "down" (Richtung, in die die Tür aufschwingt)
function Door({ hingeY, opens }) {
  const x = WALL_RIGHT;
  const r = DOOR_R;
  const endY = opens === "up" ? hingeY - r : hingeY + r;
  const sweep = opens === "up" ? 1 : 0;
  const top = Math.min(hingeY, endY);
  return (
    <g className="fp-door" aria-hidden="true">
      {/* Öffnung in der Außenwand */}
      <rect x={x - 0.5} y={top} width="6.5" height={r} className="fp-door-gap" />
      {/* Schwenkbereich */}
      <path
        d={`M${x} ${hingeY} L${x - r} ${hingeY} A${r} ${r} 0 0 ${sweep} ${x} ${endY} Z`}
        className="fp-door-swing"
      />
      {/* Türblatt */}
      <line x1={x} y1={hingeY} x2={x - r} y2={hingeY} className="fp-door-leaf" />
    </g>
  );
}

export default function FloorPlan({ bookings, myUserId, onSelect }) {
  const common = { bookings, myUserId, onSelect };
  return (
    <div className="building" style={{ maxWidth: `${MAX_WIDTH_PX}px` }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="floorplan-svg"
        role="group"
        aria-label="Grundriss mit buchbaren Arbeitsplätzen"
      >
        {/* Außenwand */}
        <rect x="6" y="6" width={VB_W - 12} height={VB_H - 12} className="fp-outer-wall" />

        {/* Türen rechts */}
        <Door hingeY={DOOR_TOP_HINGE_Y} opens="up" />
        <Door hingeY={DOOR_BOTTOM_HINGE_Y} opens="down" />

        {/* Schrank unten (nur zur Orientierung) */}
        <g className="fp-decor" aria-hidden="true">
          <rect x={CABINET.x} y={CABINET.y} width={CABINET.w} height={CABINET.h} />
        </g>

        {/* Tischgruppen */}
        <DeskPair groupId="G1" y={G1_Y} {...common} />
        <DeskCluster groupId="G2" y={G2_Y} {...common} />
        <DeskCluster groupId="G3" y={G3_Y} {...common} />
      </svg>
    </div>
  );
}
