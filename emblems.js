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

// Terrain glyph keys match the "terrainIcons" values in campaign_data.json.
export const TERRAIN_GLYPHS = {
  radiation: { label: "Radiation", layers: [
    { d: circle(0, 0, 1.9), mode: "fill" },
    { d: radial(3, (p) => `M${p(3.4, -0.5)}L${p(10.5, -0.5)}A10.5 10.5 0 0 1 ${p(10.5, 0.5)}L${p(3.4, 0.5)}A3.4 3.4 0 0 0 ${p(3.4, -0.5)}Z`), mode: "fill" },
  ] },
  spire: { label: "Hive Spire", layers: [
    { d: "M0-11L3-3V10H-3V-3Z", mode: "stroke" },
    { d: "M-8 10V1L-5-1V10M8 10V1L5-1V10M-11 10H11", mode: "stroke" },
  ] },
  hazard: { label: "Hazard Zone", layers: [
    { d: "M0-10L10.5 8.5H-10.5Z", mode: "stroke" },
    { d: "M0-3.5V3M0 5.6V6", mode: "stroke" },
  ] },
  cog: { label: "Mechanicus Cog", layers: [
    { d: radial(8, (p) => `M${p(6.6, -0.2)}L${p(10.4, -0.13)}L${p(10.4, 0.13)}L${p(6.6, 0.2)}`), mode: "stroke" },
    { d: circle(0, 0, 6.6), mode: "stroke" },
    { d: circle(0, 0, 2.6), mode: "fill" },
  ] },
  chimney: { label: "Manufactorum Stacks", layers: [
    { d: "M-10 10V0L-4 4V0L2 4V-5H7V10Z", mode: "stroke" },
    { d: `${circle(4.5, -8.4, 1.7)}${circle(7.6, -10.4, 1.2)}`, mode: "fill" },
  ] },
  waste: { label: "Toxic Waste", layers: [
    { d: "M-6-9H5V9H-6Z", mode: "stroke" },
    { d: "M-6-4H5M-6 4H5", mode: "stroke" },
    { d: "M8.6 1.6C10.4 4.6 10.4 7 8.6 7S6.8 4.6 8.6 1.6Z", mode: "fill" },
  ] },
  pine: { label: "Pine Forest", layers: [
    { d: "M0-11L-5.5-3.5H-2.5L-8 3.5H-3L-9 9.5H9L3 3.5H8L2.5-3.5H5.5Z", mode: "stroke" },
    { d: "M0 9.5V12", mode: "stroke" },
  ] },
  dense_roots: { label: "Dense Roots", layers: [
    { d: "M0-11V0M-4-11C-4-6-1-5 0 0M4-11C4-6 1-5 0 0", mode: "stroke" },
    { d: "M0 0C-2 4-6 4-9.5 9.5M0 0C2 4 6 4 9.5 9.5M0 0V10.5M-4.5 3.4C-6 6-3 8-4.5 10.5M4.5 3.4C6 6 3 8 4.5 10.5", mode: "stroke" },
  ] },
  glacier: { label: "Glacier", layers: [
    { d: "M-11 9L-4.5-5-1 1 3.5-9 11 9Z", mode: "stroke" },
    { d: "M-4.5-5L-2.6-.8-5.4-2M3.5-9L5.8-3.6 2.8-4.6", mode: "stroke" },
    { d: "M-11 9H11", mode: "stroke" },
  ] },
  blizzard: { label: "Blizzard", layers: [
    { d: radial(6, (p) => `M0 0L${p(10.5)}M${p(6.4)}L${p(9.4, 0.32)}M${p(6.4)}L${p(9.4, -0.32)}`), mode: "stroke" },
  ] },
  grain: { label: "Grain Fields", layers: [
    { d: "M0 11V-11", mode: "stroke" },
    { d: [-8, -3.5, 1].map((y) => `M0 ${y + 3}C-1.4 ${y}-4.6 ${y - 0.6}-5.6 ${y - 2.6}C-3 ${y - 2.6}-0.6 ${y - 0.6} 0 ${y + 3}ZM0 ${y + 3}C1.4 ${y} 4.6 ${y - 0.6} 5.6 ${y - 2.6}C3 ${y - 2.6} 0.6 ${y - 0.6} 0 ${y + 3}Z`).join(""), mode: "fill" },
  ] },
  flora: { label: "Xenoflora", layers: [
    { d: radial(5, (p) => `M${p(1.6)}C${p(6, -0.55)} ${p(11, -0.25)} ${p(10.4)}C${p(11, 0.25)} ${p(6, 0.55)} ${p(1.6)}`), mode: "stroke" },
    { d: circle(0, 0, 2.2), mode: "fill" },
  ] },
  coffin: { label: "Catacombs", layers: [
    { d: "M-4-11H4L7.5-5 4 11H-4L-7.5-5Z", mode: "stroke" },
    { d: "M0-6V4.5M-3.4-2.6H3.4", mode: "stroke" },
  ] },
  aeldari_rune: { label: "Webway Rune", layers: EMBLEMS.aeldariRune.layers },
  chaos_eye: { label: "Eye of Chaos", layers: [
    { d: "M-11.5 0C-5.5-8.4 5.5-8.4 11.5 0C5.5 8.4-5.5 8.4-11.5 0Z", mode: "stroke" },
    { d: "M0-5.6C2.4-2.2 2.4 2.2 0 5.6C-2.4 2.2-2.4-2.2 0-5.6Z", mode: "fill" },
  ] },
  warp_rift: { label: "Warp Rift", layers: [
    { d: "M-1.5-11.5L2.5-5.5-3-1.5 3 3-1.5 7.5 1 11.5", mode: "stroke" },
    { d: "M-9.5-2A9.5 9.5 0 0 1-3-9.2M9.5 2A9.5 9.5 0 0 1 3 9.2M-7.5 5A8 8 0 0 1-8.4-1M7.5-5A8 8 0 0 1 8.4 1", mode: "stroke" },
  ] },
  palm: { label: "Jungle Canopy", layers: [
    { d: "M1 11.5C1 5 1.6-1.4-.6-5", mode: "stroke" },
    { d: "M-.6-5C-5.6-9.4-9.6-6.4-11-2.6M-.6-5C-3.4-11.2 2.4-12 4.6-9.6M-.6-5C4.4-8 9-6.2 10.4-2M-.6-5C-3-3-6.2 0-6.2 3.4", mode: "stroke" },
  ] },
  spore: { label: "Spore Cloud", layers: [
    { d: circle(0, 0, 4.6), mode: "stroke" },
    { d: radial(8, (p) => `M${p(6.2)}L${p(8.6)}`, 0), mode: "stroke" },
    { d: radial(8, (p) => circle(...p(10.6, Math.PI / 8).split(" ").map(Number), 1.1), 0), mode: "fill" },
    { d: circle(0, 0, 1.6), mode: "fill" },
  ] },
  necron_glyph: { label: "Necron Glyph", layers: [
    { d: "M-7-10H7M0-10V2M-8 10H8M0 6V10", mode: "stroke" },
    { d: "M-5-5L0 2 5-5", mode: "stroke" },
    { d: circle(0, 4.2, 2), mode: "fill" },
  ] },
  gauss_ring: { label: "Gauss Arc Pylon", layers: [
    { d: `${circle(0, 0, 10.4)}${circle(0, 0, 6)}`, mode: "stroke" },
    { d: "M1.2-4.2L-2.4 .6H1L-1.6 4.4", mode: "stroke" },
  ] },
  toxic_bio: { label: "Bio-Toxin", layers: [
    { d: radial(3, (p) => circle(...p(4.6).split(" ").map(Number), 5)), mode: "stroke" },
    { d: circle(0, 0, 1.8), mode: "fill" },
  ] },
  monolith: { label: "Monolith Ruins", layers: [
    { d: "M-6 11L-4.4-8.6 0-11 4.4-8.6 6 11Z", mode: "stroke" },
    { d: "M-2-3.4H2V1.6H-2Z", mode: "fill" },
    { d: "M-11 11H11", mode: "stroke" },
  ] },
  sun: { label: "Scorching Sun", layers: [
    { d: circle(0, 0, 4.6), mode: "stroke" },
    { d: radial(8, (p) => `M${p(7)}L${p(10.8)}`), mode: "stroke" },
  ] },
  dead_tree: { label: "Dead Wastes", layers: [
    { d: "M0 11V-2M0 2L-6-4.6M-3.4-.6L-5.2-8.6M0-2L5-7.4M3-4.2L8.4-5.6M2.2-5.8L1-11", mode: "stroke" },
    { d: "M-8 11H8", mode: "stroke" },
  ] },
  space_elevator: { label: "Space Elevator", layers: [
    { d: "M0-11.5V11.5M-2.4-11.5H2.4", mode: "stroke" },
    { d: "M-7.5-6.5H7.5V-3H-7.5Z", mode: "stroke" },
    { d: "M-9 11.5L-3.4 6.4H3.4L9 11.5M-4 2H4", mode: "stroke" },
  ] },
  gantry: { label: "Void Gantry", layers: [
    { d: "M-7 11.5V-9M-10 11.5H-4M-7-9H9.5M-7-4.6L-2.6-9M7.6-9V-3", mode: "stroke" },
    { d: "M5.4-3H9.8V.8H5.4Z", mode: "fill" },
    { d: "M-7 2L-3.4-2M-7 7L-3.4 3", mode: "stroke" },
  ] },
  caldera: { label: "Magma Caldera", layers: [
    { d: "M-11.5 10L-4.4-3H4.4L11.5 10Z", mode: "stroke" },
    { d: "M-4.4-3C-2.2-.4 2.2-.4 4.4-3Z", mode: "fill" },
    { d: "M0-5.4C-2.2-8 2-9 0-11.5", mode: "stroke" },
  ] },
  magma: { label: "Magma Flow", layers: [
    { d: "M0-11.5C5-4.6 8-.4 8 3.6A8 8 0 0 1-8 3.6C-8-.4-5-4.6 0-11.5Z", mode: "stroke" },
    { d: "M0-2C3 1.6 3 6 0 7.4-3 6-3 1.6 0-2Z", mode: "fill" },
  ] },
  peak: { label: "Mountain Peaks", layers: [
    { d: "M-11.5 9.5L-5-3-1.2 3.2 4-8 11.5 9.5Z", mode: "stroke" },
    { d: "M4-8L6.4-3.4 4.2-4.6 2-3.2Z", mode: "fill" },
  ] },
  bastion: { label: "Fortress Bastion", layers: EMBLEMS.stronghold.layers },
  trench: { label: "Trench Lines", layers: [
    { d: "M-11.5-1H-5.5V5H5.5V-1H11.5", mode: "stroke" },
    { d: "M-11.5 9.5H11.5", mode: "stroke" },
    { d: "M-10.5-7.5L-8.4-5.4-6.3-7.5-4.2-5.4-2.1-7.5 0-5.4 2.1-7.5 4.2-5.4 6.3-7.5 8.4-5.4 10.5-7.5", mode: "stroke" },
  ] },
  rad_shield: { label: "Void Shield", layers: [
    { d: "M0-11.5L9.5-7.5V0C9.5 6.2 4.4 9.6 0 11.5-4.4 9.6-9.5 6.2-9.5 0V-7.5Z", mode: "stroke" },
    { d: "M-5 0A5 5 0 0 1 5 0M-3 3.4A3.6 3.6 0 0 1 3 3.4", mode: "stroke" },
    { d: circle(0, 0, 1.3), mode: "fill" },
  ] },
  unknown: { label: "Unclassified Terrain", layers: [
    { d: "M0-10L10 0 0 10-10 0Z", mode: "stroke" },
    { d: "M-2.6-2.6C-2.6-5.6 2.6-5.6 2.6-2.6S0-.4 0 2.2M0 4.6V5.2", mode: "stroke" },
  ] },
};

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

// Fleet "badge" keys from campaign_data.json.
export const BADGE_EMBLEMS = {
  imperial_aquila: "aquila",
  knight_helm: "knightHelm",
  necron_monolith: "necronMonolith",
  craftworld_rune: "aeldariRune",
  chaos_star: "chaosStar",
  nurgle_fly: "nurgleFly",
};

export function factionEmblem(faction, alliance) {
  return FACTION_EMBLEMS[faction] || ALLIANCE_EMBLEMS[alliance] || "special";
}

export function fleetEmblem(fleet) {
  return BADGE_EMBLEMS[fleet.badge] || factionEmblem(fleet.faction, fleet.alliance);
}

export function drawEmblem(context, key, x, y, size, color, lineWidth = 1.8) {
  const emblem = { layers: emblemLayers(key) };
  context.save();
  context.translate(x, y);
  context.scale(size / 24, size / 24);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const layer of emblem.layers) {
    const path = new Path2D(layer.d);
    context.setLineDash(layer.dash ? layer.dash.split(" ").map(Number) : []);
    if (layer.mode === "fill") context.fill(path);
    else context.stroke(path);
  }
  context.restore();
}
