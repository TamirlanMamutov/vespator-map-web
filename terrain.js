// Surface themes for the nine official terrain twists. A world's primary (first) twist picks its 3D surface.
// effects: clouds (swirling cloud shell), seams (metallic wireframe + girder ring), pulse (throbbing hazard glow),
//          smoke (rising particles), shield (golden void-shield rings).
export const TERRAIN_THEMES = {
  spaceport: { label: "Orbital spaceport & void docks", pattern: "bands", base: "#4f6274", accent: "#9fd8ff", dark: "#172028", glow: "#9fd8ff", effects: ["seams"], seam: "#9fd8ff" },
  desolate_wastes: { label: "Scorched desolate wastes", pattern: "cracks", base: "#9a5a22", accent: "#ffb347", dark: "#2a1206", glow: "#ff9a3a", effects: ["smoke"] },
  xenoflora_jungle: { label: "Hyper-lethal xenoflora canopy", pattern: "swirl", base: "#1f6b2a", accent: "#7dff5a", dark: "#082a0e", glow: "#33ff33", effects: ["clouds"], cloud: "#d8ffd0" },
  rad_zone: { label: "Rad-blasted hazard zone", pattern: "blotch", base: "#4f5a1f", accent: "#d8ff3a", dark: "#141806", glow: "#c8ff33", effects: ["pulse", "clouds"], cloud: "#c8ff33" },
  forge_complex: { label: "Smog-choked forge complex", pattern: "smog", base: "#3d4a2a", accent: "#a8bc4a", dark: "#12170b", glow: "#a8c84a", effects: ["seams", "clouds"], cloud: "#9fb35a", seam: "#b8692e" },
  hab_sprawl: { label: "Spire-city hab sprawl", pattern: "city", base: "#46443f", accent: "#ffcc66", dark: "#151412", glow: "#ffcc66", effects: [] },
  delvesite_facility: { label: "Strip-mined delvesite", pattern: "plates", base: "#5a4a3a", accent: "#e0a060", dark: "#1a140e", glow: "#e0a060", effects: ["smoke"] },
  dead_lands: { label: "Ash-grey dead lands", pattern: "canopy", base: "#3a3a36", accent: "#8a8a80", dark: "#121210", glow: "#a0a098", effects: [] },
  tomb_complex: { label: "Necron tomb complex", pattern: "circuit", base: "#1d2a23", accent: "#33ff99", dark: "#070d0a", glow: "#33ff99", effects: [] },
  unknown: { label: "Unsurveyed rock", pattern: "blotch", base: "#5a5a55", accent: "#a0a098", dark: "#1c1c1a", glow: "#33ff33", effects: [] },
};

const FORTIFIED = /citadel|fortress|bastion/i;

export function terrainTheme(planet) {
  const twist = (planet.terrainIcons || [])[0];
  const key = TERRAIN_THEMES[twist] ? twist : "unknown";
  const theme = { key, ...TERRAIN_THEMES[key], effects: [...TERRAIN_THEMES[key].effects] };
  if (FORTIFIED.test(planet.terrain || "")) theme.effects.push("shield");
  return theme;
}
export function seededRandom(seedText) {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    seed ^= seed >>> 16;
    return (seed >>> 0) / 4294967296;
  };
}
