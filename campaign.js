export const ALLIANCES = ["Imperium", "Xenos", "Chaos"];
export const MIN_POWER = 1;
export const MAX_POWER = 4;
export const MAX_INFRASTRUCTURE = 6;
export const INFRASTRUCTURE_TYPES = ["Fortification Line", "Support Facility", "Staging Grounds", "Stronghold"];
// "Empty" and "Active" are the plain string slots used by campaign_data.json; typed slots are objects.
export const SLOT_CATEGORIES = ["Empty", "Active", ...INFRASTRUCTURE_TYPES];
export const DEFAULT_BADGES = {
  "Imperial Guard": "imperial_battleship",
  "Imperial Knights": "imperial_cruiser",
  Necrons: "necron_scythe",
  Aeldari: "aeldari_cruiser",
  "Thousand Sons": "chaos_grand_cruiser",
  "Death Guard": "chaos_grand_cruiser",
};
const STRONGHOLD_PREFIX = { Imperium: "Imperial", Xenos: "Xenos", Chaos: "Chaos" };

// The nine official War on the Vespator Front terrain twists, keyed by their terrainIcons glyph.
export const TERRAIN_TWISTS = {
  spaceport: "Spaceport",
  desolate_wastes: "Desolate Wastes",
  xenoflora_jungle: "Xenoflora Jungle",
  rad_zone: "Rad Zone",
  forge_complex: "Forge Complex",
  hab_sprawl: "Hab Sprawl",
  delvesite_facility: "Delvesite Facility",
  dead_lands: "Dead Lands",
  tomb_complex: "Tomb Complex",
};
export const TWIST_NAMES = Object.values(TERRAIN_TWISTS);
export const MAX_TWISTS = 3;

export function twistKey(name) {
  return Object.keys(TERRAIN_TWISTS).find((icon) => TERRAIN_TWISTS[icon] === name) || null;
}

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
    if (!text(planet.terrain)) fail(`${where} needs a terrain classification.`);
    const twists = planet.terrainTwists;
    if (!Array.isArray(twists) || !twists.length || twists.length > MAX_TWISTS || new Set(twists).size !== twists.length || !twists.every((twist) => TWIST_NAMES.includes(twist))) {
      fail(`${where} terrainTwists must list 1–${MAX_TWISTS} distinct official twists (${TWIST_NAMES.join(", ")}).`);
    }
    if (planet.terrainIcons !== undefined && (!Array.isArray(planet.terrainIcons) || !planet.terrainIcons.every((icon) => key(icon) && TERRAIN_TWISTS[icon]))) fail(`${where} terrainIcons must be official terrain twist glyph keys.`);
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
      if (!record(assault) || !ids.has(assault.from) || !ids.has(assault.to)) fail("offensive vectors must reference existing worlds.");
      // from === to is an orbital engagement against the host world and needs no lane.
      if (assault.from !== assault.to && !lanes.has([assault.from, assault.to].sort().join("|"))) fail(`offensive vector ${assault.from} → ${assault.to} must follow a direct warp lane.`);
      if (!ALLIANCES.includes(assault.alliance)) fail(`offensive vector ${assault.from} → ${assault.to} needs an alliance of ${ALLIANCES.join(", ")}.`);
      if (assault.label !== undefined && !text(assault.label, 80)) fail("offensive vector labels must be 1–80 characters.");
      const id = `${assault.from}>${assault.to}>${assault.alliance}`;
      if (seen.has(id)) fail(`duplicate ${assault.alliance} offensive vector ${assault.from} → ${assault.to}.`);
      seen.add(id);
    }
  }
  if (data.activeKillTeams !== undefined) {
    if (!Array.isArray(data.activeKillTeams)) fail("activeKillTeams must be an array.");
    const seen = new Set();
    const operations = new Set();
    for (const operation of data.activeKillTeams) {
      if (!record(operation) || !key(operation.id) || seen.has(operation.id)) fail("kill team operations need a unique id key.");
      seen.add(operation.id);
      if (!ids.has(operation.target)) fail(`kill team operation ${operation.id} must target an existing world.`);
      if (operation.from !== undefined && !ids.has(operation.from)) fail(`kill team operation ${operation.id} must stage from an existing world.`);
      if (!ALLIANCES.includes(operation.alliance)) fail(`kill team operation ${operation.id} needs an alliance of ${ALLIANCES.join(", ")}.`);
      if (!text(operation.codename, 80)) fail(`kill team operation ${operation.id} needs a 1–80 character codename.`);
      const signature = `${operation.target}>${operation.codename.trim().toLowerCase()}`;
      if (operations.has(signature)) fail(`duplicate kill team operation "${operation.codename}" on ${operation.target}.`);
      operations.add(signature);
    }
  }
  return data;
}

// Migrates legacy terrain fields to terrainTwists, keeps terrainIcons in step with the twists, then validates.
// Returns the number of worlds that changed.
export function normalizeCampaign(data) {
  let changed = 0;
  for (const planet of Array.isArray(data?.planets) ? data.planets : []) {
    if (!record(planet)) continue;
    const before = JSON.stringify([planet.terrainTwists, planet.terrainIcons, planet.terrainTraits, planet.terrainCategory]);
    if (!Array.isArray(planet.terrainTwists)) {
      const legacy = [...(Array.isArray(planet.terrainTraits) ? planet.terrainTraits : []), ...(Array.isArray(planet.terrainIcons) ? planet.terrainIcons.map((icon) => TERRAIN_TWISTS[icon]) : [])];
      const twists = [...new Set(legacy.filter((name) => TWIST_NAMES.includes(name)))].slice(0, MAX_TWISTS);
      if (twists.length) planet.terrainTwists = twists;
    }
    delete planet.terrainTraits;
    delete planet.terrainCategory;
    if (Array.isArray(planet.terrainTwists) && planet.terrainTwists.every((twist) => TWIST_NAMES.includes(twist))) planet.terrainIcons = planet.terrainTwists.map(twistKey);
    if (JSON.stringify([planet.terrainTwists, planet.terrainIcons, planet.terrainTraits, planet.terrainCategory]) !== before) changed++;
  }
  validateCampaign(data);
  data.offensiveVectors ??= [];
  data.activeKillTeams ??= [];
  return changed;
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

// Builds into the first empty slot, opening a new slot when the world is full. Returns the slot index used.
export function constructInfrastructure(data, planetId, category, alliance) {
  const planet = requireOperational(data, planetId);
  if (!INFRASTRUCTURE_TYPES.includes(category) && category !== "Active") throw new Error("Choose an infrastructure type to construct.");
  if (alliance && !ALLIANCES.includes(alliance)) throw new Error("Unknown alliance.");
  let index = planet.infrastructure.slots.indexOf("empty");
  if (index < 0) {
    if (planet.infrastructure.maxSlots >= MAX_INFRASTRUCTURE) throw new Error(`${planet.name} has no free infrastructure slots (maximum ${MAX_INFRASTRUCTURE}).`);
    setInfrastructureCapacity(data, planetId, planet.infrastructure.maxSlots + 1);
    index = planet.infrastructure.slots.length - 1;
  }
  setSlot(data, planetId, index, { category, alliance: alliance || null, destroyed: false });
  return index;
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

export function isOrbitalStrike(assault) {
  return assault.from === assault.to;
}

// The host world comes first: it is a valid target for an orbital engagement.
export function assaultTargets(data, planetId) {
  const host = planetById(data, planetId);
  if (!host || host.destroyed) return [];
  return [planetId, ...neighbors(data, planetId).filter((id) => canTransfer(data, planetId, id))];
}

export function launchAssault(data, fromId, toId, alliance, label) {
  const source = requireOperational(data, fromId);
  const target = planetById(data, toId);
  if (!target) throw new Error("Target world no longer exists.");
  if (target.destroyed) throw new Error(`${target.name} is a destroyed world; there is nothing left to assault.`);
  if (fromId !== toId && !neighbors(data, fromId).includes(toId)) throw new Error("Assault denied: the target must share a direct warp lane.");
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
  const target = planetById(data, assault.to)?.name || assault.to;
  return assault.label || (isOrbitalStrike(assault) ? `${assault.alliance} Orbital Strike on ${target}` : `${assault.alliance} Assault on ${target}`);
}

export const KILL_TEAM_CODENAMES = ["Operative Extraction", "Vox-Array Sabotage", "Crypt Infiltration"];

// Covert operations ignore warp-lane limits: kill teams can be inserted on any surviving world.
export function deployKillTeam(data, fromId, targetId, alliance, codename) {
  const target = planetById(data, targetId);
  if (!target) throw new Error("Infiltration target no longer exists.");
  if (target.destroyed) throw new Error(`${target.name} is a destroyed world; there is nothing left to infiltrate.`);
  if (fromId !== undefined && !planetById(data, fromId)) throw new Error("Staging world no longer exists.");
  if (!ALLIANCES.includes(alliance)) throw new Error("Unknown alliance.");
  const name = typeof codename === "string" ? codename.trim() : "";
  if (!text(name, 80)) throw new Error("Operation codename must be 1–80 characters.");
  data.activeKillTeams ??= [];
  if (data.activeKillTeams.some((operation) => operation.target === targetId && operation.codename.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`Operation "${name}" is already active on ${target.name}.`);
  }
  let id;
  do id = `kt-${Math.random().toString(36).slice(2, 8)}`; while (data.activeKillTeams.some((operation) => operation.id === id));
  const operation = { id, alliance, target: targetId, codename: name };
  if (fromId !== undefined) operation.from = fromId;
  data.activeKillTeams.push(operation);
  return operation;
}

export function extractKillTeam(data, id) {
  const index = (data.activeKillTeams || []).findIndex((operation) => operation.id === id);
  if (index < 0) throw new Error("Kill team operation no longer exists.");
  return data.activeKillTeams.splice(index, 1)[0];
}

// Operations on a world that later suffers Exterminatus stay on record but are not shown as live markers.
export function activeKillTeams(data) {
  return (data.activeKillTeams || []).filter((operation) => {
    const target = planetById(data, operation.target);
    return target && !target.destroyed;
  });
}

export function killTeamTitle(data, operation) {
  return `${operation.alliance} Kill Team: ${operation.codename} @ ${planetById(data, operation.target)?.name || operation.target}`;
}

// localStorage auto-save envelope for the live Warmaster state.
export const STORAGE_KEY = "vespator_cogitator_active_state";
export const STORAGE_VERSION = 1;

export function campaignFingerprint(data) {
  const source = typeof data === "string" ? data : JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function packState(data, { baseline = null, dirty = true, savedAt = new Date().toISOString() } = {}) {
  validateCampaign(data);
  return JSON.stringify({ version: STORAGE_VERSION, savedAt, baseline, dirty: Boolean(dirty), campaign: data });
}

// Accepts the envelope (or a bare campaign object) and returns a validated campaign, or throws.
export function unpackState(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!record(parsed)) throw new Error("Stored state is not an object.");
  const envelope = record(parsed.campaign) ? parsed : { campaign: parsed };
  if (envelope.version !== undefined && envelope.version > STORAGE_VERSION) throw new Error("Stored state was written by a newer cogitator.");
  const data = structuredClone(envelope.campaign);
  normalizeCampaign(data);
  return {
    campaign: data,
    baseline: typeof envelope.baseline === "string" ? envelope.baseline : null,
    dirty: envelope.dirty !== false,
    savedAt: typeof envelope.savedAt === "string" ? envelope.savedAt : null,
  };
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
