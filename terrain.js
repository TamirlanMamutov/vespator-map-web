// Terrain classes drive the dossier globe, the 3D surface textures, and per-world 3D effects.
// effects: clouds (swirling cloud shell), seams (metallic wireframe), pulse (throbbing lava glow),
//          smoke (rising particles), shield (golden void-shield rings).
export const TERRAIN_THEMES = {
  infernal: { label: "Warp-scarred volcanic rock", pattern: "lava", base: "#1b1414", accent: "#ff2a2a", dark: "#050303", glow: "#ff3333", effects: ["pulse"] },
  jungle: { label: "Hyper-lethal jungle canopy", pattern: "swirl", base: "#1f6b2a", accent: "#7dff5a", dark: "#082a0e", glow: "#33ff33", effects: ["clouds"], cloud: "#d8ffd0" },
  forest: { label: "Primeval shadow forest", pattern: "canopy", base: "#0d2a15", accent: "#2f6b3a", dark: "#020904", glow: "#2aff7a", effects: [] },
  scorched: { label: "Molten tectonic crust", pattern: "cracks", base: "#9a3412", accent: "#ffb347", dark: "#1c0702", glow: "#ff7a1a", effects: ["smoke"] },
  ice: { label: "Crystalline glacial shelf", pattern: "ice", base: "#a9dcf5", accent: "#ffffff", dark: "#4f86b3", glow: "#9fe8ff", effects: ["clouds"], cloud: "#ffffff" },
  smog: { label: "Smog-choked manufactorum", pattern: "smog", base: "#3d4a2a", accent: "#a8bc4a", dark: "#12170b", glow: "#a8c84a", effects: ["seams", "clouds"], cloud: "#9fb35a", seam: "#b8692e" },
  radwaste: { label: "Rad-blighted industrial sprawl", pattern: "city", base: "#4f4d33", accent: "#d8e04a", dark: "#16160d", glow: "#c8ff33", effects: [] },
  toxic: { label: "Toxic blight", pattern: "blotch", base: "#5d6a17", accent: "#c8e03a", dark: "#1f2405", glow: "#b6ff33", effects: [] },
  tomb: { label: "Necron tomb complex", pattern: "circuit", base: "#1d2a23", accent: "#33ff99", dark: "#070d0a", glow: "#33ff99", effects: [] },
  hive: { label: "Spire-city sprawl", pattern: "city", base: "#46443f", accent: "#ffcc66", dark: "#151412", glow: "#ffcc66", effects: [] },
  desert: { label: "Bleached salt desert", pattern: "bands", base: "#c4a066", accent: "#f4e6c0", dark: "#7a5a2c", glow: "#ffe0a0", effects: [] },
  fortress: { label: "Void-shielded fortress world", pattern: "plates", base: "#6e5d3d", accent: "#e5a93c", dark: "#241d10", glow: "#e5a93c", effects: ["shield"] },
  agri: { label: "Patchwork agri-continents", pattern: "fields", base: "#5f7f22", accent: "#e8b83a", dark: "#2c4512", glow: "#ffd25a", effects: [] },
  orbital: { label: "Orbital spire & void dock", pattern: "bands", base: "#4f6274", accent: "#9fd8ff", dark: "#172028", glow: "#9fd8ff", effects: [] },
  warp: { label: "Warp-touched", pattern: "rift", base: "#3a1236", accent: "#ff3fa0", dark: "#12040f", glow: "#ff3333", effects: [] },
  barren: { label: "Barren rock", pattern: "blotch", base: "#5a5a55", accent: "#a0a098", dark: "#1c1c1a", glow: "#33ff33", effects: [] },
};

const RULES = [
  ["infernal", /caldera|infernal|warp-infused/i],
  ["forest", /forest|canopy|woodland/i],
  ["jungle", /jungle|death world/i],
  ["scorched", /magma|lava|tectonic|volcan/i],
  ["ice", /\bice\b|glacial|frost|snow|blizzard|cryo/i],
  ["smog", /manufactorum|polluted|smog|forge/i],
  ["radwaste", /rad-?waste|radiation|ash waste/i],
  ["toxic", /toxic|blight|plague|poison/i],
  ["tomb", /tomb|necron|living metal/i],
  ["desert", /desert|salt|dune/i],
  ["fortress", /fortress|bastion|citadel|armou?red/i],
  ["agri", /agri|fertile|grain|prairie/i],
  ["orbital", /orbital|void dock|elevator/i],
  ["hive", /hive|spire|megastructure|industrial|sprawl|city/i],
  ["warp", /warp|daemon/i],
];

// Fallback surface for each official Crusade terrain category when the terrain text matches no rule.
const CATEGORY_THEMES = { "Ash Wastes": "radwaste", "Death World": "jungle", "Tomb World": "tomb", "Warp Rift": "warp", "Fortress Bastion": "fortress" };

export function terrainTheme(planet) {
  const primary = RULES.find(([, pattern]) => pattern.test(planet.terrain));
  const category = CATEGORY_THEMES[planet.terrainCategory];
  const secondary = primary || RULES.find(([, pattern]) => planet.terrainTraits.some((trait) => pattern.test(trait)));
  const key = primary ? primary[0] : category || (secondary ? secondary[0] : "barren");
  return { key, ...TERRAIN_THEMES[key] };
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
