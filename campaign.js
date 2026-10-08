export const ALLIANCES = ["Imperium", "Xenos", "Chaos"];
export const MIN_POWER = 1;
export const MAX_POWER = 4;
export const MAX_INFRASTRUCTURE = 6;
export const INFRASTRUCTURE_TYPES = ["Fortification Line", "Support Facility", "Staging Grounds", "Stronghold"];
// "Empty" and "Active" are the plain string slots used by campaign_data.json; typed slots are objects.
export const SLOT_CATEGORIES = ["Empty", "Active", ...INFRASTRUCTURE_TYPES];
export const DEFAULT_BADGES = {
  "Imperial Guard": "imperial_aquila",
  "Imperial Knights": "knight_helm",
  Necrons: "necron_monolith",
  Aeldari: "craftworld_rune",
  "Thousand Sons": "chaos_star",
  "Death Guard": "nurgle_fly",
};
const STRONGHOLD_PREFIX = { Imperium: "Imperial", Xenos: "Xenos", Chaos: "Chaos" };

// Official Vespator Front Crusade terrain categories. Each world draws its three twists from its category.
export const CRUSADE_TERRAIN = {
  "Ash Wastes": {
    twists: ["Choking Fallout", "Corroded Redoubts", "Slag Runoff"],
    worlds: ["sidon", "knossos"],
    pattern: /ash|manufactorum|sump|industrial|forge|smog/i,
  },
  "Death World": {
    twists: ["Predatory Foliage", "Spore Choke", "Bio-Resonant Canopy"],
    worlds: ["amazon_xi", "myrkvidr"],
    pattern: /death world|jungle|canopy|forest|primeval/i,
  },
  "Tomb World": {
    twists: ["Awoken Monolith Array", "Gauss Dispersion", "Phase Flares"],
    worlds: ["nickel", "atacama", "sarif_iv"],
    pattern: /tomb|crypt|necron|monolith/i,
  },
  "Warp Rift": {
    twists: ["Perils of the Empyrean", "Molten Sump", "Screaming Geysers"],
    worlds: ["pluto_ii", "aetna"],
    pattern: /warp|rift|volcan|magma|caldera|lava/i,
  },
  "Fortress Bastion": {
    twists: ["Void Shield Grid", "Trench Bastions", "Heavy Munitions Depot"],
    worlds: ["gj_3378b", "niflegard", "baikonur", "harvest"],
    pattern: /bastion|fortress|citadel|redoubt|depot|spire/i,
  },
};
export const TERRAIN_CATEGORIES = Object.keys(CRUSADE_TERRAIN);

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 120) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const key = (value) => typeof value === "string" && /^[\w-]{1,40}$/.test(value);

export function validateCampaign(data) {
  const fail = (message) => { throw new Error(`Invalid campaign: ${message}`); };
  if (!record(data) || !text(data.campaignName) || !record(data.alliances)) fail("campaignName and alliances are required.");
  const factions = new Map();
  for (const name of ALLIANCES) {
    const alliance = data.alliances[name];
    if (!record(alliance) || !/^#[0-9a-f]{6}$/i.test(alliance.color) || !Array.isArray(alliance.factions) || !alliance.factions.length) fail(`alliance ${name} must define a hex color and factions.`);
    for (const faction of alliance.factions) {
      if (!text(faction) || factions.has(faction)) fail("faction names must be nonempty and unique.");
      factions.set(faction, name);
    }
  }
  const extra = Object.keys(data.alliances).filter((name) => !ALLIANCES.includes(name));
  if (extra.length) fail(`unknown alliance ${extra[0]}; the Vespator Front uses Imperium, Xenos, and Chaos.`);
  if (!Array.isArray(data.planets) || !data.planets.length) fail("at least one world is required.");
  const ids = new Set();
  for (const planet of data.planets) {
    if (!record(planet) || !text(planet.id, 64) || !/^[\w-]+$/.test(planet.id) || ids.has(planet.id)) fail("world IDs must be unique word characters.");
    ids.add(planet.id);
    const where = `world ${planet.id}`;
    if (!text(planet.name) || !Number.isFinite(planet.x) || !Number.isFinite(planet.y) || Math.abs(planet.x) > 100000 || Math.abs(planet.y) > 100000) fail(`${where} needs a name and finite coordinates.`);
    if (planet.subName !== undefined && !text(planet.subName)) fail(`${where} subName must be text.`);
    if (!record(planet.powerLevels)) fail(`${where} needs powerLevels for each alliance.`);
    for (const alliance of ALLIANCES) {
      const level = planet.powerLevels[alliance];
      if (!Number.isInteger(level) || level < MIN_POWER || level > MAX_POWER) fail(`${where} ${alliance} Power Level must be an integer from ${MIN_POWER} to ${MAX_POWER}.`);
    }
    if (!text(planet.terrain) || !Array.isArray(planet.terrainTraits) || !planet.terrainTraits.every((trait) => text(trait))) fail(`${where} needs a terrain class and terrain traits.`);
    if (planet.terrainIcons !== undefined && (!Array.isArray(planet.terrainIcons) || !planet.terrainIcons.every(key))) fail(`${where} terrainIcons must be a list of icon keys.`);
    if (planet.terrainCategory !== undefined && !TERRAIN_CATEGORIES.includes(planet.terrainCategory)) fail(`${where} terrainCategory must be one of ${TERRAIN_CATEGORIES.join(", ")}.`);
    const infrastructure = planet.infrastructure;
    if (!record(infrastructure) || !Number.isInteger(infrastructure.maxSlots) || infrastructure.maxSlots < 0 || infrastructure.maxSlots > MAX_INFRASTRUCTURE) fail(`${where} infrastructure.maxSlots must be 0–${MAX_INFRASTRUCTURE}.`);
    if (!Array.isArray(infrastructure.slots) || infrastructure.slots.length !== infrastructure.maxSlots) fail(`${where} infrastructure.slots must list exactly maxSlots entries.`);
    for (const slot of infrastructure.slots) {
      const valid = slot === "empty" || slot === "active" || (record(slot) && text(slot.type, 80)
        && (slot.alliance === undefined || ALLIANCES.includes(slot.alliance)) && (slot.destroyed === undefined || typeof slot.destroyed === "boolean"));
      if (!valid) fail(`${where} has an invalid infrastructure slot (use "empty", "active", or { type, alliance }).`);
    }
    if (!Array.isArray(planet.fleets)) fail(`${where} fleets must be an array.`);
    for (const fleet of planet.fleets) {
      if (!record(fleet) || !factions.has(fleet.faction)) fail(`${where} has a fleet with an unknown faction.`);
      if (fleet.alliance !== factions.get(fleet.faction)) fail(`${where} fleet ${fleet.faction} belongs to ${factions.get(fleet.faction)}, not ${fleet.alliance}.`);
      if (fleet.badge !== undefined && !key(fleet.badge)) fail(`${where} fleet badge must be an icon key.`);
      if (fleet.name !== undefined && !text(fleet.name, 80)) fail(`${where} fleet name must be 1–80 characters.`);
    }
    if (typeof planet.destroyed !== "boolean") fail(`${where} destroyed must be true or false.`);
  }
  if (!Array.isArray(data.warpLanes)) fail("warpLanes must be an array.");
  const lanes = new Set();
  for (const lane of data.warpLanes) {
    if (!Array.isArray(lane) || lane.length !== 2 || !ids.has(lane[0]) || !ids.has(lane[1]) || lane[0] === lane[1]) fail("warp lanes must connect two distinct existing worlds.");
    const id = [...lane].sort().join("|");
    if (lanes.has(id)) fail(`duplicate warp lane ${lane.join(" ↔ ")}.`);
    lanes.add(id);
  }
  if (data.offensiveVectors !== undefined) {
    if (!Array.isArray(data.offensiveVectors)) fail("offensiveVectors must be an array.");
    const seen = new Set();
    for (const assault of data.offensiveVectors) {
      if (!record(assault) || !ids.has(assault.from) || !ids.has(assault.to) || assault.from === assault.to) fail("offensive vectors must run between two distinct existing worlds.");
      if (!lanes.has([assault.from, assault.to].sort().join("|"))) fail(`offensive vector ${assault.from} → ${assault.to} must follow a direct warp lane.`);
      if (!ALLIANCES.includes(assault.alliance)) fail(`offensive vector ${assault.from} → ${assault.to} needs an alliance of ${ALLIANCES.join(", ")}.`);
      if (assault.label !== undefined && !text(assault.label, 80)) fail("offensive vector labels must be 1–80 characters.");
      const id = `${assault.from}>${assault.to}>${assault.alliance}`;
      if (seen.has(id)) fail(`duplicate ${assault.alliance} offensive vector ${assault.from} → ${assault.to}.`);
      seen.add(id);
    }
  }
  return data;
}

// Validates, then applies the official terrain twists and default fields. Returns the number of worlds whose twists changed.
export function normalizeCampaign(data) {
  validateCampaign(data);
  let synced = 0;
  for (const planet of data.planets) {
    const category = terrainCategory(planet);
    if (!category) continue;
    const twists = CRUSADE_TERRAIN[category].twists;
    if (planet.terrainTraits.join("|") !== twists.join("|")) synced++;
    planet.terrainCategory = category;
    planet.terrainTraits = [...twists];
  }
  data.offensiveVectors ??= [];
  return synced;
}

export function terrainCategory(planet) {
  if (planet.terrainCategory && CRUSADE_TERRAIN[planet.terrainCategory]) return planet.terrainCategory;
  const byWorld = TERRAIN_CATEGORIES.find((name) => CRUSADE_TERRAIN[name].worlds.includes(planet.id));
  return byWorld || TERRAIN_CATEGORIES.find((name) => CRUSADE_TERRAIN[name].pattern.test(planet.terrain)) || null;
}

export function factionAlliance(data, faction) {
  return ALLIANCES.find((name) => data.alliances[name]?.factions.includes(faction));
}

export function planetById(data, id) {
  return data.planets.find((planet) => planet.id === id);
}

export function neighbors(data, id) {
  return data.warpLanes.filter((lane) => lane.includes(id)).map((lane) => lane[0] === id ? lane[1] : lane[0]);
}

export function planetNames(planet) {
  if (planet.subName) return { world: planet.name, system: planet.subName };
  const [world, ...system] = planet.name.split("/").map((part) => part.trim());
  return { world, system: system.join(" / ") || world };
}

export function dominantAlliance(planet) {
  const top = Math.max(...ALLIANCES.map((alliance) => planet.powerLevels[alliance]));
  const leaders = ALLIANCES.filter((alliance) => planet.powerLevels[alliance] === top);
  return leaders.length === 1 ? leaders[0] : null;
}

export function infrastructureCategory(type) {
  if (/stronghold/i.test(type)) return "Stronghold";
  if (/^active/i.test(type)) return "Active";
  return INFRASTRUCTURE_TYPES.find((known) => known.toLowerCase() === type.trim().toLowerCase()) || "Special";
}

export function infrastructureType(category, alliance) {
  if (category === "Stronghold") return alliance ? `${STRONGHOLD_PREFIX[alliance]} Stronghold` : "Stronghold";
  return category === "Active" ? "Active Facility" : category;
}

export function slotInfo(slot) {
  if (slot === "empty") return { category: "Empty", type: "Empty Slot", alliance: null, destroyed: false, empty: true };
  if (slot === "active") return { category: "Active", type: "Active Facility", alliance: null, destroyed: false, empty: false };
  return { category: infrastructureCategory(slot.type), type: slot.type, alliance: slot.alliance || null, destroyed: Boolean(slot.destroyed), empty: false };
}

export function occupiedSlots(planet) {
  return planet.infrastructure.slots.filter((slot) => slot !== "empty").length;
}

export function setPowerLevel(data, planetId, alliance, level) {
  const planet = requireOperational(data, planetId);
  if (!ALLIANCES.includes(alliance)) throw new Error(`Unknown alliance ${alliance}.`);
  planet.powerLevels[alliance] = Math.min(MAX_POWER, Math.max(MIN_POWER, Math.round(level)));
  return planet.powerLevels[alliance];
}

export function setSlot(data, planetId, index, changes) {
  const planet = requireOperational(data, planetId);
  const slots = planet.infrastructure.slots;
  if (!Number.isInteger(index) || index < 0 || index >= slots.length) throw new Error("Infrastructure slot no longer exists.");
  const current = slotInfo(slots[index]);
  const category = changes.category ?? current.category;
  const alliance = changes.alliance !== undefined ? changes.alliance || null : current.alliance;
  const destroyed = changes.destroyed ?? current.destroyed;
  if (!SLOT_CATEGORIES.includes(category) && category !== "Special") throw new Error("Unknown infrastructure type.");
  if (alliance !== null && !ALLIANCES.includes(alliance)) throw new Error("Unknown alliance.");
  if (category === "Empty") { slots[index] = "empty"; return; }
  if (category === "Active" && !alliance && !destroyed) { slots[index] = "active"; return; }
  const type = category === "Special" ? current.type : infrastructureType(category, alliance);
  slots[index] = { type, ...(alliance ? { alliance } : {}), ...(destroyed ? { destroyed: true } : {}) };
}

export function setInfrastructureCapacity(data, planetId, capacity) {
  const planet = requireOperational(data, planetId);
  const infrastructure = planet.infrastructure;
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > MAX_INFRASTRUCTURE) throw new Error(`Capacity must be between 0 and ${MAX_INFRASTRUCTURE}.`);
  const removable = infrastructure.slots.filter((slot) => slot === "empty").length;
  if (infrastructure.slots.length - capacity > removable) throw new Error("Only empty slots can be removed; clear a slot first.");
  while (infrastructure.slots.length < capacity) infrastructure.slots.push("empty");
  while (infrastructure.slots.length > capacity) infrastructure.slots.splice(infrastructure.slots.lastIndexOf("empty"), 1);
  infrastructure.maxSlots = capacity;
}

export function fleetTitle(fleet) {
  return fleet.name || `${fleet.faction} Battlegroup`;
}

export function commissionFleet(data, planetId, faction, name) {
  const planet = requireOperational(data, planetId);
  const alliance = factionAlliance(data, faction);
  if (!alliance) throw new Error("Unknown faction.");
  if (name !== undefined && name.trim() && !text(name, 80)) throw new Error("Fleet name must be 1–80 characters.");
  const fleet = { alliance, faction, badge: DEFAULT_BADGES[faction] || "unknown" };
  if (name?.trim()) fleet.name = name.trim();
  planet.fleets.push(fleet);
}

export function decommissionFleet(data, planetId, index) {
  const planet = planetById(data, planetId);
  if (!planet?.fleets[index]) throw new Error("Fleet no longer exists.");
  planet.fleets.splice(index, 1);
}

export function canTransfer(data, sourceId, targetId) {
  const source = planetById(data, sourceId);
  const target = planetById(data, targetId);
  return Boolean(source && target && !source.destroyed && !target.destroyed && neighbors(data, sourceId).includes(targetId));
}

export function moveFleet(data, sourceId, fleetIndex, targetId) {
  const source = planetById(data, sourceId);
  const target = planetById(data, targetId);
  if (!source || !target || !Number.isInteger(fleetIndex) || !source.fleets[fleetIndex]) throw new Error("Fleet or destination no longer exists.");
  if (source.destroyed || target.destroyed) throw new Error("Fleet transfer denied: destroyed worlds have no operational docking.");
  if (!neighbors(data, sourceId).includes(targetId)) throw new Error("Fleet transfer denied: destination must share a direct warp lane.");
  target.fleets.push(source.fleets.splice(fleetIndex, 1)[0]);
}

export function setDestroyed(data, planetId, destroyed) {
  const planet = planetById(data, planetId);
  if (!planet) throw new Error("World no longer exists.");
  planet.destroyed = Boolean(destroyed);
}

// Assaults whose origin or target has suffered Exterminatus stay on record but are not drawn.
export function activeVectors(data) {
  return (data.offensiveVectors || []).filter((assault) => {
    const from = planetById(data, assault.from);
    const to = planetById(data, assault.to);
    return from && to && !from.destroyed && !to.destroyed;
  });
}

export function assaultTargets(data, planetId) {
  return neighbors(data, planetId).filter((id) => canTransfer(data, planetId, id));
}

export function launchAssault(data, fromId, toId, alliance, label) {
  const source = requireOperational(data, fromId);
  const target = planetById(data, toId);
  if (!target) throw new Error("Target world no longer exists.");
  if (target.destroyed) throw new Error(`${target.name} is a destroyed world; there is nothing left to assault.`);
  if (!neighbors(data, fromId).includes(toId)) throw new Error("Assault denied: the target must share a direct warp lane.");
  if (!ALLIANCES.includes(alliance)) throw new Error("Unknown alliance.");
  if (label !== undefined && label.trim() && !text(label.trim(), 80)) throw new Error("Assault designation must be 1–80 characters.");
  data.offensiveVectors ??= [];
  if (data.offensiveVectors.some((assault) => assault.from === fromId && assault.to === toId && assault.alliance === alliance)) {
    throw new Error(`${alliance} is already assaulting ${target.name} from ${source.name}.`);
  }
  const assault = { from: fromId, to: toId, alliance };
  if (label?.trim()) assault.label = label.trim();
  data.offensiveVectors.push(assault);
  return assault;
}

export function recallAssault(data, index) {
  if (!data.offensiveVectors?.[index]) throw new Error("Offensive vector no longer exists.");
  data.offensiveVectors.splice(index, 1);
}

export function assaultTitle(data, assault) {
  return assault.label || `${assault.alliance} Assault on ${planetById(data, assault.to)?.name || assault.to}`;
}

export function serializeCampaign(data) {
  validateCampaign(data);
  return `${JSON.stringify(data, null, 2)}\n`;
}

function requireOperational(data, planetId) {
  const planet = planetById(data, planetId);
  if (!planet) throw new Error("World no longer exists.");
  if (planet.destroyed) throw new Error(`${planet.name} has suffered Exterminatus; restore it before issuing orders.`);
  return planet;
}
