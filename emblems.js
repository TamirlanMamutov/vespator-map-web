// Vector insignia drawn in a 24-unit box centred on 0,0. Each layer is either
// filled or stroked, so the same data renders in SVG and through Canvas Path2D.
const chaosStar = (() => {
  let lines = "";
  let heads = "";
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const point = (radius, offset = 0) => `${(Math.cos(angle + offset) * radius).toFixed(2)} ${(Math.sin(angle + offset) * radius).toFixed(2)}`;
    lines += `M${point(3.5)}L${point(8)}`;
    heads += `M${point(11.5)}L${point(7, 0.42)}L${point(7, -0.42)}Z`;
  }
  return [{ d: "M-3.5 0A3.5 3.5 0 1 0 3.5 0A3.5 3.5 0 1 0-3.5 0", mode: "stroke" }, { d: lines, mode: "stroke" }, { d: heads, mode: "fill" }];
})();

export const EMBLEMS = {
  aquila: { label: "Aquila", layers: [
    { d: "M-1.6-1L-11-6.5-9.3-2.4-11.2-.6-8.4.6-9.6 3.6-3.4 2.4ZM1.6-1L11-6.5 9.3-2.4 11.2-.6 8.4.6 9.6 3.6 3.4 2.4Z", mode: "fill" },
    { d: "M-.6-2.4L-3.6-7.6-6-6.6-3.6-4.2-4.4-2ZM.6-2.4L3.6-7.6 6-6.6 3.6-4.2 4.4-2Z", mode: "fill" },
    { d: "M-2.2-1.6H2.2L1.2 6.4 0 9.6-1.2 6.4Z", mode: "fill" },
  ] },
  knightCrest: { label: "Knight Crest", layers: [
    { d: "M-8-9H8V0C8 5.6 3.6 9 0 11-3.6 9-8 5.6-8 0Z", mode: "stroke" },
    { d: "M-4.5-4.5H4.5M0-4.5V6M-4.5 1H4.5", mode: "stroke" },
    { d: "M-3-12L0-9.6 3-12", mode: "stroke" },
  ] },
  necronAnkh: { label: "Necron Ankh", layers: [
    { d: "M0 1C-6.2-3-4.6-10.6 0-10.6S6.2-3 0 1Z", mode: "stroke" },
    { d: "M-8 1.6H8M0 1V11.2M-4 11.2H4", mode: "stroke" },
  ] },
  aeldariRune: { label: "Aeldari Rune", layers: [
    { d: "M0-11.4V11.4", mode: "stroke" },
    { d: "M-8-6.2C-5 2.6 5 2.6 8-6.2", mode: "stroke" },
    { d: "M-5.2 5.6L0 1.6 5.2 5.6", mode: "stroke" },
    { d: "M-1.8-9.4A1.8 1.8 0 1 0 1.8-9.4A1.8 1.8 0 1 0-1.8-9.4", mode: "fill" },
  ] },
  chaosStar: { label: "Chaos Star", layers: chaosStar },
  nurgleFly: { label: "Nurgle Fly", layers: [
    { d: "M0-4C3.4-4 3.4 7.6 0 9.6-3.4 7.6-3.4-4 0-4Z", mode: "fill" },
    { d: "M-2.6-6.6A2.6 2.6 0 1 0 2.6-6.6A2.6 2.6 0 1 0-2.6-6.6", mode: "fill" },
    { d: "M-1.4-2C-9.6-10.4-12.4-1.6-2.4 2.2M1.4-2C9.6-10.4 12.4-1.6 2.4 2.2", mode: "stroke" },
    { d: "M-2.4 3.2L-7.4 6M2.4 3.2L7.4 6M-2.2 6.2L-6 10.4M2.2 6.2L6 10.4", mode: "stroke" },
  ] },
  fortification: { label: "Fortification Line", layers: [
    { d: "M-10 8V-2H-6.5V-6.5H-3V-2H-1.5V-6.5H1.5V-2H3V-6.5H6.5V-2H10V8Z", mode: "stroke" },
    { d: "M-10 3H10", mode: "stroke" },
  ] },
  support: { label: "Support Facility", layers: [
    { d: "M-3-9H3V-3H9V3H3V9H-3V3H-9V-3H-3Z", mode: "stroke" },
  ] },
  staging: { label: "Staging Grounds", layers: [
    { d: "M-9.5 0A9.5 9.5 0 1 0 9.5 0A9.5 9.5 0 1 0-9.5 0", mode: "stroke" },
    { d: "M-4-5V5M4-5V5M-4 0H4", mode: "stroke" },
  ] },
  stronghold: { label: "Stronghold", layers: [
    { d: "M-8 10V-4L-8.6-10H-4.4V-7H-1.6V-10H1.6V-7H4.4V-10H8.6L8-4V10Z", mode: "stroke" },
    { d: "M-2.4 10V4.2A2.4 2.4 0 0 1 2.4 4.2V10", mode: "stroke" },
  ] },
  special: { label: "Special Site", layers: [
    { d: "M0-10L10 8H-10Z", mode: "stroke" },
    { d: "M0-3V3M0 5V6", mode: "stroke" },
  ] },
  empty: { label: "Empty Slot", layers: [
    { d: "M-8 0A8 8 0 1 0 8 0A8 8 0 1 0-8 0", mode: "stroke", dash: "2.4 2.4" },
  ] },
  active: { label: "Active Facility", layers: [
    { d: "M0-10L10 0 0 10-10 0Z", mode: "stroke" },
    { d: "M0-4.5L4.5 0 0 4.5-4.5 0Z", mode: "fill" },
  ] },
  necronMonolith: { label: "Necron Monolith", layers: [
    { d: "M-7 10L-4.6-8.4 0-11 4.6-8.4 7 10Z", mode: "stroke" },
    { d: "M-2.2-4.6H2.2V-.2H-2.2Z", mode: "fill" },
    { d: "M-5.6 4H5.6M-3 7.4H3", mode: "stroke" },
  ] },
  knightHelm: { label: "Knight Helm", layers: [
    { d: "M-8 9V-2C-8-8-4.5-11 0-11S8-8 8-2V9L4 6H-4Z", mode: "stroke" },
    { d: "M-5.4-1.6H5.4M0-11V6", mode: "stroke" },
    { d: "M-4.6-5H-1.2V-2.8H-4.6ZM1.2-5H4.6V-2.8H1.2Z", mode: "fill" },
  ] },
  // Covert kill team mark: a skull over a crossed combat dagger.
  killTeam: { label: "Kill Team Operation", layers: [
    { d: "M-9 9L9-9M9 9L-9-9", mode: "stroke" },
    { d: "M-6.5-1.5C-6.5-7-3.4-9.5 0-9.5S6.5-7 6.5-1.5C6.5 1.4 5 3 3.4 3.6V6.4H-3.4V3.6C-5 3-6.5 1.4-6.5-1.5Z", mode: "fill" },
    { d: "M-4.1-3.2A1.8 1.8 0 1 0-0.5-3.2A1.8 1.8 0 1 0-4.1-3.2ZM0.5-3.2A1.8 1.8 0 1 0 4.1-3.2A1.8 1.8 0 1 0 0.5-3.2ZM-0.9 0.4L0-1.2 0.9 0.4Z", mode: "fill", invert: true },
    { d: "M-1.6 4.2V6.4M1.6 4.2V6.4", mode: "stroke", invert: true },
  ] },
};

const radial = (count, build, rotation = -Math.PI / 2) => {
  let d = "";
  for (let i = 0; i < count; i++) {
    const angle = rotation + (i * Math.PI * 2) / count;
    const p = (radius, offset = 0) => `${(Math.cos(angle + offset) * radius).toFixed(2)} ${(Math.sin(angle + offset) * radius).toFixed(2)}`;
    d += build(p);
  }
  return d;
};
const circle = (cx, cy, r) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}`;

// The nine official Vespator Front terrain twist glyphs. Keys match "terrainIcons" in campaign_data.json.
// Artwork stays inside a radius of ~8.5 so it sits cleanly inside the filled green placard roundel.
export const TERRAIN_GLYPHS = {
  spaceport: { label: "Spaceport", layers: [
    { d: "M0-9C2.4-6.6 2.8-3 2.8 1.6H-2.8C-2.8-3-2.4-6.6 0-9Z", mode: "fill" },
    { d: "M-2.8-.4L-5.4 3.4V5.4L-2.8 3.6ZM2.8-.4L5.4 3.4V5.4L2.8 3.6Z", mode: "fill" },
    { d: "M-1.6 3.6L0 6.6 1.6 3.6M-8 8.4H8", mode: "stroke" },
  ] },
  desolate_wastes: { label: "Desolate Wastes", layers: [
    { d: circle(3.6, -4.4, 2.6), mode: "fill" },
    { d: "M-8.4 1.6C-5.6-1.2-3.2-1.2-.4 1.6S4.8 4.4 8.4 1.6M-8.4 6.2C-5.6 3.4-3.2 3.4-.4 6.2S4.8 9 8.4 6.2", mode: "stroke" },
  ] },
  xenoflora_jungle: { label: "Xenoflora Jungle", layers: [
    { d: "M0 8.6V-1.4", mode: "stroke" },
    { d: "M0-1.4C-1.6-6.8-6.4-8.6-8.4-6.4C-6.6-3.2-3.4-1.8 0-1.4ZM0-1.4C1.6-6.8 6.4-8.6 8.4-6.4C6.6-3.2 3.4-1.8 0-1.4ZM0 3C-2.4-.4-6.2 0-7.4 2.4C-5.2 4.4-2.4 4.4 0 3ZM0 3C2.4-.4 6.2 0 7.4 2.4C5.2 4.4 2.4 4.4 0 3Z", mode: "fill" },
  ] },
  rad_zone: { label: "Rad Zone", layers: [
    { d: circle(0, 0, 1.6), mode: "fill" },
    { d: radial(3, (p) => `M${p(2.8, -0.5)}L${p(8.6, -0.5)}A8.6 8.6 0 0 1 ${p(8.6, 0.5)}L${p(2.8, 0.5)}A2.8 2.8 0 0 0 ${p(2.8, -0.5)}Z`), mode: "fill" },
  ] },
  forge_complex: { label: "Forge Complex", layers: [
    { d: radial(8, (p) => `M${p(5.2, -0.22)}L${p(8.4, -0.14)}L${p(8.4, 0.14)}L${p(5.2, 0.22)}Z`), mode: "fill" },
    { d: `${circle(0, 0, 5.6)}${circle(0, 0, 2.2)}`, mode: "fill", rule: "evenodd" },
  ] },
  hab_sprawl: { label: "Hab Sprawl", layers: [
    { d: "M-8.4 8.4V-1.4H-4.4V8.4ZM-3.2 8.4V-7.8H1.6V8.4ZM2.8 8.4V-3.6H8.4V8.4Z", mode: "fill" },
    { d: "M-1.6-5V-3.6M0-5V-3.6M-1.6-1.2V.2M0-1.2V.2M-1.6 2.6V4M0 2.6V4M4.4-1.2H6.8M4.4 1.6H6.8M4.4 4.4H6.8M-7.2 1.6H-5.6M-7.2 4.4H-5.6", mode: "stroke", invert: true },
  ] },
  delvesite_facility: { label: "Delvesite Facility", layers: [
    { d: "M-6.4 4.4L0-8.4 6.4 4.4M-3.8-.8H3.8M-8.4 4.4H8.4", mode: "stroke" },
    { d: "M-1.8 4.4H1.8V6.4L0 9 -1.8 6.4Z", mode: "fill" },
    { d: circle(0, -8.4, 1.4), mode: "fill" },
  ] },
  dead_lands: { label: "Dead Lands", layers: [
    { d: "M0-8.6C-4.8-8.6-7-5.2-7-1.8C-7 1.2-5.6 2.6-4 3.4V6.4H4V3.4C5.6 2.6 7 1.2 7-1.8C7-5.2 4.8-8.6 0-8.6Z", mode: "fill" },
    { d: `${circle(-3, -1.8, 1.8)}${circle(3, -1.8, 1.8)}M0 .6L-1 2.6H1Z`, mode: "fill", invert: true },
    { d: "M-2.2 6.4V8.6M0 6.4V8.6M2.2 6.4V8.6", mode: "stroke" },
  ] },
  tomb_complex: { label: "Tomb Complex", layers: [
    { d: "M-8.6 8L0-8.6 8.6 8Z", mode: "fill" },
    { d: "M-4.4 0H4.4M-6.4 4H6.4M0-4.4V-2", mode: "stroke", invert: true },
    { d: circle(0, -3.4, 0.4), mode: "stroke", invert: true },
  ] },
  unknown: { label: "Unclassified Terrain", layers: [
    { d: "M0-8L8 0 0 8-8 0Z", mode: "stroke" },
    { d: "M-2.2-2.2C-2.2-4.6 2.2-4.6 2.2-2.2S0-.4 0 1.8M0 4V4.6", mode: "stroke" },
  ] },
};

// Ship silhouettes point their prow up (toward -y) inside the 24-unit box. "hull" is a closed polygon reused
// as an extruded THREE.Shape in 3D; "detail" is stroked over it as engraved hull lines.
export const SHIP_SILHOUETTES = {
  imperium: { label: "Gothic Prow-Ram Cruiser", hull: [
    [0, -12], [1.6, -9.6], [2.4, -6.8], [3.2, -6.8], [3.2, -3], [6.4, -1.4], [6.4, 3.6], [4.4, 5.2], [5.6, 10], [2.4, 8.6],
    [1.2, 11], [-1.2, 11], [-2.4, 8.6], [-5.6, 10], [-4.4, 5.2], [-6.4, 3.6], [-6.4, -1.4], [-3.2, -3], [-3.2, -6.8], [-2.4, -6.8], [-1.6, -9.6],
  ], detail: "M0-6V6M-3.6 1.2H3.6M-1.6 3.6L0 1.4 1.6 3.6" },
  chaos: { label: "Spiked Slaughter Cruiser", hull: [
    [0, -12], [1.6, -7], [6.8, -10], [4.6, -3.6], [11, -2.4], [5, 1], [9, 6.4], [3.8, 4.8], [3.2, 10.4], [1, 7.4], [0, 11],
    [-1, 7.4], [-3.2, 10.4], [-3.8, 4.8], [-9, 6.4], [-5, 1], [-11, -2.4], [-4.6, -3.6], [-6.8, -10], [-1.6, -7],
  ], detail: "M0-7V5M-2.6-1.4L0 1 2.6-1.4" },
  necron: { label: "Crescent Scythe Raider", hull: [
    ...Array.from({ length: 9 }, (_, i) => { const a = (10 + i * 20) * Math.PI / 180; return [+(Math.cos(a) * 11).toFixed(2), +(Math.sin(a) * 11 - 3).toFixed(2)]; }),
    [-11.4, -10],
    ...Array.from({ length: 9 }, (_, i) => { const a = (170 - i * 20) * Math.PI / 180; return [+(Math.cos(a) * 9.6).toFixed(2), +(Math.sin(a) * 9.6 - 6.4).toFixed(2)]; }),
    [11.4, -10],
  ], detail: "M0 3.2V7.4M-4.8 1.6L-6 4.8M4.8 1.6L6 4.8" },
  aeldari: { label: "Solar-Sail Crescent Blade", hull: [
    [0, -12], [1.6, -5.4], [3, -6.4], [7.6, -10], [10.4, -6], [10, 0.6], [7, 5.2], [2.2, 4.4], [1.4, 8.4], [0, 11.4],
    [-1.4, 8.4], [-3.2, 6.4], [-1.8, 1.2], [-1.6, -5.4],
  ], detail: "M2.4-3.4L8.2-7.4M2.4 0L9.4-2.4M2.4 3L7.6 3.2" },
};

export const SHIP_BADGES = {
  imperial_cruiser: { ship: "imperium", label: "Imperial Cruiser" },
  imperial_battleship: { ship: "imperium", label: "Imperial Battleship", scale: 1.2 },
  chaos_grand_cruiser: { ship: "chaos", label: "Chaos Grand Cruiser", scale: 1.1 },
  necron_scythe: { ship: "necron", label: "Necron Scythe" },
  aeldari_cruiser: { ship: "aeldari", label: "Aeldari Cruiser" },
};

const FACTION_SHIPS = { "Imperial Guard": "imperium", "Imperial Knights": "imperium", "Thousand Sons": "chaos", "Death Guard": "chaos", Necrons: "necron", Aeldari: "aeldari" };
const ALLIANCE_SHIPS = { Imperium: "imperium", Xenos: "necron", Chaos: "chaos" };

export function shipKey(fleet) {
  return FACTION_SHIPS[fleet.faction] || SHIP_BADGES[fleet.badge]?.ship || ALLIANCE_SHIPS[fleet.alliance] || "imperium";
}

export function shipScale(fleet) {
  return SHIP_BADGES[fleet.badge]?.scale || 1;
}

export function shipClass(fleet) {
  return SHIP_BADGES[fleet.badge]?.label || SHIP_SILHOUETTES[shipKey(fleet)].label;
}

export function shipPath(key) {
  const ship = SHIP_SILHOUETTES[key] || SHIP_SILHOUETTES.imperium;
  return `M${ship.hull.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}
export function glyphKey(icon) {
  return TERRAIN_GLYPHS[icon] ? icon : "unknown";
}

export function emblemLayers(key) {
  return (EMBLEMS[key] || TERRAIN_GLYPHS[key] || EMBLEMS.special).layers;
}

export const FACTION_EMBLEMS = {
  "Imperial Guard": "aquila",
  "Imperial Knights": "knightCrest",
  Necrons: "necronAnkh",
  Aeldari: "aeldariRune",
  "Thousand Sons": "chaosStar",
  "Death Guard": "nurgleFly",
};

export const ALLIANCE_EMBLEMS = { Imperium: "aquila", Xenos: "necronAnkh", Chaos: "chaosStar" };

export const INFRASTRUCTURE_EMBLEMS = {
  "Fortification Line": "fortification",
  "Support Facility": "support",
  "Staging Grounds": "staging",
  Stronghold: "stronghold",
  Special: "special",
  Active: "active",
  Empty: "empty",
};

// Fleet "badge" keys from campaign_data.json. Ship-class badges show the fleet's faction insignia.
export const BADGE_EMBLEMS = {
  imperial_aquila: "aquila",
  knight_helm: "knightHelm",
  necron_monolith: "necronMonolith",
  craftworld_rune: "aeldariRune",
  chaos_star: "chaosStar",
  nurgle_fly: "nurgleFly",
  imperial_cruiser: "aquila",
  imperial_battleship: "aquila",
  chaos_grand_cruiser: "chaosStar",
  necron_scythe: "necronAnkh",
  aeldari_cruiser: "aeldariRune",
};

export function factionEmblem(faction, alliance) {
  return FACTION_EMBLEMS[faction] || ALLIANCE_EMBLEMS[alliance] || "special";
}

export function fleetEmblem(fleet) {
  if (SHIP_BADGES[fleet.badge] && FACTION_EMBLEMS[fleet.faction]) return FACTION_EMBLEMS[fleet.faction];
  return BADGE_EMBLEMS[fleet.badge] || factionEmblem(fleet.faction, fleet.alliance);
}

export function drawEmblem(context, key, x, y, size, color, lineWidth = 1.8, background = "#030803") {
  const emblem = { layers: emblemLayers(key) };
  context.save();
  context.translate(x, y);
  context.scale(size / 24, size / 24);
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const layer of emblem.layers) {
    const path = new Path2D(layer.d);
    const ink = layer.invert ? background : color;
    context.fillStyle = ink;
    context.strokeStyle = ink;
    context.setLineDash(layer.dash ? layer.dash.split(" ").map(Number) : []);
    if (layer.mode === "fill") context.fill(path, layer.rule || "nonzero");
    else context.stroke(path);
  }
  context.restore();
}
